'use strict';
// Antigravity 2.0 lifecycle hook adapter for TwoCode.
// Receives lifecycle events on stdin, forwards to TwoCode HTTP hook server, and replies {"decision":"allow"}.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT = 47823;
const ROUTE = '/twocode-hook';
const eventName = process.argv[2] || 'PreToolUse';

function getToken() {
  const candidates = [];
  const winUser = process.env.USERNAME || process.env.USER || '';
  if (winUser) {
    candidates.push(path.join('C:', 'Users', winUser, 'AppData', 'Roaming', 'twocode-assistent-electron', 'claude-code-hook-token'));
  }
  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'twocode-assistent-electron', 'claude-code-hook-token'));
  }
  try {
    const usersDir = 'C:\\Users';
    if (fs.existsSync(usersDir)) {
      for (const u of fs.readdirSync(usersDir)) {
        if (!['Public', 'Default', 'Default User', 'All Users'].includes(u)) {
          candidates.push(path.join(usersDir, u, 'AppData', 'Roaming', 'twocode-assistent-electron', 'claude-code-hook-token'));
        }
      }
    }
  } catch {}
  candidates.push(path.join(os.homedir(), 'AppData', 'Roaming', 'twocode-assistent-electron', 'claude-code-hook-token'));

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const val = fs.readFileSync(p, 'utf8').trim();
        if (/^[a-f0-9]{48}$/.test(val)) {
          return val;
        }
      }
    } catch {}
  }
  return '';
}

function getConversationTitle(conversationId, artifactDir, lastUserInput) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const possiblePaths = [];
    if (artifactDir) {
      possiblePaths.push(path.resolve(artifactDir, '../../conversation_summaries.db'));
    }
    possiblePaths.push(path.join(os.homedir(), '.gemini', 'antigravity', 'conversation_summaries.db'));

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const db = new DatabaseSync(p, { open: true, readOnly: true });
          const row = db.prepare('SELECT title FROM conversation_summaries WHERE conversation_id = ?').get(conversationId);
          if (row && row.title && row.title.trim()) {
            return row.title.trim();
          }
        } catch {}
      }
    }
  } catch {}

  if (lastUserInput) {
    const clean = String(lastUserInput)
      .replace(/<USER_REQUEST>[\s\S]*?<\/USER_REQUEST>/g, '')
      .replace(/PS [A-Z]:\\[^\n]*/g, '')
      .replace(/[\r\n]+/g, ' ')
      .trim();
    if (clean) return clean.slice(0, 80);
  }

  return '';
}

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  let payload = {};
  try {
    if (inputData.trim()) {
      payload = JSON.parse(inputData);
    }
  } catch {}


  const sessionId = payload.conversationId || payload.conversation_id || payload.session_id || 'antigravity-session';
  const toolCall = payload.toolCall || payload.tool_call || payload.tool || {};
  const toolName = payload.tool_name || toolCall.name || payload.name || '';
  const toolInput = payload.tool_input || toolCall.args || toolCall.parameters || toolCall.input || payload.args || {};
  const cwd = Array.isArray(payload.workspacePaths) && payload.workspacePaths.length
    ? payload.workspacePaths[0]
    : (payload.cwd || payload.workspaceDir || process.cwd());
  const rawPrompt = payload.prompt || payload.lastUserInput || payload.userPrompt || payload.input || '';
  const prompt = String(rawPrompt)
    .replace(/<\/?USER_REQUEST>/g, '')
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, '')
    .trim();
  const rawTitle = payload.title || payload.conversation_title || payload.conversationTitle || payload.windowTitle || '';
  const title = rawTitle || getConversationTitle(sessionId, payload.artifactDirectoryPath, prompt);
  const toolResponse = payload.toolResult || payload.tool_response || payload.toolOutput || payload.result || '';
  const modelName = payload.modelName || 'gemini-3.8-flash-high';

  const hookPayload = {
    session_id: sessionId,
    hook_event_name: eventName,
    pid: process.ppid,
    cwd,
    title,
    prompt,
    model: modelName,
    invocation_num: payload.invocationNum ?? payload.invocation_num ?? 0,
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse
  };

  const body = JSON.stringify(hookPayload);
  const token = getToken();

  const req = http.request(
    {
      hostname: '127.0.0.1',
      port: PORT,
      path: ROUTE + '?agent=antigravity',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-TwoCode-Token': token
      },
      timeout: 1000
    },
    res => {
      res.resume();
    }
  );

  req.on('error', () => {});
  req.on('timeout', () => req.destroy());
  req.write(body);
  req.end();

  // Always respond to Antigravity immediately so agent never blocks
  const isStepsHook = process.argv[2] === 'PreInvocation' || process.argv[2] === 'SessionStart' || process.argv[2] === 'PostInvocation';
  const output = isStepsHook ? { injectSteps: [] } : { decision: 'allow' };
  process.stdout.write(JSON.stringify(output) + '\n');
});

