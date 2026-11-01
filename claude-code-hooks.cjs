'use strict';
// Claude Code and Codex hooks → TwoCode traffic light.
// Claude Code posts each hook event to a small server on 127.0.0.1. Codex runs a tiny command (curl, part of
// Windows) that posts the same events there, tagged agent=codex. No browser or window reading needed.
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { questionFrom } = require('./ai-monitor-model.cjs');

const PORT = 47823;
const ROUTE = '/twocode-hook';
const STATUS_ROUTE = '/twocode-status';
const STATUS_SCRIPT = path.join(__dirname, 'twocode-statusline.cjs');
const WAIT_ROUTE = '/twocode-wait';
const REPLY_SCRIPT = path.join(__dirname, 'twocode-reply.cjs');
const REPLY_WAIT_S = 1800; // how long an island answer can still wake Claude after it stopped
const VERSION = 4; // Bump when the installed hook config changes; older installs are upgraded on start.
const HOOK_URL = 'http://127.0.0.1:' + PORT + ROUTE + '?v=' + VERSION;
const EVENTS = ['UserPromptSubmit', 'PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PermissionRequest',
  'Notification', 'Stop', 'StopFailure', 'SessionEnd', 'SessionStart'];
// The terminal dialog stays usable while this hook waits; whoever answers first wins.
const PERMISSION_WAIT_S = 300;
const QUESTION_NOTIFICATIONS = new Set(['elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input']);
const RANK = { question: 4, error: 3, running: 2, done: 1, ready: 0 };
// The two coding agents TwoCode follows. Codex reads its hooks from ~/.codex/hooks.json (the same shape as Claude Code).
const AGENTS = { claude: { id: 'claudecode', name: 'Claude Code', short: 'Claude' }, codex: { id: 'codex', name: 'Codex', short: 'Codex' }, antigravity: { id: 'antigravity', name: 'Antigravity', short: 'Antigravity' } };
const CODEX_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PermissionRequest', 'Stop', 'SessionEnd'];
const ANTIGRAVITY_EVENTS = ['SessionStart', 'PreInvocation', 'PostInvocation', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'StopFailure', 'SessionEnd'];

function createHub(options = {}) {
  const userData = options.userData;
  const settingsFile = options.settingsFile || path.join(os.homedir(), '.claude', 'settings.json');
  const codexHome = options.codexHome || process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const codexFile = path.join(codexHome, 'hooks.json');
  const onChange = options.onChange || (() => {});
  const onFinish = options.onFinish || (() => {});
  // The pid a hook sends is a short-lived helper shell. Right away (while it still exists) we look up the
  // window that really runs Claude Code (Windows Terminal, VS Code, ...) and remember that one.
  const resolvePid = options.resolvePid || (pid => Promise.resolve(pid));
  function learnPid(s, pid) {
    if (!Number.isSafeInteger(pid) || pid <= 0 || s.windowPid || s.resolving === pid) return;
    s.pid ||= pid; s.resolving = pid;
    resolvePid(pid).then(win => { if (win) { s.windowPid = win; s.pid = win; onChange(); } }).catch(() => {}).finally(() => { if (s.resolving === pid) s.resolving = null; });
  }
  const sessions = new Map();
  let activeSessionId = null;
  function selectSession(id) {
    activeSessionId = id ? String(id) : null;
    onChange();
    return { ok: true };
  }
  const waiting = new Map(); // session id → open PermissionRequest response
  let server = null, listening = false, serverError = '', hooksCache = false, checkedAt = 0;
  let usage = { fiveHour: null, sevenDay: null, at: 0 };
  const changed = () => { checkedAt = 0; onChange(); };
  // What your AI did, for the home page of the TwoCode app: the last 40 finished turns (kept on this PC only).
  const historyFile = userData ? path.join(userData, 'twocode-history.json') : null;
  let history = [];
  try { history = JSON.parse(fs.readFileSync(historyFile, 'utf8')); if (!Array.isArray(history)) history = []; } catch {}
  function remember(s, result) {
    if (!historyFile) return;
    const promptText = s.prompt || s.title || s.project || 'Antigravity sessie';
    const now = Date.now();
    if (history.length > 0 && history[0].agent === s.agent && (history[0].prompt === promptText || (history[0].project && history[0].project === (s.title || s.project)))) {
      history[0].at = now;
      history[0].result = result;
      history[0].seconds = s.startedAt ? Math.round((now - s.startedAt) / 1000) : history[0].seconds;
    } else {
      history.unshift({ at: now, agent: s.agent || 'claude', name: (AGENTS[s.agent] || AGENTS.claude).name, project: s.title || s.project || '', cwd: s.cwd || '', prompt: promptText,
        result, files: (s.files || []).length, seconds: s.startedAt ? Math.round((now - s.startedAt) / 1000) : 0 });
      history = history.slice(0, 40);
    }
    try { fs.writeFileSync(historyFile + '.tmp', JSON.stringify(history)); fs.renameSync(historyFile + '.tmp', historyFile); } catch {}
  }

  let lastAntigravityScan = 0;
  let antigravityScanning = false;
  function getAntigravityDbPaths() {
    const dbs = [];
    const defaultDb = path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db');
    if (fs.existsSync(defaultDb)) dbs.push({ slot: 'default', path: defaultDb });
    const profileDirs = [process.env.ANTIGRAVITY_PROFILES_DIR, 'D:/Launchers/AntigravityProfiles', 'C:/Launchers/AntigravityProfiles'].filter(Boolean);
    for (const pDir of profileDirs) {
      if (fs.existsSync(pDir)) {
        try {
          for (const s of fs.readdirSync(pDir)) {
            const db = path.join(pDir, s, 'user', '.gemini', 'antigravity', 'conversation_summaries.db');
            if (fs.existsSync(db)) dbs.push({ slot: s.replace(/^profile_/, ''), path: db });
          }
        } catch {}
      }
    }
    return dbs;
  }

  let gitStatsCache = new Map(); // cwd -> { at, stats, fetching }
  function getGitStats(cwd) {
    if (!cwd || typeof cwd !== 'string') return null;
    const now = Date.now();
    const cached = gitStatsCache.get(cwd);
    if (cached && (now - cached.at < 60000)) return cached.stats;
    if (!cached || !cached.fetching) {
      gitStatsCache.set(cwd, { at: now, stats: cached?.stats || null, fetching: true });
      const cp = require('node:child_process');
      cp.exec('git diff --shortstat', { cwd, encoding: 'utf8', timeout: 2000 }, (err, stdout) => {
        let out = (stdout || '').trim();
        const finish = text => {
          let stats = null;
          if (text) {
            const mFiles = text.match(/(\d+)\s+file/);
            const mAdd = text.match(/(\d+)\s+insertion/);
            const mDel = text.match(/(\d+)\s+deletion/);
            stats = {
              files: mFiles ? Number(mFiles[1]) : 0,
              additions: mAdd ? Number(mAdd[1]) : 0,
              deletions: mDel ? Number(mDel[1]) : 0
            };
          }
          gitStatsCache.set(cwd, { at: Date.now(), stats, fetching: false });
        };
        if (!out) {
          cp.exec('git diff HEAD~1 --shortstat', { cwd, encoding: 'utf8', timeout: 2000 }, (err2, stdout2) => {
            finish((stdout2 || '').trim());
          });
        } else {
          finish(out);
        }
      });
    }
    return cached?.stats || null;
  }

  function getLastPromptFromTranscript(convId) {
    if (!convId) return '';
    const possiblePaths = [
      path.join('D:/Launchers/AntigravityProfiles/profile_04/user/.gemini/antigravity/brain', convId, '.system_generated', 'logs', 'transcript.jsonl'),
      path.join(os.homedir(), '.gemini', 'antigravity', 'brain', convId, '.system_generated', 'logs', 'transcript.jsonl')
    ];
    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          const stat = fs.statSync(p);
          const readSize = Math.min(stat.size, 65536);
          const fd = fs.openSync(p, 'r');
          const buf = Buffer.alloc(readSize);
          fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
          fs.closeSync(fd);
          const lines = buf.toString('utf8').split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (!line) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.type === 'USER_INPUT' && obj.content) {
                const clean = String(obj.content)
                  .replace(/<\/?USER_REQUEST>/g, '')
                  .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '')
                  .replace(/PS [A-Z]:\\[^\n]*/g, '')
                  .replace(/[\r\n]+/g, ' ')
                  .trim();
                if (clean) return clean.slice(0, 160);
              }
            } catch {}
          }
        }
      } catch {}
    }
    return '';
  }

  function syncAntigravitySessions() {
    const now = Date.now();
    if (now - lastAntigravityScan < 20000 || antigravityScanning) return;
    lastAntigravityScan = now;
    antigravityScanning = true;

    try {
      let changedAny = false;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      for (const { slot, path: dbPath } of getAntigravityDbPaths()) {
        if (fs.existsSync(dbPath)) {
          try {
            const { DatabaseSync } = require('node:sqlite');
            const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
            const rows = db.prepare('SELECT conversation_id, title, preview, status, not_fully_idle, workspace_uris, last_modified_time FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 8').all();
            for (const row of rows) {
              if (row && row.conversation_id) {
                const modTime = new Date(row.last_modified_time).getTime();
                if (now - modTime < ONE_DAY_MS * 4) {
                  const hasBackground = Boolean(row.not_fully_idle && row.status !== 'CASCADE_RUN_STATUS_RUNNING');
                  let workspaceName = '';
                  let workspacePath = '';
                  if (row.workspace_uris) {
                    try {
                      const uris = JSON.parse(row.workspace_uris);
                      if (Array.isArray(uris) && uris.length && uris[0]) {
                        let u = String(uris[0]).replace(/^file:\/\/\/?/i, '').replace(/%3A/gi, ':');
                        if (!/^[a-zA-Z]:/.test(u) && /^\/[a-zA-Z]:/.test(u)) u = u.slice(1);
                        workspacePath = decodeURIComponent(u);
                        workspaceName = path.basename(workspacePath);
                      }
                    } catch {}
                  }

                  if (!sessions.has(row.conversation_id)) {
                    const prompt = getLastPromptFromTranscript(row.conversation_id) || row.preview || '';
                    sessions.set(row.conversation_id, {
                      id: row.conversation_id,
                      agent: 'antigravity',
                      slot,
                      title: row.title || 'Antigravity ' + slot,
                      project: row.title || 'Antigravity ' + slot,
                      workspace: workspaceName,
                      cwd: workspacePath,
                      prompt,
                      gitStats: null,
                      background: hasBackground,
                      preview: row.preview || '',
                      state: 'ready',
                      detail: 'Klaar',
                      question: '',
                      permission: null,
                      startedAt: null,
                      endedAt: modTime,
                      updatedAt: modTime || now
                    });
                    changedAny = true;
                  } else {
                    const existing = sessions.get(row.conversation_id);
                    if (!existing.title && row.title) { existing.title = row.title; changedAny = true; }
                    if (workspaceName && !existing.workspace) { existing.workspace = workspaceName; changedAny = true; }
                    if (workspacePath && !existing.cwd) { existing.cwd = workspacePath; }
                    if (!existing.prompt) {
                      const p = getLastPromptFromTranscript(row.conversation_id) || row.preview || '';
                      if (p) { existing.prompt = p; changedAny = true; }
                    }
                    existing.background = hasBackground;
                    if (row.preview && !existing.preview) { existing.preview = row.preview; }
                  }
                }
              }
            }
          } catch {}
        }
      }

      // Inactivity watchdog: if an Antigravity session is marked running but has had no hook for > 30 seconds, mark it done
      for (const s of sessions.values()) {
        if (s.agent === 'antigravity' && s.state === 'running') {
          const lastActive = s.lastHookAt || s.updatedAt || s.startedAt;
          if (lastActive && (now - lastActive > 30000)) {
            s.state = 'done';
            s.endedAt = lastActive;
            s.detail = 'Klaar';
            for (const step of s.steps || []) {
              if (step.state === 'running') step.state = 'done';
            }
            changedAny = true;
          }
        }
      }

      if (changedAny) onChange();
    } finally {
      antigravityScanning = false;
    }
  }

  function initAntigravitySessionsSync() {
    try {
      const { DatabaseSync } = require('node:sqlite');
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      for (const { slot, path: dbPath } of getAntigravityDbPaths()) {
        if (fs.existsSync(dbPath)) {
          try {
            const db = new DatabaseSync(dbPath, { open: true, readOnly: true });
            const rows = db.prepare('SELECT conversation_id, title, preview, status, not_fully_idle, workspace_uris, last_modified_time FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 8').all();
            for (const row of rows) {
              if (row && row.conversation_id && !sessions.has(row.conversation_id)) {
                const modTime = new Date(row.last_modified_time).getTime();
                if (now - modTime < ONE_DAY_MS * 4) {
                  const isRunning = row.status === 'CASCADE_RUN_STATUS_RUNNING';
                  const hasBackground = Boolean(row.not_fully_idle && row.status !== 'CASCADE_RUN_STATUS_RUNNING');
                  const isBusy = isRunning || hasBackground;
                  let workspaceName = '';
                  let workspacePath = '';
                  if (row.workspace_uris) {
                    try {
                      const uris = JSON.parse(row.workspace_uris);
                      if (Array.isArray(uris) && uris.length && uris[0]) {
                        let u = String(uris[0]).replace(/^file:\/\/\/?/i, '').replace(/%3A/gi, ':');
                        if (!/^[a-zA-Z]:/.test(u) && /^\/[a-zA-Z]:/.test(u)) u = u.slice(1);
                        workspacePath = decodeURIComponent(u);
                        workspaceName = path.basename(workspacePath);
                      }
                    } catch {}
                  }
                  const prompt = getLastPromptFromTranscript(row.conversation_id) || row.preview || '';
                  sessions.set(row.conversation_id, {
                    id: row.conversation_id,
                    agent: 'antigravity',
                    slot,
                    title: row.title || 'Antigravity ' + slot,
                    project: row.title || 'Antigravity ' + slot,
                    workspace: workspaceName,
                    cwd: workspacePath,
                    prompt,
                    gitStats: null,
                    background: hasBackground,
                    preview: row.preview || '',
                    state: 'ready',
                    detail: 'Klaar',
                    question: '',
                    permission: null,
                    startedAt: null,
                    endedAt: modTime,
                    updatedAt: modTime || now
                  });
                }
              }
            }
          } catch {}
        }
      }
    } catch {}
  }
  initAntigravitySessionsSync();
  setInterval(syncAntigravitySessions, 20000).unref?.();

  function token() {
    const file = path.join(userData, 'claude-code-hook-token');
    try { const saved = fs.readFileSync(file, 'utf8').trim(); if (/^[a-f0-9]{48}$/.test(saved)) return saved; } catch {}
    const fresh = randomBytes(24).toString('hex');
    fs.mkdirSync(userData, { recursive: true }); fs.writeFileSync(file, fresh, { mode: 0o600 });
    return fresh;
  }

  // ---- settings.json ----
  const isReplyHook = hook => hook?.type === 'command' && typeof hook.command === 'string' && hook.command.includes('twocode-reply');
  const isOurs = hook => (typeof hook?.url === 'string' && hook.url.startsWith('http://127.0.0.1:' + PORT + ROUTE)) || isReplyHook(hook);
  const replyCommand = () => `node "${REPLY_SCRIPT}" ${token()}`;
  function readSettings() {
    try { return JSON.parse(fs.readFileSync(settingsFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('~/.claude/settings.json is geen geldige JSON. Er is niets veranderd.'); }
  }
  function ours() {
    try {
      const hooks = readSettings().hooks || {};
      return EVENTS.flatMap(event => (hooks[event] || []).flatMap(group => (group.hooks || []).filter(isOurs)));
    } catch { return []; }
  }
  // Our status line forwards your 5-hour / weekly usage. A status line you made yourself is never replaced.
  const isOurStatus = line => typeof line?.command === 'string' && line.command.includes('twocode-statusline');
  const statusCommand = () => `node "${STATUS_SCRIPT}" ${token()}`;
  function statusOk() {
    try { const line = readSettings().statusLine; return !line || !isOurStatus(line) ? Boolean(line) : line.command === statusCommand(); }
    catch { return false; }
  }
  const installed = () => {
    const list = ours();
    return list.length === EVENTS.length + 1 && list.every(h => (isReplyHook(h) ? h.command === replyCommand() : h.url === HOOK_URL)) && statusOk();
  };
  function writeSettings(settings) {
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    if (fs.existsSync(settingsFile)) fs.copyFileSync(settingsFile, settingsFile + '.twocode-backup');
    fs.writeFileSync(settingsFile + '.tmp', JSON.stringify(settings, null, 2) + '\n');
    fs.renameSync(settingsFile + '.tmp', settingsFile);
  }
  // Which Claude model Claude Code starts with (settings.json "model"). 'default' = Claude Code's own choice.
  const MODELS = ['default', 'opus', 'sonnet', 'haiku', 'opusplan'];
  let modelCache = null, modelAt = 0;
  function getModel() {
    if (modelCache && Date.now() - modelAt < 5000) return modelCache;
    try { const m = readSettings().model; modelCache = MODELS.includes(m) ? m : m ? 'custom:' + String(m) : 'default'; } catch { modelCache = 'default'; }
    modelAt = Date.now(); return modelCache;
  }
  function setModel(model) {
    if (!MODELS.includes(model)) throw new Error('Onbekend model.');
    const settings = readSettings(); if (model === 'default') delete settings.model; else settings.model = model;
    writeSettings(settings); modelCache = model; modelAt = Date.now(); onChange();
  }
  function strip(settings) {
    for (const event of Object.keys(settings.hooks || {})) {
      const groups = (settings.hooks[event] || [])
        .map(group => ({ ...group, hooks: (group.hooks || []).filter(hook => !isOurs(hook)) }))
        .filter(group => group.hooks.length);
      if (groups.length) settings.hooks[event] = groups; else delete settings.hooks[event];
    }
    if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
  }
  function install() {
    const settings = readSettings(); strip(settings); settings.hooks ||= {};
    for (const event of EVENTS) {
      const hook = { type: 'http', url: HOOK_URL, timeout: event === 'PermissionRequest' ? PERMISSION_WAIT_S + 5 : 2, headers: { 'X-TwoCode-Token': token() } };
      (settings.hooks[event] ||= []).push({ hooks: [hook] });
    }
    // Answer from the island: runs in the background after Claude stops; exit 2 wakes Claude with your text.
    settings.hooks.Stop.push({ hooks: [{ type: 'command', command: replyCommand(), asyncRewake: true, timeout: REPLY_WAIT_S + 10 }] });
    if (!settings.statusLine || isOurStatus(settings.statusLine)) settings.statusLine = { type: 'command', command: statusCommand(), padding: 0 };
    writeSettings(settings); changed(); return { ok: true };
  }
  function uninstall() {
    const settings = readSettings();
    if (ours().length || isOurStatus(settings.statusLine)) {
      strip(settings); if (isOurStatus(settings.statusLine)) delete settings.statusLine; writeSettings(settings);
    }
    for (const id of [...waiting.keys()]) release(id);
    for (const id of [...replies.keys()]) answer(id, '');
    sessions.clear(); changed(); return { ok: true };
  }

  // ---- Codex: ~/.codex/hooks.json ----
  // Codex runs a command for each event; curl.exe (in every Windows 10/11) passes the event on to TwoCode.
  // Codex asks you once to trust new hooks: that is Codex keeping you safe.
  const codexCommand = () => `curl.exe -s -m 3 -H "X-TwoCode-Token: ${token()}" -H "Content-Type: application/json" --data-binary @- "${HOOK_URL}&agent=codex"`;
  const isOurCodexHook = hook => hook?.type === 'command' && typeof hook.command === 'string' && hook.command.includes('127.0.0.1:' + PORT + ROUTE);
  // Codex is really on this PC: its command is on the PATH, or Codex itself has been used here (signed in, settings, chats).
  // The ~/.codex folder alone says nothing: TwoCode's own hooks.json can be all that is in it.
  const onPath = name => (process.env.PATH || '').split(path.delimiter).some(dir => dir && ['.exe', '.cmd', '.ps1', ''].some(ext => {
    try { return fs.statSync(path.join(dir, name + ext)).isFile(); } catch { return false; }
  }));
  const codexAvailable = () => ['auth.json', 'config.toml', 'sessions', 'history.jsonl', 'log'].some(f => fs.existsSync(path.join(codexHome, f))) || onPath('codex');
  function readCodex() {
    try { return JSON.parse(fs.readFileSync(codexFile, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('~/.codex/hooks.json is geen geldige JSON. Er is niets veranderd.'); }
  }
  function writeCodex(config) {
    fs.mkdirSync(codexHome, { recursive: true });
    if (fs.existsSync(codexFile)) fs.copyFileSync(codexFile, codexFile + '.twocode-backup');
    fs.writeFileSync(codexFile + '.tmp', JSON.stringify(config, null, 2) + '\n');
    fs.renameSync(codexFile + '.tmp', codexFile);
  }
  function stripCodex(config) {
    for (const event of Object.keys(config.hooks || {})) {
      const groups = (config.hooks[event] || []).map(group => ({ ...group, hooks: (group.hooks || []).filter(hook => !isOurCodexHook(hook)) })).filter(group => group.hooks.length);
      if (groups.length) config.hooks[event] = groups; else delete config.hooks[event];
    }
    if (config.hooks && !Object.keys(config.hooks).length) delete config.hooks;
  }
  function codexInstalled() {
    try {
      const hooks = readCodex().hooks || {}, cmd = codexCommand();
      return CODEX_EVENTS.every(event => (hooks[event] || []).some(group => (group.hooks || []).some(h => isOurCodexHook(h) && h.command === cmd)));
    } catch { return false; }
  }
  function installCodex() {
    const config = readCodex(); stripCodex(config); config.hooks ||= {};
    for (const event of CODEX_EVENTS) (config.hooks[event] ||= []).push({ hooks: [{ type: 'command', command: codexCommand(), timeout: 5, async: true, statusMessage: 'TwoCode' }] });
    writeCodex(config); changed(); return { ok: true };
  }
  function uninstallCodex() {
    const config = readCodex(); stripCodex(config); writeCodex(config);
    for (const [id, s] of sessions) if (s.agent === 'codex') sessions.delete(id);
    changed(); return { ok: true };
  }

  // ---- answers typed in the island (twocode-reply.cjs waits on WAIT_ROUTE) ----
  const replies = new Map(); // session id → { res, timer }
  function answer(id, text) {
    const wait = replies.get(id); if (!wait) return false;
    replies.delete(id); clearTimeout(wait.timer);
    try { wait.res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(text ? { reply: text } : { cancel: true })); } catch {}
    return true;
  }
  function holdReply(id, res) {
    if (!id) { res.writeHead(400).end(); return; }
    answer(id, ''); // an older wait for this session is stale
    replies.set(id, { res, timer: setTimeout(() => { answer(id, ''); onChange(); }, REPLY_WAIT_S * 1000) });
    res.on('close', () => { if (replies.get(id)?.res === res) { replies.delete(id); onChange(); } });
    onChange();
  }
  function reply(sessionId, text) {
    const clean = String(text || '').trim();
    if (!clean || clean.length > 5000) throw new Error('Typ een antwoord van maximaal 5000 tekens.');
    if (!answer(sessionId, clean)) throw new Error('Claude Code wacht niet meer op een antwoord. Typ het in de terminal.');
    const s = sessions.get(sessionId);
    if (s) { s.state = 'running'; s.detail = 'Je antwoord is verstuurd'; s.question = ''; s.startedAt = Date.now(); s.endedAt = null; }
    onChange(); return { ok: true };
  }

  // ---- permission answers ----
  function release(id, decision) {
    const wait = waiting.get(id); if (!wait) return false;
    waiting.delete(id); clearTimeout(wait.timer);
    const body = decision ? JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision } }) : '';
    try { wait.res.writeHead(200, body ? { 'content-type': 'application/json' } : {}).end(body); } catch {}
    return true;
  }
  function decide(sessionId, behavior) {
    if (!['allow', 'deny'].includes(behavior)) throw new Error('Kies toestaan of weigeren.');
    const s = sessions.get(sessionId);
    const decision = behavior === 'allow' ? { behavior: 'allow', updatedInput: s?.permissionInput || {} } : { behavior: 'deny', message: 'Geweigerd vanuit TwoCode.' };
    if (!release(sessionId, decision)) throw new Error('Deze vraag is al beantwoord, misschien in de terminal.');
    if (s) { s.permission = null; s.question = ''; s.state = 'running'; s.detail = behavior === 'allow' ? 'Toegestaan, gaat verder' : 'Geweigerd'; }
    onChange(); return { ok: true };
  }

  // Multiple-choice question (AskUserQuestion): answers map question text → chosen label(s) or your own text.
  function answerQuestions(sessionId, answers) {
    const s = sessions.get(sessionId);
    if (!s?.ask) throw new Error('Er staat geen keuzevraag meer open.');
    const clean = {};
    for (const q of s.ask) {
      const value = answers?.[q.question];
      const text = Array.isArray(value) ? value.map(String).filter(Boolean).join(', ') : String(value || '').trim();
      if (!text) throw new Error('Kies bij elke vraag een antwoord.');
      clean[q.question] = text.slice(0, 2000);
    }
    const decision = { behavior: 'allow', updatedInput: { ...s.permissionInput, answers: clean } };
    if (!release(sessionId, decision)) throw new Error('Deze vraag is al beantwoord, misschien in de terminal.');
    s.permission = null; s.ask = null; s.question = ''; s.state = 'running'; s.detail = 'Je antwoord is verstuurd';
    onChange(); return { ok: true };
  }
  // Plan mode (ExitPlanMode): approve the plan, or send it back with your feedback.
  function decidePlan(sessionId, approve, feedback) {
    const s = sessions.get(sessionId);
    if (!s?.plan) throw new Error('Er staat geen plan meer open.');
    const note = String(feedback || '').trim().slice(0, 4000);
    const decision = approve ? { behavior: 'allow', updatedInput: s.permissionInput || {} }
      : { behavior: 'deny', message: note ? 'De gebruiker wil het plan aanpassen: ' + note : 'De gebruiker wil het plan nog niet uitvoeren. Vraag wat er anders moet.' };
    if (!release(sessionId, decision)) throw new Error('Dit plan is al beantwoord, misschien in de terminal.');
    s.permission = null; s.plan = null; s.question = ''; s.state = 'running';
    s.detail = approve ? 'Toegestaan, gaat verder' : 'Je antwoord is verstuurd';
    onChange(); return { ok: true };
  }

  // From the status line: plan usage is account-wide, context is per session.
  function applyUsage(data) {
    const window = w => (w && Number.isFinite(w.used) ? { used: Math.max(0, Math.min(100, w.used)), resetsAt: Number(w.resets_at) || null } : null);
    usage = { fiveHour: window(data.five_hour) || usage.fiveHour, sevenDay: window(data.seven_day) || usage.sevenDay, at: Date.now() };
    const s = sessions.get(String(data.session_id || ''));
    if (s && Number.isFinite(data.context)) s.context = data.context;
    if (s) learnPid(s, data.pid);
    if (s && typeof data.model === 'string' && data.model) s.modelName = data.model.slice(0, 40); // the model this session really uses
    onChange();
  }

  // You looked at it: green, red and plain questions go back to quiet. An open permission stays.
  function seen() {
    for (const s of sessions.values()) {
      if (['done', 'error'].includes(s.state) || (s.state === 'question' && !waiting.has(s.id))) {
        s.state = 'ready'; s.detail = 'Gezien'; s.question = ''; s.permission = null;
      }
    }
    onChange(); return { ok: true };
  }

  // ---- events ----
  function apply(event, res, agent = 'claude') {
    const id = typeof event.session_id === 'string' ? event.session_id : '';
    const name = event.hook_event_name;
    const allowed = agent === 'codex' ? CODEX_EVENTS : agent === 'antigravity' ? ANTIGRAVITY_EVENTS : EVENTS;
    if (!id || !allowed.includes(name)) return false;
    const who = AGENTS[agent] || AGENTS.claude;
    if (agent === 'codex' || agent === 'antigravity') res = null; // Codex and Antigravity do not wait for the island: you answer in their own window
    // A finished tool or turn means the permission was answered elsewhere (terminal, phone).
    // PreToolUse is excluded: parallel tool calls may start while a permission is still open.
    if (!['PermissionRequest', 'Notification', 'PreToolUse'].includes(name)) release(id);
    // You typed in the terminal (or the session ended): the island answer is no longer needed.
    if (['UserPromptSubmit', 'SessionEnd'].includes(name)) answer(id, '');
    if (name === 'SessionEnd') { sessions.delete(id); onChange(); return false; }
    const now = Date.now();
    const s = sessions.get(id) || { id, agent, state: 'ready', detail: '', question: '', permission: null, startedAt: null, endedAt: null, updatedAt: now };
    s.agent = agent;
    s.lastHookAt = now;
    if (event.pid) learnPid(s, event.pid);
    if (typeof event.cwd === 'string') { s.project = path.basename(event.cwd); s.cwd = event.cwd; }
    if (event.title) s.title = event.title;
    if (event.model) s.modelName = event.model;
    s.updatedAt = now;
    const start = () => { if (!s.startedAt || s.endedAt) s.startedAt = now; s.endedAt = null; };
    let held = false;
    switch (name) {
      case 'SessionStart':
        s.state = 'ready'; s.detail = 'Klaar voor je vraag'; break;
      case 'UserPromptSubmit':
        s.startedAt = now; s.endedAt = null; s.state = 'running'; s.detail = who.short + ' is bezig'; s.question = ''; s.permission = null;
        s.ask = null; s.plan = null; s.stats = {}; s.steps = []; s.files = []; s.commands = []; s.code = null; s.run = null;
        s.prompt = String(event.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 240); s.lastMessage = '';
        if (!s.title && s.prompt) s.title = s.prompt.slice(0, 36); break;
      case 'PreInvocation': {
        const cleanPrompt = String(event.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 240);
        const isNewPrompt = Boolean(cleanPrompt && s.prompt && cleanPrompt !== s.prompt);
        const isTurnStart = !s.startedAt || s.state !== 'running' || isNewPrompt;

        s.state = 'running';
        s.endedAt = null;
        s.detail = 'Denkt na...';
        s.question = '';
        s.permission = null;
        s.ask = null;
        s.plan = null;

        if (cleanPrompt) s.prompt = cleanPrompt;
        if (!s.title && s.prompt) s.title = s.prompt.slice(0, 36);

        if (isTurnStart) {
          s.startedAt = now;
          s.stats = {};
          s.steps = [];
          s.files = [];
          s.commands = [];
          s.code = null;
          s.run = null;
          s.lastMessage = '';
        } else {
          for (const step of s.steps || []) {
            if (step.state === 'running') step.state = 'done';
          }
        }
        break;
      }
      case 'PreToolUse':
        start();
        if (event.prompt && !s.prompt) s.prompt = String(event.prompt).replace(/\s+/g, ' ').trim().slice(0, 240);
        if (!s.title && s.prompt) s.title = s.prompt.slice(0, 36);
        // Step list for the Claude page: what Claude is doing, one line per tool call.
        if (!['AskUserQuestion', 'ExitPlanMode'].includes(event.tool_name)) {
          s.steps ||= []; s.steps.push({ tool: String(event.tool_name || ''), kind: toolKind(event.tool_name) || 'other', label: toolLabel(event), what: toolDetail(event).slice(0, 120), state: 'running' });
          if (s.steps.length > 12) s.steps.shift();
          // For the summary: which files were changed and which commands were run.
          const input = event.tool_input || {};
          const file = input.file_path || input.Path || input.path ? path.basename(String(input.file_path || input.Path || input.path)) : '';
          const cmd = input.command || input.CommandLine || input.cmd || '';
          s.files ||= []; s.commands ||= [];
          if (toolKind(event.tool_name) === 'edit' && file && !s.files.includes(file)) s.files.push(file);
          if (toolKind(event.tool_name) === 'run' && cmd) s.commands.push(String(cmd).slice(0, 80));
          // The code changed right now (shown as a small red/green diff in the island).
          const edit = Array.isArray(input.edits) ? input.edits[0] || {} : input;
          const cut = text => String(text || '').split('\n').map(l => l.replace(/\t/g, '  ').slice(0, 90)).filter((l, i, all) => l.trim() || (i > 0 && i < all.length - 1));
          if (toolKind(event.tool_name) === 'edit' && file) {
            let removed = [], added = [];
            if (input.Target || input.Replacement) {
              removed = cut(input.Target).slice(0, 3).map(text => ({ t: '-', text }));
              added = cut(input.Replacement).slice(0, removed.length ? 3 : 6).map(text => ({ t: '+', text }));
            } else if (input.Content) {
              added = cut(input.Content).slice(0, 6).map(text => ({ t: '+', text }));
            } else {
              removed = cut(edit.old_string).slice(0, 3).map(text => ({ t: '-', text }));
              added = cut(edit.new_string ?? edit.content ?? input.content).slice(0, removed.length ? 3 : 6).map(text => ({ t: '+', text }));
            }
            let start = 1;
            try {
              const full = String(input.file_path || input.Path || input.path);
              const targetStr = String(input.Target || edit.old_string || '');
              if (targetStr && fs.statSync(full).size < 2e6) {
                const body = fs.readFileSync(full, 'utf8'), at = body.indexOf(targetStr);
                if (at >= 0) start = body.slice(0, at).split(/\r?\n/).length;
              }
            } catch {}
            s.code = { file, start, lines: [...removed, ...added] };
          }
          if (toolKind(event.tool_name) === 'run' && cmd) s.run = { command: String(cmd).slice(0, 80), out: [] };
        }
        if (waiting.has(id)) break;
        s.state = 'running'; s.detail = toolLabel(event, who.short); s.question = ''; s.permission = null; break;
      case 'PostToolUse': case 'PostToolUseFailure': {
        start(); s.state = 'running'; s.question = ''; s.permission = null; s.ask = null; s.plan = null;
        const kind = toolKind(event.tool_name); if (kind) { s.stats ||= {}; s.stats[kind] = (s.stats[kind] || 0) + 1; }
        const step = (s.steps || []).find(x => x.state === 'running' && x.tool === String(event.tool_name || '')) || (s.steps || []).find(x => x.state === 'running');
        if (step) step.state = name === 'PostToolUseFailure' ? 'failed' : 'done';
        // What the terminal said (last lines), for the island.
        if (kind === 'run' && s.run) {
          const r = event.tool_response || {};
          const text = typeof r === 'string' ? r : [r.output, r.stdout, r.stderr].filter(Boolean).join('\n');
          s.run.out = String(text).split('\n').map(l => l.trimEnd().slice(0, 90)).filter(Boolean).slice(-3);
          s.run.failed = name === 'PostToolUseFailure';
        }
        break;
      }
      case 'PermissionRequest': {
        release(id); // an older open request for this session is stale
        const input = event.tool_input && typeof event.tool_input === 'object' ? event.tool_input : {};
        s.permissionInput = input; s.ask = null; s.plan = null;
        s.state = 'question'; s.detail = 'Wil toestemming';
        s.permission = { kind: 'tool', tool: toolLabel(event, who.short), what: toolDetail(event) };
        if (event.tool_name === 'AskUserQuestion' && Array.isArray(input.questions)) {
          s.ask = input.questions.slice(0, 4).map(q => ({ question: String(q?.question || ''), header: String(q?.header || '').slice(0, 20),
            multiSelect: Boolean(q?.multiSelect), options: (Array.isArray(q?.options) ? q.options : []).slice(0, 6)
              .map(o => ({ label: String(o?.label || ''), description: String(o?.description || '') })) }));
          s.permission = { kind: 'ask', tool: who.short + ' vraagt iets', what: '' }; s.detail = 'Kies een antwoord';
        } else if (event.tool_name === 'ExitPlanMode') {
          s.plan = String(input.plan || '').slice(0, 20000);
          s.permission = { kind: 'plan', tool: 'Plan klaar', what: '' }; s.detail = 'Plan klaar: goedkeuren?';
        }
        s.question = s.ask ? s.ask.map(q => q.question).join('\n') : s.plan ? who.short + ' heeft een plan gemaakt.' : s.permission.tool + (s.permission.what ? ':\n' + s.permission.what : '');
        if (agent === 'codex') { s.detail = 'Wil toestemming: antwoord in Codex'; s.permission = null; s.ask = null; s.plan = null; }
        if (res) {
          waiting.set(id, { res, timer: setTimeout(() => { release(id); onChange(); }, PERMISSION_WAIT_S * 1000) });
          res.on('close', () => { if (waiting.get(id)?.res === res) { waiting.delete(id); onChange(); } });
          held = true;
        }
        onFinish(s); break;
      }
      case 'Notification': {
        const kind = event.notification_type || '';
        if (QUESTION_NOTIFICATIONS.has(kind) && s.state !== 'question') {
          s.state = 'question'; s.detail = 'Wacht op jou'; s.question = String(event.message || who.name + ' heeft je nodig.');
          onFinish(s);
        }
        break;
      }
      case 'PostInvocation': {
        // Tool execution completed; model continues reasoning/generating
        for (const step of s.steps || []) if (step.state === 'running') step.state = 'done';
        s.state = 'running';
        s.detail = 'Denkt na...';
        break;
      }
      case 'Stop': {
        const question = questionFrom(String(event.last_assistant_message || ''));
        s.endedAt = now; s.state = question ? 'question' : 'done'; s.permission = null; s.ask = null; s.plan = null;
        for (const step of s.steps || []) if (step.state === 'running') step.state = 'done';
        s.lastMessage = tail(String(event.last_assistant_message || s.prompt || ''), 2000);
        s.detail = question ? 'Heeft een vraag voor jou' : 'Klaar'; s.question = question ? s.lastMessage : '';
        if (event.prompt && !s.prompt) s.prompt = String(event.prompt).replace(/\s+/g, ' ').trim().slice(0, 240);
        if (!s.prompt) s.prompt = s.title || s.project || 'Antigravity sessie';
        remember(s, question ? 'question' : 'done');
        onFinish(s); break;
      }
      case 'StopFailure':
        s.endedAt = now; s.state = 'error'; s.permission = null; s.question = '';
        s.detail = 'Fout: ' + errorLabel(event.error_type || event.error); remember(s, 'error'); onFinish(s); break;
    }
    sessions.set(id, s); onChange();
    return held;
  }

  // ---- server ----
  function start() {
    if (server) return;
    if (ours().length && !installed()) { try { install(); } catch {} } // upgrade an older TwoCode install
    const expected = Buffer.from(token());
    server = http.createServer((req, res) => {
      const given = Buffer.from(String(req.headers['x-twocode-token'] || ''));
      const route = String(req.url).split('?')[0];
      if (req.method !== 'POST' || ![ROUTE, STATUS_ROUTE, WAIT_ROUTE].includes(route) || given.length !== expected.length || !timingSafeEqual(given, expected)) {
        res.writeHead(403).end(); req.resume(); return;
      }
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { body += chunk; if (body.length > 1_000_000) req.destroy(); });
      req.on('end', () => {
        let held = false;
        try {
          const data = JSON.parse(body);
          if (route === WAIT_ROUTE) {
            const s = sessions.get(String(data.session_id || ''));
            if (s) learnPid(s, data.pid); // for "jump to terminal"
            holdReply(String(data.session_id || ''), res); held = true;
          }
          else if (route === STATUS_ROUTE) applyUsage(data);
          else {
            const agentMatch = String(req.url).match(/[?&]agent=([a-z0-9_-]+)/i);
            const reqAgent = agentMatch ? agentMatch[1].toLowerCase() : 'claude';
            held = apply(data, res, reqAgent);
          }
        } catch {}
        if (!held) res.writeHead(200).end(); // Empty body: Claude Code continues as normal.
      });
    });
    server.on('error', error => {
      listening = false; server = null;
      serverError = error.code === 'EADDRINUSE' ? 'TwoCode draait al ergens anders (poort ' + PORT + ' is bezet). Sluit de andere TwoCode.' : error.message;
      onChange();
    });
    server.listen(PORT, '127.0.0.1', () => {
      listening = true; serverError = ''; onChange();
    });
  }
  function stop() { for (const id of [...waiting.keys()]) release(id); for (const id of [...replies.keys()]) answer(id, ''); try { server?.close(); } catch {} server = null; listening = false; }

  // One entry for the island: the session that needs you most first.
  let codexCache = false, codexThere = false;
  function view(agent = 'claude') {
    const who = AGENTS[agent] || AGENTS.antigravity || AGENTS.claude;
    const list = [...sessions.values()].filter(s => (s.agent || 'claude') === agent).sort((a, b) => (RANK[b.state] - RANK[a.state]) || (b.updatedAt - a.updatedAt));
    const now = Date.now();
    let top = null;
    if (activeSessionId && sessions.has(activeSessionId)) {
      const chosen = sessions.get(activeSessionId);
      if ((chosen.agent || 'claude') === agent) top = chosen;
    }
    if (!top) top = list[0];
    if (now - checkedAt > 5000) { hooksCache = installed(); codexCache = codexInstalled(); codexThere = codexAvailable(); checkedAt = now; } // the files are read at most every 5 s
    const hooks = agent === 'antigravity' ? true : (agent === 'codex' ? codexCache : hooksCache);
    const base = { provider: who.id, name: who.name, agent, kind: 'hooks', hooksInstalled: hooks, available: agent === 'codex' ? codexThere : true,
      model: agent === 'antigravity' ? 'Gemini 3.8' : (agent === 'codex' ? '' : getModel()), modelNow: top?.modelName || '', canReply: false, questionId: '', error: serverError,
      usage: { fiveHour: live(usage.fiveHour, now), sevenDay: live(usage.sevenDay, now), context: top?.context ?? null } };
    if (!hooks || !listening) return { ...base, connected: false, state: 'disconnected', detail: hooks ? 'Niet actief' : 'Niet gekoppeld', question: '', elapsed: 0, list: [] };
    const item = s => ({ id: s.id, title: s.title || s.project || who.name, project: s.title || s.project || who.name, state: s.state, detail: s.detail,
      active: Boolean(top && s.id === top.id),
      elapsed: s.startedAt ? Math.floor(((s.endedAt || now) - s.startedAt) / 1000) : 0,
      stepCount: s.stepCount || 0,
      workspace: s.workspace || '',
      preview: s.preview || '',
      prompt: s.prompt || '',
      gitStats: s.gitStats || null,
      background: Boolean(s.background) });
    if (!top) return { ...base, connected: true, state: 'ready', detail: 'Wacht op ' + who.name, question: '', elapsed: 0, list: [] };
    const activeGitStats = (top.cwd ? getGitStats(top.cwd) : null) || top.gitStats || null;
    return { ...base, connected: true, state: top.state, detail: top.detail, question: top.question, elapsed: item(top).elapsed,
      sessionId: top.id, title: top.title || top.project || who.name, lastMessage: top.lastMessage || '', ask: waiting.has(top.id) ? top.ask || null : null,
      plan: waiting.has(top.id) ? top.plan || null : null, stats: top.stats || {}, steps: (top.steps || []).slice(-8), prompt: top.prompt || '', files: (top.files || []).slice(-8), commands: (top.commands || []).slice(-3), code: top.code || null, run: top.run || null, canJump: Boolean(top.pid), canReply: replies.has(top.id) && !waiting.has(top.id), permission: top.permission && waiting.has(top.id) ? top.permission : null,
      source: { process: who.name, title: top.title || top.project }, list: list.slice(0, 8).map(item),
      stepCount: top.stepCount || 0,
      workspace: top.workspace || '',
      preview: top.preview || '',
      gitStats: activeGitStats,
      background: Boolean(top.background) };
  }
  const pidOf = sessionId => sessions.get(sessionId)?.pid || null;
  // The window was closed: learn it again from the next hook.
  const forgetWindow = sessionId => { const s = sessions.get(sessionId); if (s) { s.windowPid = null; s.pid = null; } };
  // The folders your coding agents worked in (newest first), so Robo knows where "my-shop" lives.
  function projects() {
    const seen = new Map();
    for (const s of [...sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt)) if (s.cwd && !seen.has(s.cwd)) seen.set(s.cwd, { name: path.basename(s.cwd), cwd: s.cwd, agent: s.agent || 'claude' });
    for (const h of history) if (h.cwd && !seen.has(h.cwd)) seen.set(h.cwd, { name: path.basename(h.cwd), cwd: h.cwd, agent: h.agent || 'claude' });
    return [...seen.values()];
  }
  return { projects, start, stop, install, uninstall, installed, installCodex, uninstallCodex, codexInstalled, codexAvailable, history: () => history.slice(), view, apply, applyUsage, decide, seen, reply, answerQuestions, decidePlan, selectSession, pidOf, forgetWindow, getModel, setModel, PORT };
}

// Groups for "what Claude did" (read 3 · edited 2 · ran 1 ...).
function toolKind(tool) {
  if (/^(Read|read_file|read_text_file)$/i.test(tool)) return 'read';
  if (/^(Edit|Write|MultiEdit|NotebookEdit|edit_file|write_file|apply_patch)$/i.test(tool)) return 'edit';
  if (/^(Bash|PowerShell|shell|exec_command|local_shell|unified_exec|run_command)$/i.test(tool)) return 'run';
  if (/^(Grep|Glob|search|file_search)$/i.test(tool)) return 'search';
  if (/^(WebSearch|WebFetch|search_web)$/i.test(tool)) return 'web';
  if (/^(Agent|Task|invoke_subagent)$/i.test(tool)) return 'agent';
  if (/^ask_question$/i.test(tool)) return 'question';
  return '';
}
function toolLabel(event, who = 'Antigravity') {
  const tool = String(event.tool_name || '');
  const input = event.tool_input || {};
  const rawFile = input.file_path || input.Path || input.path || '';
  const file = rawFile ? path.basename(String(rawFile)) : '';
  const cmd = input.command || input.CommandLine || input.cmd || '';
  if (/^(Read|read_file|read_text_file)$/i.test(tool)) return 'Leest ' + (file || 'een bestand');
  if (/^(Edit|Write|MultiEdit|NotebookEdit|edit_file|write_file)$/i.test(tool)) return 'Bewerkt ' + (file || 'een bestand');
  if (/^(Bash|PowerShell|shell|exec_command|local_shell|unified_exec|run_command)$/i.test(tool)) {
    return cmd ? cmd.slice(0, 60) : 'Voert een opdracht uit';
  }
  if (/^(Grep|Glob|search|file_search)$/i.test(tool)) return 'Zoekt in de code';
  if (/^(WebSearch|WebFetch|search_web)$/i.test(tool)) return 'Zoekt op internet';
  if (/^(Agent|Task|invoke_subagent)$/i.test(tool)) return 'Start een helper';
  if (/^ask_question$/i.test(tool)) return 'Stelt een vraag';
  if (/^apply_patch$/i.test(tool)) return 'Bewerkt bestanden';
  return tool ? tool + (cmd ? ': ' + cmd.slice(0, 40) : file ? ': ' + file : '') : who + ' is bezig';
}
// What exactly will happen, so you can judge before allowing.
function toolDetail(event) {
  const input = event.tool_input || {};
  const text = input.command || input.CommandLine || input.cmd || input.file_path || input.Path || input.path || input.url || input.query || input.Prompt || input.pattern || '';
  return String(text).slice(0, 300);
}
// After its reset time a usage window starts again at 0%.
const live = (w, now) => (w && w.resetsAt && w.resetsAt * 1000 <= now ? { used: 0, resetsAt: null } : w);
// The end of a long message, starting at a whole line where possible.
function tail(text, max) {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(-max), line = cut.indexOf('\n');
  return '…' + (line > 0 && line < max / 2 ? cut.slice(line + 1) : cut);
}
function errorLabel(type) {
  const labels = { rate_limit: 'limiet bereikt', overloaded: 'Claude is overbelast', authentication_failed: 'niet ingelogd',
    billing_error: 'betaalprobleem', server_error: 'serverfout', max_output_tokens: 'antwoord te lang' };
  return labels[type] || String(type || 'onbekend');
}

module.exports = { createHub, EVENTS, CODEX_EVENTS, PORT, HOOK_URL };
