'use strict';
(function monitorIsland() {
  const api = window.twocode;
  if (!api?.aiMonitorGet) return;
  const names = { chatgpt: 'ChatGPT', claude: 'Claude', claudecode: 'Claude Code', codex: 'Codex', antigravity: 'Antigravity' };
  // The AIs TwoCode can follow: the coding agents (hooks) and the chat apps (their window).
  const PICKS = [['antigravity', 'Antigravity'], ['claudecode', 'Claude Code'], ['codex', 'Codex'], ['claude', 'Claude'], ['chatgpt', 'ChatGPT']];
  const colours = { running: '#ff9a1f', sending: '#ff9a1f', question: '#ff9a1f', error: '#ff3b3b',
    stopped: '#ff3b3b', unavailable: '#ff3b3b', done: '#22e05a', ready: '#b8c0b5',
    connecting: '#b8c0b5', disconnected: '#7e887a', login: '#7e887a' };
  const labels = { running: 'Bezig', sending: 'Versturen', question: 'Vraag', error: 'Fout', stopped: 'Gestopt',
    unavailable: 'Niet beschikbaar', done: 'Klaar', ready: 'Ready', connecting: 'Verbinden', disconnected: 'Niet verbonden', login: 'Inloggen' };
  let state = { providers: Object.keys(names).map(provider => ({ provider, name: names[provider], state: 'disconnected', detail: 'Verbind jouw gesprek' })) };
  let selected = 'antigravity', choosing = false, windows = [], error = '', pending = false, lastSignature = '';
  const drafts = new Map();
  const root = document.createElement('section'); root.id = 'twocode-ai-monitor'; document.body.appendChild(root);
  const statusReader = document.createElement('div'); statusReader.id = 'twocode-ai-monitor-status';
  statusReader.setAttribute('role', 'status'); statusReader.setAttribute('aria-live', 'polite'); document.body.appendChild(statusReader);
  const style = document.createElement('style'); style.textContent = `
#twocode-ai-monitor{position:absolute;z-index:60;display:none;color:#f4f7ef;font:12px/1.4 Inter, "Segoe UI", sans-serif;pointer-events:auto;user-select:text}
#twocode-ai-monitor *{box-sizing:border-box}
#twocode-ai-monitor-status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);pointer-events:none}
#twocode-ai-monitor .am-shell{height:100%;display:flex;flex-direction:column;gap:7px;min-height:0;padding-bottom:4px}
#twocode-ai-monitor .am-head{display:flex;align-items:center;gap:8px;flex:none}
#twocode-ai-monitor .am-head strong{font-size:17px;flex:1}
#twocode-ai-monitor .am-hint{color:#c2ccbd;font-size:11px}
#twocode-ai-monitor button{border:1px solid #394333;border-radius:12px;padding:7px 11px;color:#eef3e8;background:#252c22;font:600 11px Inter, "Segoe UI", sans-serif;cursor:pointer}
#twocode-ai-monitor button:hover{background:#343e2d}
#twocode-ai-monitor button:focus-visible,#twocode-ai-monitor textarea:focus-visible{outline:2px solid #c6e994;outline-offset:2px}
#twocode-ai-monitor button:disabled{opacity:.5;cursor:default}
#twocode-ai-monitor .am-primary{background:#c6e994;color:#172011;border-color:#c6e994}
#twocode-ai-monitor .am-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-content:center;flex:1;min-height:0}
#twocode-ai-monitor .am-card{text-align:left;border:1px solid #404939;border-radius:17px;background:#192016;padding:14px;display:flex;flex-direction:column;gap:8px;min-width:0;font-weight:400}
#twocode-ai-monitor .am-card b{font-size:15px}
#twocode-ai-monitor .am-card .am-row{font-weight:600}
#twocode-ai-monitor .am-legend{display:flex;gap:14px;flex:none}
#twocode-ai-monitor .cc-status{display:inline-flex;align-items:center;gap:7px;margin-top:8px;padding:6px 11px;border-radius:14px;background:#121512;border:1px solid rgba(255,255,255,.08);font-weight:700;font-size:11px;white-space:nowrap}
#twocode-ai-monitor .cc-status i{width:8px;height:8px;border-radius:50%;background:var(--lamp);box-shadow:0 0 8px var(--lamp);display:block}
#twocode-ai-monitor .cc-icon{margin-top:6px;width:32px;height:30px;padding:0;font-size:14px}
#twocode-ai-monitor .cc-kicker{margin:6px 0 0;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9aa596}
#twocode-ai-monitor .cc-kicker + .tc-page-title{margin-top:1px}
#twocode-ai-monitor .cc-grid{display:grid;grid-template-columns:168px 1fr;gap:14px;flex:1;min-height:0;align-items:start}
#twocode-ai-monitor .cc-steps{display:flex;flex-direction:column;gap:2px;min-height:0;overflow:hidden;position:relative}
#twocode-ai-monitor .cc-steps::before{content:'';position:absolute;left:9px;top:14px;bottom:44px;width:1px;background:rgba(255,255,255,.08)}
#twocode-ai-monitor .cc-step{display:flex;gap:8px;align-items:flex-start;padding:5px 2px;min-width:0}
#twocode-ai-monitor .cc-step span{display:flex;flex-direction:column;min-width:0}
#twocode-ai-monitor .cc-step em{font-style:normal;font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;gap:6px;align-items:baseline}
#twocode-ai-monitor .cc-step em i{font-style:normal;font-weight:600;font-size:10px;color:#7f8a7a}
#twocode-ai-monitor .cc-step.todo em{color:#5d6858}
#twocode-ai-monitor .cc-step.running em{color:#ffb35c}
#twocode-ai-monitor .cc-step small{color:#7f8a7a;font:10px Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .cc-step.done em{color:#aab4a5}
#twocode-ai-monitor .cc-step b{flex:none;width:19px;height:19px;border-radius:50%;display:grid;place-items:center;font-size:10px;margin-top:0;position:relative;z-index:1;background:#000}
#twocode-ai-monitor .cc-ok{background:#163d22;color:#22e05a}
#twocode-ai-monitor .cc-bad{background:#3d1616;color:#ff5c5c}
#twocode-ai-monitor .cc-dot{border:1.5px solid #2c342a}
#twocode-ai-monitor .cc-spin{border:2px solid rgba(255,154,31,.25);border-top-color:#ff9a1f;animation:cc-spin .8s linear infinite}
@keyframes cc-spin{to{transform:rotate(360deg)}}
#twocode-ai-monitor .cc-limit{margin-top:auto;display:grid;grid-template-columns:1fr auto;gap:4px 8px;font-size:10px;color:#9aa596;padding:6px 2px 2px}
#twocode-ai-monitor .cc-limit b{color:#e8eee4}
#twocode-ai-monitor .cc-limit div{grid-column:1/-1;height:4px;border-radius:3px;background:#232a22;overflow:hidden}
#twocode-ai-monitor .cc-limit i{display:block;height:100%;border-radius:3px}
#twocode-ai-monitor .cc-card{background:linear-gradient(180deg,#121612,#0c0f0c);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:13px 15px;display:flex;flex-direction:column;gap:8px;min-height:0;max-height:100%;overflow:auto;scrollbar-width:thin}
#twocode-ai-monitor .cc-wide{align-items:flex-start}
#twocode-ai-monitor .cc-center{justify-content:center}
#twocode-ai-monitor .cc-label{color:#9aa596;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
#twocode-ai-monitor .cc-big{margin:0;font-size:15px;font-weight:700}
#twocode-ai-monitor .cc-red{color:#ff8a8a}
#twocode-ai-monitor .cc-code{display:block;font:11px/1.45 Consolas,monospace;color:#ffd7ab;background:#151915;border-radius:8px;padding:6px 8px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:56px;overflow:auto}
#twocode-ai-monitor .cc-msg{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;flex:1;min-height:0;overflow:auto}
#twocode-ai-monitor .cc-actions{display:flex;gap:8px;align-items:center;margin-top:auto}
#twocode-ai-monitor .cc-actions .am-note{flex:1}
#twocode-ai-monitor .am-ask{margin-bottom:8px}
#twocode-ai-monitor .am-tag{display:inline-block;background:#2a3227;color:#c6e994;border-radius:8px;padding:1px 7px;margin-right:6px;font-size:10px;font-weight:700}
#twocode-ai-monitor .am-options{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0}
#twocode-ai-monitor .cc-solo{grid-template-columns:1fr}
#twocode-ai-monitor .cc-fit{scrollbar-width:none}
#twocode-ai-monitor .cc-fit .am-ask{margin:0}
#twocode-ai-monitor .cc-inline{display:flex;gap:8px;align-items:center}
#twocode-ai-monitor .cc-inline .am-note{flex:1;min-width:0}
#twocode-ai-monitor .cc-inline .am-primary{flex:none;padding:9px 18px}
#twocode-ai-monitor *{scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.16) transparent}
#twocode-ai-monitor ::-webkit-scrollbar{width:6px;height:6px}
#twocode-ai-monitor ::-webkit-scrollbar-track{background:transparent}
#twocode-ai-monitor ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}
#twocode-ai-monitor ::-webkit-scrollbar-button{display:none}
#twocode-ai-monitor .am-option:hover{border-color:rgba(255,179,92,.6);background:rgba(255,179,92,.08)}
#twocode-ai-monitor .am-option{display:flex;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;font-weight:400;padding:10px 12px;border-radius:12px;min-width:0}
#twocode-ai-monitor .am-option small{color:#aab4a5;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
#twocode-ai-monitor .am-option.on{background:#ff9a1f;color:#1a1206;border-color:#ff9a1f}
#twocode-ai-monitor .am-option.on small{color:#3b2a0f}
#twocode-ai-monitor .am-note{flex:1;min-width:0;border:1px solid #536046;border-radius:10px;padding:6px 9px;background:#141b11;color:#f5f8f1;font:12px Inter, "Segoe UI", sans-serif;width:100%}
#twocode-ai-monitor .am-row .am-note{width:auto}
#twocode-ai-monitor .am-plan{border-left:3px solid #4cc9f0;padding:2px 10px;font-size:12px}
#twocode-ai-monitor .am-plan h4{margin:6px 0 2px;font-size:13px}
#twocode-ai-monitor .am-plan p{margin:2px 0}
#twocode-ai-monitor .am-plan code,#twocode-ai-monitor .am-li code{font:11px Consolas,monospace;color:#ffd7ab}
#twocode-ai-monitor .am-jump{margin-left:auto}
#twocode-ai-monitor .am-jump + .am-quiet{margin-left:0}
#twocode-ai-monitor .am-said{color:#aab4a5;font-size:11px;margin-bottom:3px}
#twocode-ai-monitor .am-question.am-done{border-left-color:#22e05a}
#twocode-ai-monitor .am-usage{flex:none}
#twocode-ai-monitor .am-lead{font-size:13px;margin:0 0 8px}
#twocode-ai-monitor .am-question b{display:block;margin-bottom:4px}
#twocode-ai-monitor .am-question code{display:block;font:11px/1.4 Consolas,monospace;color:#ffd7ab;white-space:pre-wrap;overflow-wrap:anywhere;max-height:70px;overflow:auto}
#twocode-ai-monitor .am-list{margin-top:8px;display:flex;flex-direction:column;gap:4px}
#twocode-ai-monitor .am-item{background:#151a13;border-radius:10px;padding:5px 9px;min-width:0}
#twocode-ai-monitor .am-item b{flex:none;max-width:40%}
#twocode-ai-monitor .am-quiet{margin-left:auto;background:transparent;border-color:transparent;color:#aab4a5}
#twocode-ai-monitor .am-quiet:hover{background:#2a1f1d;color:#ffaba3}
#twocode-ai-monitor .am-row{display:flex;align-items:center;gap:8px;flex:none}
#twocode-ai-monitor .am-dot{width:9px;height:9px;border-radius:50%;background:var(--lamp);box-shadow:0 0 10px color-mix(in srgb,var(--lamp),transparent 50%);display:inline-block;flex:none}
#twocode-ai-monitor .am-blink{animation:am-pulse 1.3s ease-in-out infinite}
#twocode-ai-monitor .am-body{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#536248 transparent}
#twocode-ai-monitor .am-question{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;border-left:3px solid #ffa94b;padding:3px 10px}
#twocode-ai-monitor .am-compose{display:flex;gap:8px;align-items:flex-end;flex:none}
#twocode-ai-monitor textarea{resize:none;flex:1;min-width:0;height:52px;border:1px solid #536046;border-radius:12px;padding:9px;background:#141b11;color:#f5f8f1;font:12px/1.4 Inter, "Segoe UI", sans-serif;user-select:text}
#twocode-ai-monitor .am-error{color:#ffaba3;font-size:11px;overflow-wrap:anywhere;max-height:44px;overflow:auto}
#twocode-ai-monitor .am-track{height:4px;overflow:hidden;border-radius:6px;background:#35402d;flex:none}
#twocode-ai-monitor .am-wave{width:35%;height:100%;background:#ffa94b;animation:am-travel 1.5s ease-in-out infinite}
#twocode-ai-monitor .am-clock{margin-left:auto;color:#d1dacb;font-variant-numeric:tabular-nums;font-size:11px}
#twocode-ai-monitor .am-window{display:block;width:100%;text-align:left;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#twocode-ai-monitor .am-source{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
@keyframes am-pulse{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes am-travel{0%{transform:translateX(-100%)}100%{transform:translateX(380%)}}
#twocode-ai-monitor .cx-jump{margin-top:10px;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:12px;background:#151915;border:1px solid rgba(255,255,255,.1);color:#e8eee4;font-size:11px;font-weight:600;white-space:nowrap}
#twocode-ai-monitor .cx-jump:hover{background:#1e241d;border-color:rgba(255,255,255,.22)}
#twocode-ai-monitor .cx-jump span{color:#9aa596}
#twocode-ai-monitor .cx-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:12px;flex:1;min-height:0}
#twocode-ai-monitor .cx-hero{position:relative;display:flex;gap:16px;padding:16px 18px;border-radius:18px;border:1px solid rgba(255,255,255,.07);background:linear-gradient(160deg,#151a15,#0b0d0b);min-height:0;overflow:hidden}
#twocode-ai-monitor .cx-hero::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 0% 0%,var(--glow,transparent),transparent 60%);opacity:.18}
#twocode-ai-monitor .cx-orange{--glow:#ff9a1f}
#twocode-ai-monitor .cx-green{--glow:#22e05a}
#twocode-ai-monitor .cx-red{--glow:#ff3b3b}
#twocode-ai-monitor .cx-light{position:relative;flex:none;align-self:flex-start;display:flex;flex-direction:column;gap:6px;padding:7px 6px;border-radius:14px;background:#050605;border:1px solid rgba(255,255,255,.08)}
#twocode-ai-monitor .cx-light i{display:block;width:14px;height:14px;border-radius:50%;opacity:.16;transition:opacity .3s}
#twocode-ai-monitor .cx-light .red{background:#ff3b3b}
#twocode-ai-monitor .cx-light .orange{background:#ff9a1f}
#twocode-ai-monitor .cx-light .green{background:#22e05a}
#twocode-ai-monitor .cx-light i.on{opacity:1;box-shadow:0 0 12px currentColor}
#twocode-ai-monitor .cx-light .red.on{color:#ff3b3b}
#twocode-ai-monitor .cx-light .orange.on{color:#ff9a1f}
#twocode-ai-monitor .cx-light .green.on{color:#22e05a}
#twocode-ai-monitor .cx-light i.blink{animation:am-pulse 1.1s ease-in-out infinite}
#twocode-ai-monitor .cx-main{position:relative;flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;min-height:0}
#twocode-ai-monitor .cx-label{display:flex;align-items:center;gap:8px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9aa596}
#twocode-ai-monitor .cx-label em{font-style:normal;color:#c2ccbd}
#twocode-ai-monitor .cx-label em.orange{color:#ffb35c}
#twocode-ai-monitor .cx-label em.green{color:#5ee88a}
#twocode-ai-monitor .cx-label em.red{color:#ff8a8a}
#twocode-ai-monitor .cx-label span{letter-spacing:0;text-transform:none;font-weight:600}
#twocode-ai-monitor .cx-timer{font-variant-numeric:tabular-nums;color:#e8eee4}
#twocode-ai-monitor .cx-title{margin:0;font-size:18px;font-weight:700;line-height:1.25;color:#fff;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#twocode-ai-monitor .cx-code{display:block;font:11px/1.4 Consolas,monospace;color:#ffd7ab;background:rgba(255,255,255,.05);border-radius:8px;padding:5px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .cx-prompt{margin-top:auto;display:flex;flex-direction:column;gap:2px;padding-top:8px;border-top:1px solid rgba(255,255,255,.06)}
#twocode-ai-monitor .cx-prompt span{font-size:10px;font-weight:700;color:#7f8a7a;letter-spacing:.06em;text-transform:uppercase}
#twocode-ai-monitor .cx-prompt q{font-size:12px;color:#c2ccbd;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;quotes:'“' '”'}
#twocode-ai-monitor .cx-msg{flex:1;min-height:0;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12.5px;line-height:1.5;color:#eef3e8;padding-right:4px}
#twocode-ai-monitor .cx-compose textarea{height:38px;padding:9px 10px;border-radius:11px;background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.12)}
#twocode-ai-monitor .cx-compose .am-primary{padding:9px 16px}
#twocode-ai-monitor .cx-side{display:flex;flex-direction:column;gap:6px;padding:12px 12px 10px;border-radius:18px;border:1px solid rgba(255,255,255,.07);background:#0d100d;min-height:0;min-width:0}
#twocode-ai-monitor .cx-side-head{display:flex;justify-content:space-between;align-items:baseline;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9aa596;padding:0 2px}
#twocode-ai-monitor .cx-side-head small{letter-spacing:0;text-transform:none;font-weight:600;color:#7f8a7a}
#twocode-ai-monitor .cx-feed{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;gap:2px;-webkit-mask-image:linear-gradient(#000 78%,transparent);mask-image:linear-gradient(#000 78%,transparent)}
#twocode-ai-monitor .cx-step{display:flex;align-items:center;gap:9px;padding:4px 2px;min-width:0}
#twocode-ai-monitor .cx-ico{flex:none;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,.05);color:#c2ccbd}
#twocode-ai-monitor .cx-step.running .cx-ico{background:rgba(255,154,31,.14);color:#ffb35c}
#twocode-ai-monitor .cx-txt{flex:1;min-width:0;display:flex;flex-direction:column}
#twocode-ai-monitor .cx-txt em{font-style:normal;font-size:11.5px;font-weight:600;color:#e8eee4}
#twocode-ai-monitor .cx-step.done .cx-txt em{color:#aab4a5}
#twocode-ai-monitor .cx-txt small{font:10px Consolas,monospace;color:#7f8a7a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .cx-step > b{flex:none;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-size:9px}
#twocode-ai-monitor .cx-ok{color:#22e05a;background:rgba(34,224,90,.12)}
#twocode-ai-monitor .cx-bad{color:#ff5c5c;background:rgba(255,92,92,.12)}
#twocode-ai-monitor .cx-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#5d6858;font-size:11px;text-align:center}
#twocode-ai-monitor .cx-limit{display:flex;flex-direction:column;gap:4px;padding:8px 2px 0;border-top:1px solid rgba(255,255,255,.06);font-size:10.5px;color:#9aa596}
#twocode-ai-monitor .cx-limit > div:first-child{display:flex;justify-content:space-between}
#twocode-ai-monitor .cx-limit b{color:#e8eee4}
#twocode-ai-monitor .cx-limit small{font-size:9.5px;color:#7f8a7a}
#twocode-ai-monitor .cx-bar{height:4px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}
#twocode-ai-monitor .cx-bar i{display:block;height:100%;border-radius:3px}
#twocode-ai-monitor .cx-others{flex:none;font-size:10.5px;color:#9aa596;padding:0 4px}
#twocode-ai-monitor .tc-page-head > .ch-head-right{flex:none}
#twocode-ai-monitor .ch-head-right{display:flex;align-items:center;gap:8px;margin-top:10px}
#twocode-ai-monitor .ch-head-right .cx-jump{margin-top:0}
#twocode-ai-monitor .ch-status{display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:12px;background:#121512;border:1px solid rgba(255,255,255,.08);font-weight:700;font-size:11px;white-space:nowrap}
#twocode-ai-monitor .ch-status i{width:8px;height:8px;border-radius:50%;background:var(--lamp);box-shadow:0 0 8px var(--lamp);display:block}
#twocode-ai-monitor .ch-status b{font-weight:600;color:#c2ccbd;font-variant-numeric:tabular-nums}
#twocode-ai-monitor .ch-chat{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column-reverse;padding:2px 6px 6px 0}
#twocode-ai-monitor .ch-inner{display:flex;flex-direction:column;gap:8px}
#twocode-ai-monitor .ch-row{display:flex;align-items:flex-end;gap:8px;min-width:0}
#twocode-ai-monitor .ch-row.me{justify-content:flex-end}
#twocode-ai-monitor .ch-avatar{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#22291f;color:#c6e994;border:1px solid rgba(198,233,148,.2)}
#twocode-ai-monitor .ch-bubble{max-width:78%;padding:9px 13px;border-radius:16px 16px 16px 5px;background:#171c17;border:1px solid rgba(255,255,255,.07);font-size:12.5px;line-height:1.5;color:#eef3e8;white-space:pre-wrap;overflow-wrap:anywhere;min-width:0}
#twocode-ai-monitor .ch-bubble.me{border-radius:16px 16px 5px 16px;background:#2b3a26;border-color:rgba(198,233,148,.18);color:#f2f7ec}
#twocode-ai-monitor .ch-bubble.wide{max-width:none;flex:1;white-space:normal}
#twocode-ai-monitor .ch-bubble.ask{border-color:rgba(255,154,31,.45);background:#1d1810}
#twocode-ai-monitor .ch-bubble.error{border-color:rgba(255,92,92,.4);background:#1d1111;white-space:normal}
#twocode-ai-monitor .ch-bubble.typing{display:flex;align-items:center;gap:10px;white-space:normal}
#twocode-ai-monitor .ch-bubble .cc-actions{margin-top:8px}
#twocode-ai-monitor .ch-bubble .cx-code{margin-top:6px}
#twocode-ai-monitor .ch-label{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#ffb35c;margin-bottom:4px}
#twocode-ai-monitor .ch-dim{color:#9aa596}
#twocode-ai-monitor .ch-typing{display:inline-flex;gap:3px}
#twocode-ai-monitor .ch-typing i{width:6px;height:6px;border-radius:50%;background:#ffb35c;animation:ch-dot 1.2s ease-in-out infinite}
#twocode-ai-monitor .ch-typing i:nth-child(2){animation-delay:.15s}
#twocode-ai-monitor .ch-typing i:nth-child(3){animation-delay:.3s}
@keyframes ch-dot{0%,60%,100%{opacity:.25;transform:none}30%{opacity:1;transform:translateY(-3px)}}
#twocode-ai-monitor .ch-steps{display:flex;flex-direction:column;gap:1px;margin:0 0 0 32px;padding:2px 0 2px 10px;border-left:1.5px solid rgba(255,255,255,.08)}
#twocode-ai-monitor .ch-step{display:flex;align-items:center;gap:7px;font-size:11px;color:#9aa596;min-width:0;padding:2px 0}
#twocode-ai-monitor .ch-step .ch-ico{flex:none;display:grid;place-items:center;color:#7f8a7a}
#twocode-ai-monitor .ch-step.running .ch-ico,#twocode-ai-monitor .ch-step.running em{color:#ffb35c}
#twocode-ai-monitor .ch-step em{font-style:normal;font-weight:600;flex:none}
#twocode-ai-monitor .ch-step small{font:10.5px Consolas,monospace;color:#6f7a6b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
#twocode-ai-monitor .ch-step > b{flex:none;width:14px;height:14px;border-radius:50%;display:grid;place-items:center;font-size:8px}
#twocode-ai-monitor .ch-step > b.cc-spin{border-width:1.5px}
#twocode-ai-monitor .ch-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#7f8a7a;text-align:center;font-size:11.5px}
#twocode-ai-monitor .ch-empty svg{color:#c6e994;margin-bottom:4px}
#twocode-ai-monitor .ch-empty b{color:#eef3e8;font-size:14px}
#twocode-ai-monitor .ch-compose{flex:none;display:flex;gap:8px;align-items:center;padding:6px;border-radius:16px;background:#111411;border:1px solid rgba(255,255,255,.09)}
#twocode-ai-monitor .ch-compose textarea{height:34px;border:0;background:transparent;padding:8px 8px;font-size:12.5px}
#twocode-ai-monitor .ch-compose textarea:focus-visible{outline:none}
#twocode-ai-monitor .ch-compose .am-primary{border-radius:11px;padding:8px 16px}
#twocode-ai-monitor .ch-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:10.5px;color:#7f8a7a;padding:2px 4px}
#twocode-ai-monitor .ch-limit{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
#twocode-ai-monitor .ch-limit b{color:#e8eee4}
#twocode-ai-monitor .ch-limit i{display:block;width:70px;height:4px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}
#twocode-ai-monitor .ch-limit s{display:block;height:100%;border-radius:3px}
#twocode-ai-monitor .ch-summary{margin:2px 0 0 32px;padding:10px 12px;border-radius:14px;background:linear-gradient(180deg,#131813,#0e110e);border:1px solid rgba(255,255,255,.08);display:flex;flex-direction:column;gap:7px}
#twocode-ai-monitor .ch-sum-head{display:flex;justify-content:space-between;align-items:center;font-size:11px}
#twocode-ai-monitor .ch-sum-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9aa596}
#twocode-ai-monitor .ch-sum-head .ok{color:#5ee88a}
#twocode-ai-monitor .ch-sum-head .ask{color:#ffb35c}
#twocode-ai-monitor .ch-sum-head .bad{color:#ff8a8a}
#twocode-ai-monitor .ch-sum-chips{display:flex;flex-wrap:wrap;gap:6px}
#twocode-ai-monitor .ch-sum-chips span{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:9px;background:rgba(255,255,255,.05);font-size:11px;color:#dfe7da}
#twocode-ai-monitor .ch-sum-chips svg{color:#9aa596}
#twocode-ai-monitor .ch-sum-files{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
#twocode-ai-monitor .ch-sum-files small{font-size:10px;color:#7f8a7a;margin-right:2px}
#twocode-ai-monitor .ch-sum-files code{font:10.5px Consolas,monospace;color:#ffd7ab;background:rgba(255,215,171,.07);border-radius:6px;padding:2px 6px}
#twocode-ai-monitor .am-shell{position:relative}
#twocode-ai-monitor .ch-model{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;background:#121512;border:1px solid rgba(255,255,255,.08);font-size:11px;font-weight:700;color:#e8eee4;white-space:nowrap}
#twocode-ai-monitor .ch-model svg{color:#c6e994}
#twocode-ai-monitor .ch-model span{color:#7f8a7a;font-size:9px}
#twocode-ai-monitor .ch-model-menu{position:absolute;top:50px;right:0;z-index:20;width:420px;padding:8px;border-radius:16px;background:#101310;border:1px solid rgba(255,255,255,.12);box-shadow:0 18px 40px rgba(0,0,0,.6);display:grid;grid-template-columns:1fr 1fr;gap:4px}
#twocode-ai-monitor .ch-model-menu .ch-model-head,#twocode-ai-monitor .ch-model-menu p{grid-column:1/-1}
#twocode-ai-monitor .ch-model-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:2px 8px 4px;font-size:11px;font-weight:700;color:#fff}
#twocode-ai-monitor .ch-model-head small{font-weight:500;color:#9aa596;font-size:10px}
#twocode-ai-monitor .ch-model-menu button{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:1px;text-align:left;padding:6px 26px 6px 10px;min-width:0;border:1px solid transparent;border-radius:11px;background:transparent;font-weight:400}
#twocode-ai-monitor .ch-model-menu button:hover{background:rgba(255,255,255,.05)}
#twocode-ai-monitor .ch-model-menu button.on{background:rgba(198,233,148,.09);border-color:rgba(198,233,148,.25)}
#twocode-ai-monitor .ch-model-menu button b{font-size:12px}
#twocode-ai-monitor .ch-model-menu button small{font-size:10px;line-height:1.3;color:#9aa596}
#twocode-ai-monitor .ch-model-menu button i{position:absolute;right:11px;top:50%;transform:translateY(-50%);font-style:normal;color:#c6e994;font-weight:700}
#twocode-ai-monitor .ch-model-menu p{margin:4px 8px 2px;font-size:10px;color:#7f8a7a}
#twocode-ai-monitor .ch-model-menu code{font:10px Consolas,monospace;color:#ffd7ab}
#twocode-ai-monitor .am-picks{display:flex;gap:4px;padding:3px;margin:0 0 8px;border-radius:12px;background:#111411;border:1px solid rgba(255,255,255,.07);width:max-content}
#twocode-ai-monitor .am-pick{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#9aa596;padding:5px 11px;border-radius:9px;font:600 11px Inter, "Segoe UI", sans-serif;cursor:pointer}
#twocode-ai-monitor .am-pick:hover{color:#fff}
#twocode-ai-monitor .am-pick.on{background:#262d24;color:#fff}
#twocode-ai-monitor .am-pick i{width:7px;height:7px;border-radius:50%;background:var(--lamp);box-shadow:0 0 6px var(--lamp)}
/* on Robo's stage (Claude Code / Codex): the chat look, Robo bottom left */
#twocode-ai-monitor.cc-stage .am-shell{padding:8px 14px 10px 96px;gap:8px}
#twocode-ai-monitor.cc-stage .tc-page-head{align-items:center;margin:0;justify-content:space-between}
#twocode-ai-monitor.cc-stage .tc-page-head > .cc-pill{flex:0 1 auto;margin-right:auto}
#twocode-ai-monitor .cc-pill{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.1);font:600 12px Inter, "Segoe UI", sans-serif;color:#fff;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .cc-pill i{width:8px;height:8px;border-radius:50%;background:var(--lamp);box-shadow:0 0 8px var(--lamp);flex:none}
#twocode-ai-monitor .cc-pill span{color:rgba(255,255,255,.55);font-weight:500}
#twocode-ai-monitor.cc-stage .ch-head-right{margin-top:0}
#twocode-ai-monitor.cc-stage .ch-model,#twocode-ai-monitor.cc-stage .ch-status,#twocode-ai-monitor.cc-stage .cx-jump{background:rgba(255,255,255,.09);border:0;border-radius:999px;padding:6px 12px}
#twocode-ai-monitor.cc-stage .ch-model svg{color:#ffc29a}
#twocode-ai-monitor.cc-stage .ch-model-menu{background:#1c120d;border-color:rgba(255,170,120,.18)}
#twocode-ai-monitor.cc-stage .ch-model-menu button.on{background:rgba(255,154,90,.14);border-color:rgba(255,154,90,.35)}
#twocode-ai-monitor.cc-stage .ch-model-menu button i{color:#ffb07a}
#twocode-ai-monitor.cc-stage .ch-chat{padding:0 6px 0 0}
#twocode-ai-monitor.cc-stage .ch-inner{gap:10px}
#twocode-ai-monitor.cc-stage .ch-avatar{display:none}
#twocode-ai-monitor.cc-stage .ch-bubble{font:13.5px/1.5 Inter, "Segoe UI", sans-serif}
#twocode-ai-monitor.cc-stage .ch-bubble:not(.me):not(.ask):not(.error):not(.wide){background:none;border:0;padding:0 2px;max-width:100%;color:#f6efe9}
#twocode-ai-monitor.cc-stage .ch-bubble.me{background:rgba(255,255,255,.13);border:0;border-radius:14px;padding:7px 14px;font-weight:600;font-size:13px;max-width:75%}
#twocode-ai-monitor.cc-stage .ch-bubble.ask{background:rgba(255,154,31,.13);border:1px solid rgba(255,179,92,.35);border-radius:14px}
#twocode-ai-monitor.cc-stage .ch-bubble.wide{background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.08);border-radius:14px}
#twocode-ai-monitor.cc-stage .ch-bubble.error{background:rgba(255,92,92,.12);border:1px solid rgba(255,120,120,.3);border-radius:14px}
#twocode-ai-monitor.cc-stage .ch-bubble.typing{background:none;border:0;padding:0 2px}
#twocode-ai-monitor.cc-stage .ch-typing i{background:#ffb07a}
#twocode-ai-monitor.cc-stage .ch-steps{margin:0;border-left-color:rgba(255,255,255,.12)}
#twocode-ai-monitor.cc-stage .ch-step{color:rgba(255,236,226,.62)}
#twocode-ai-monitor.cc-stage .ch-step small{color:rgba(255,236,226,.45)}
#twocode-ai-monitor.cc-stage .ch-summary{margin:0;background:rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.08);border-radius:14px}
#twocode-ai-monitor.cc-stage .ch-sum-chips span{background:rgba(255,255,255,.08);color:#fff3ea}
#twocode-ai-monitor.cc-stage .ch-sum-files code{background:rgba(255,190,150,.12);color:#ffd1b0}
#twocode-ai-monitor.cc-stage .ch-compose{background:rgba(255,255,255,.08);border:0;border-radius:12px;padding:3px 4px 3px 6px}
#twocode-ai-monitor.cc-stage .ch-compose textarea{background:transparent;border:0;color:#fff}
#twocode-ai-monitor.cc-stage .ch-compose .am-primary{background:#fff;color:#1a1310;border:0;border-radius:999px;padding:7px 16px}
#twocode-ai-monitor.cc-stage .ch-foot{color:rgba(255,236,226,.55)}
#twocode-ai-monitor.cc-stage .am-primary{background:#ffb07a;border-color:#ffb07a;color:#2a1508}
#twocode-ai-monitor.cc-stage .ch-empty{color:rgba(255,236,226,.6)}#twocode-ai-monitor.cc-stage .ch-empty svg{color:#ffb07a}
#twocode-ai-monitor .ch-bubble.md{white-space:normal}
#twocode-ai-monitor .ch-bubble.md p{margin:0 0 8px}#twocode-ai-monitor .ch-bubble.md p:last-child{margin-bottom:0}
#twocode-ai-monitor .ch-bubble.md ul,#twocode-ai-monitor .ch-bubble.md ol{margin:2px 0 8px;padding-left:20px}#twocode-ai-monitor .ch-bubble.md li{margin:2px 0}
#twocode-ai-monitor .ch-bubble.md code{font:12px "Cascadia Code",Consolas,monospace;background:rgba(255,255,255,.1);border-radius:5px;padding:1px 5px;color:#ffe2cc}
#twocode-ai-monitor .ch-bubble.md pre{margin:4px 0 8px;padding:8px 11px;border-radius:10px;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.08);font:12px/1.5 "Cascadia Code",Consolas,monospace;color:#ffe6d4;white-space:pre-wrap;overflow-wrap:anywhere}
#twocode-ai-monitor .ch-bubble.md b{color:#fff}
/* the model menu: one clean list, the current one with a check */
#twocode-ai-monitor .ch-model-menu{top:40px;width:340px;padding:5px;border-radius:14px;background:#1c140f;border:1px solid rgba(255,190,150,.16);box-shadow:0 22px 50px rgba(0,0,0,.65);grid-template-columns:1fr;gap:2px}
#twocode-ai-monitor .ch-model-head{padding:5px 10px 4px;font:700 11.5px Inter, "Segoe UI", sans-serif;flex-direction:column;align-items:flex-start;gap:1px}
#twocode-ai-monitor .ch-model-head small{color:rgba(255,236,226,.5)}
#twocode-ai-monitor .ch-model-menu button{flex-direction:row;align-items:center;gap:10px;padding:6px 30px 6px 10px;border-radius:10px;font-family:Inter, "Segoe UI", sans-serif}
#twocode-ai-monitor .ch-model-menu button b{font-size:12.5px;min-width:70px;color:#fff}
#twocode-ai-monitor .ch-model-menu button small{font-size:11px;color:rgba(255,236,226,.55);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
#twocode-ai-monitor .ch-model-menu button:hover{background:rgba(255,255,255,.07)}
#twocode-ai-monitor .ch-model-menu button.on{background:rgba(255,160,100,.16);border-color:transparent}
#twocode-ai-monitor .ch-model-menu button i{color:#ffb07a;font-size:13px}
#twocode-ai-monitor .ch-model-menu p{margin:2px 10px 3px;padding-top:5px;border-top:1px solid rgba(255,255,255,.07);font:10.5px Inter, "Segoe UI", sans-serif;color:rgba(255,236,226,.45)}
/* the reply box: like the chat's */
#twocode-ai-monitor .ch-compose{align-items:center;border-radius:14px;padding:4px 5px 4px 6px}
#twocode-ai-monitor .ch-compose textarea{height:32px;padding:7px 8px;font:13px Inter, "Segoe UI", sans-serif;caret-color:#ffc29a}
#twocode-ai-monitor .ch-compose:focus-within{box-shadow:inset 0 0 0 1px rgba(255,176,122,.5)}
#twocode-ai-monitor .ch-compose #am-send{width:30px;height:30px;padding:0;border-radius:50%;background:#fff;color:#1a1310;border:0;font:700 15px Inter, "Segoe UI", sans-serif;flex:none}
#twocode-ai-monitor .ch-compose #am-send:disabled{opacity:.4}
#twocode-ai-monitor.cc-codex .ch-typing i,#twocode-ai-monitor.cc-codex .am-primary{background:#7fb6ff;border-color:#7fb6ff;color:#06182e}
#twocode-ai-monitor.cc-codex .ch-bubble.ask{background:rgba(59,130,246,.14);border-color:rgba(127,182,255,.4)}
#twocode-ai-monitor.cc-codex .ch-compose:focus-within{box-shadow:inset 0 0 0 1px rgba(127,182,255,.55)}
#twocode-ai-monitor.cc-codex .ch-bubble.md code{color:#dbeaff}
#twocode-ai-monitor .ch-hist-title{font:700 10.5px Inter, "Segoe UI", sans-serif;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,236,226,.5);margin:2px 2px 0}
#twocode-ai-monitor .ch-hist{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.05);min-width:0}
#twocode-ai-monitor .ch-hist:hover{background:rgba(255,255,255,.09)}
#twocode-ai-monitor .ch-hist div{flex:1;min-width:0;display:flex;flex-direction:column}
#twocode-ai-monitor .ch-hist b{font:600 12.5px Inter, "Segoe UI", sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .ch-hist small{font:11px Inter, "Segoe UI", sans-serif;color:rgba(255,236,226,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .ch-hist-mark{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:800;background:rgba(255,255,255,.08);color:#fff}
#twocode-ai-monitor .ch-hist-mark.done{background:rgba(94,232,138,.16);color:#7ef0a4}
#twocode-ai-monitor .ch-hist-mark.question{background:rgba(255,179,92,.18);color:#ffc27a}
#twocode-ai-monitor .ch-hist-mark.error{background:rgba(255,92,92,.16);color:#ff9a9a}
#twocode-ai-monitor .ch-hist i{flex:none;font:600 11px Inter, "Segoe UI", sans-serif;font-style:normal;color:rgba(255,236,226,.55)}
#twocode-ai-monitor .ch-hist i.done{color:#7ef0a4}#twocode-ai-monitor .ch-hist i.question{color:#ffc27a}#twocode-ai-monitor .ch-hist i.error{color:#ff9a9a}
/* ---- the Claude page as a Live Activity: right on the black, no cards (Claude orange, Codex blue) ---- */
#twocode-ai-monitor.cl-new{--acc:#ff9230;--ok:#30d158;--bad:#ff4245;--ask:#ffd600;--g:#8e8e93;--g1:#1c1c1e;--g2:#2c2c2e;--g3:#3a3a3c;font-family:Inter,"Segoe UI",sans-serif;color:#fff}
#twocode-ai-monitor.cl-new.cc-codex{--acc:#0091ff}
#twocode-ai-monitor.cl-new .am-shell{padding:0 16px 10px;gap:0}
#twocode-ai-monitor .lv-top{display:flex;align-items:center;gap:8px;height:22px;font-size:15px;font-weight:600;color:var(--tone,var(--acc))}
#twocode-ai-monitor .lv-hero{display:flex;align-items:center;gap:18px;margin-top:2px}
#twocode-ai-monitor .lv-ring{position:relative;flex:none;width:76px;height:76px}
#twocode-ai-monitor .lv-ring > svg{position:absolute;left:0;top:0;width:100%;height:100%;transform:rotate(-90deg)}
#twocode-ai-monitor .lv-ring circle{fill:none;stroke-width:8;stroke-linecap:round}
#twocode-ai-monitor .lv-ring i{position:absolute;inset:0;display:grid;place-items:center;color:var(--tone)}
#twocode-ai-monitor .lv-hero > div:not(.lv-ring){flex:1;min-width:0}
#twocode-ai-monitor .lv-who{font-size:15px;font-weight:600;color:var(--tone);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .lv-hero .lv-title{font-size:26px;line-height:30px;font-weight:700}
#twocode-ai-monitor .lv-hero .lv-sub{margin-top:2px}
#twocode-ai-monitor .lv-clock{flex:none;align-self:flex-start;margin-top:2px;font-size:20px;font-weight:700;color:var(--tone);font-variant-numeric:tabular-nums}
#twocode-ai-monitor .lv-top svg{flex:none}
#twocode-ai-monitor .lv-top .lv-time{margin-left:auto;font-variant-numeric:tabular-nums}
#twocode-ai-monitor .lv-main{display:flex;align-items:flex-end;gap:16px;margin-top:10px}
#twocode-ai-monitor .lv-main > div{flex:1;min-width:0}
#twocode-ai-monitor .lv-title{margin:0;font-size:28px;line-height:32px;font-weight:650;letter-spacing:-.35px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .lv-sub{margin:3px 0 0;font-size:15px;line-height:20px;color:var(--g);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .lv-sub code,#twocode-ai-monitor .lv-mono{font:500 13px "Cascadia Mono",Consolas,monospace}
#twocode-ai-monitor .lv-btns{flex:none;display:flex;gap:8px}
#twocode-ai-monitor.cl-new button{border:0;border-radius:22px;height:36px;padding:0 14px;background:var(--g2);color:#fff;font:600 13px Inter,"Segoe UI",sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
#twocode-ai-monitor.cl-new button:hover{background:var(--g3)}
#twocode-ai-monitor.cl-new button:active{transform:scale(.97);transition:transform .1s ease-out}
#twocode-ai-monitor.cl-new .am-primary{background:#fff;color:#000}
#twocode-ai-monitor.cl-new .am-primary:hover{background:#e5e5ea}
#twocode-ai-monitor .lv-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:14px}
#twocode-ai-monitor .lv-steps i{display:block;height:6px;border-radius:3px;background:var(--g3);overflow:hidden}
#twocode-ai-monitor .lv-steps i.d{background:#fff}#twocode-ai-monitor .lv-steps.done i{background:var(--ok)}
#twocode-ai-monitor .lv-steps i.n s{display:block;height:100%;width:40%;border-radius:3px;background:var(--tone,var(--acc));animation:lv-run 1.6s ease-in-out infinite}
@keyframes lv-run{50%{width:80%}}
#twocode-ai-monitor .lv-steps span{font-size:12px;font-weight:600;color:var(--g);margin-top:7px}
#twocode-ai-monitor .lv-steps span.n{color:#fff}
#twocode-ai-monitor .lv-list{flex:1;min-height:0;overflow:auto;margin-top:12px;scrollbar-width:none}
#twocode-ai-monitor .lv-cap{font-size:13px;font-weight:600;color:var(--g);margin:2px 0 2px}
#twocode-ai-monitor .lv-row{display:flex;align-items:center;gap:12px;height:36px;border-bottom:1px solid var(--g2)}
#twocode-ai-monitor .lv-row:last-child{border-bottom:0}
#twocode-ai-monitor .lv-ic{flex:none;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;background:var(--g2);color:#fff}
#twocode-ai-monitor .lv-row b{flex:1;min-width:0;font:500 13px "Cascadia Mono",Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor .lv-row em{font-style:normal;font-size:13px;color:var(--g)}
#twocode-ai-monitor .lv-row em.run{color:var(--acc)}#twocode-ai-monitor .lv-row em.bad{color:var(--bad)}
#twocode-ai-monitor .lv-answer{font-size:15px;line-height:22px;color:#fff;white-space:normal}
#twocode-ai-monitor .lv-answer p{margin:0 0 8px}#twocode-ai-monitor .lv-answer p:last-child{margin:0}
#twocode-ai-monitor .lv-answer code{font:13px "Cascadia Mono",Consolas,monospace;background:var(--g2);border-radius:6px;padding:1px 6px}
#twocode-ai-monitor .lv-answer pre{margin:4px 0 8px;padding:10px 12px;border-radius:12px;background:var(--g1);font:12.5px/1.5 "Cascadia Mono",Consolas,monospace;white-space:pre-wrap}
#twocode-ai-monitor .lv-limit{flex:none;display:flex;align-items:center;gap:10px;height:26px;font-size:12px;font-weight:600;color:var(--g)}
#twocode-ai-monitor .lv-limit i{flex:1;max-width:220px;height:4px;border-radius:2px;background:var(--g3);overflow:hidden}
#twocode-ai-monitor .lv-limit s{display:block;height:100%;background:#fff}
#twocode-ai-monitor .lv-limit .ch-compose{flex:1}
/* Claude needs you: a question, a plan or a permission, with two same-size buttons */
#twocode-ai-monitor .lv-ask{flex:1;min-height:0;display:flex;flex-direction:column;margin-top:8px}
#twocode-ai-monitor .lv-ask h3{margin:0;font-size:22px;line-height:28px;font-weight:650;letter-spacing:-.3px}
#twocode-ai-monitor .lv-cmd{margin-top:10px;min-height:44px;border-radius:14px;background:var(--g1);display:flex;align-items:center;gap:10px;padding:10px 16px;font:500 14px "Cascadia Mono",Consolas,monospace;white-space:pre-wrap;word-break:break-all;max-height:84px;overflow:auto}
#twocode-ai-monitor .lv-two{margin-top:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding-top:12px}
#twocode-ai-monitor.cl-new .lv-two button{height:44px;font-size:15px;justify-content:center;border-radius:22px}
#twocode-ai-monitor .lv-scroll{flex:1;min-height:0;overflow:auto;margin-top:8px;font-size:14px;line-height:21px;scrollbar-width:none}
#twocode-ai-monitor.cl-new .am-option{display:flex;flex-direction:column;align-items:flex-start;height:auto;min-height:44px;width:100%;padding:8px 14px;border-radius:14px;background:var(--g1);text-align:left;margin-top:6px}
#twocode-ai-monitor.cl-new .am-option.on{background:#fff;color:#000}
#twocode-ai-monitor.cl-new .am-option small{font-weight:500;color:var(--g)}#twocode-ai-monitor.cl-new .am-option.on small{color:#3a3a3c}
#twocode-ai-monitor.cl-new .am-note{height:40px;border:0;border-radius:20px;background:var(--g1);color:#fff;padding:0 16px;font:15px Inter,"Segoe UI",sans-serif;outline:none;flex:1}
#twocode-ai-monitor.cl-new .ch-compose{display:flex;align-items:center;gap:8px;height:40px;border-radius:20px;background:var(--g1);padding:0 4px 0 16px}
#twocode-ai-monitor.cl-new .ch-compose textarea{flex:1;height:22px;border:0;background:transparent;color:#fff;font:15px Inter,"Segoe UI",sans-serif;resize:none;outline:none;padding:0}
#twocode-ai-monitor.cl-new .ch-compose #am-send{width:32px;height:32px;padding:0;justify-content:center;border-radius:50%;background:#fff;color:#000}
#twocode-ai-monitor.cl-new .ch-model-menu{top:auto;bottom:34px;right:0;background:var(--g1);border:0;border-radius:16px;box-shadow:0 18px 44px rgba(0,0,0,.6)}
#twocode-ai-monitor.cl-new .ch-model-menu button{height:auto;border-radius:12px;background:transparent}
#twocode-ai-monitor.cl-new .ch-model-menu button:hover{background:var(--g2)}
#twocode-ai-monitor.cl-new .ch-model-menu button.on{background:var(--g2)}
#twocode-ai-monitor.cl-new .ch-model-menu button i{color:var(--acc)}
#twocode-ai-monitor.cl-new .ch-model{height:26px;padding:0 10px;background:transparent;color:var(--g)}
#twocode-ai-monitor.cl-new .ch-model:hover{background:var(--g2);color:#fff}
/* v3, calm like Apple Music: white and grey, Claude's colour only on its cover, rounded rectangles instead of pills */
#twocode-ai-monitor.cl-new{--acc:#ffffff;--ask:#ffffff}
#twocode-ai-monitor .lv-ring{width:76px;height:76px;border-radius:10px;background:linear-gradient(135deg,#e08a6c,#9c4126);box-shadow:0 6px 18px rgba(0,0,0,.45)}
#twocode-ai-monitor.cc-codex .lv-ring{background:linear-gradient(135deg,#3a3a3c,#141416)}
#twocode-ai-monitor .lv-ring i{color:#fff}
#twocode-ai-monitor .lv-who{font-size:12px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:var(--g)}
#twocode-ai-monitor .lv-hero .lv-title{font-size:24px;line-height:30px;font-weight:700;letter-spacing:-.3px}
#twocode-ai-monitor .lv-clock{font-size:13px;font-weight:600;color:var(--g)}
#twocode-ai-monitor .lv-prog{height:4px;border-radius:2px;background:var(--g3);margin-top:9px;overflow:hidden}
#twocode-ai-monitor .lv-prog s{display:block;height:100%;border-radius:2px;background:#fff;transition:width .4s ease-out}
#twocode-ai-monitor .lv-prog.live s{animation:lv-breathe 1.6s ease-in-out infinite}
@keyframes lv-breathe{50%{opacity:.6}}
#twocode-ai-monitor .lv-ic{border-radius:6px;background:var(--g2);color:#fff}
#twocode-ai-monitor .lv-row em.run{color:#fff}
#twocode-ai-monitor.cl-new button{border-radius:10px}
#twocode-ai-monitor.cl-new .lv-two button{border-radius:10px}
#twocode-ai-monitor.cl-new .lv-two .lv-no{background:var(--g2);color:#fff}
#twocode-ai-monitor.cl-new .lv-two .lv-no:hover{background:var(--g3)}
#twocode-ai-monitor.cl-new .lv-two .lv-yes{background:#fff;color:#000}
#twocode-ai-monitor.cl-new .lv-two .lv-yes:hover{background:#e5e5ea}
#twocode-ai-monitor .lv-cmd{border-radius:10px}
#twocode-ai-monitor.cl-new .am-option,#twocode-ai-monitor.cl-new .am-note,#twocode-ai-monitor.cl-new .ch-compose{border-radius:10px}
#twocode-ai-monitor.cl-new .ch-compose #am-send{border-radius:8px}
#twocode-ai-monitor.cl-new .ch-model-menu{border-radius:12px}
#twocode-ai-monitor.cl-new .ch-model-menu button{border-radius:8px}
/* code live: on black, the changed lines red / green, line numbers, Xcode's dark syntax colours */
#twocode-ai-monitor .lv-ring{width:60px;height:60px;border-radius:9px}
#twocode-ai-monitor .lv-ring svg{width:28px;height:28px}
#twocode-ai-monitor .lv-hero{gap:16px}
#twocode-ai-monitor .lv-hero .lv-title{font-size:21px;line-height:26px}
#twocode-ai-monitor .lv-hero .lv-sub{font-size:14px;line-height:18px}
#twocode-ai-monitor .lv-code{font:500 12.5px/20px "Cascadia Mono",Consolas,monospace;color:#e5e5ea}
#twocode-ai-monitor .lv-file{display:flex;align-items:center;gap:8px;height:24px;margin-bottom:4px;font:600 13px Inter,"Segoe UI",sans-serif;color:#fff}
#twocode-ai-monitor .lv-file span{height:16px;padding:0 5px;border-radius:4px;background:#2c2c2e;font:700 9.5px/16px Inter,"Segoe UI",sans-serif;color:#aeaeb2;letter-spacing:.3px}
#twocode-ai-monitor .lv-file em{margin-left:auto;font-style:normal;font-weight:500;font-size:12px;color:var(--g)}
#twocode-ai-monitor .lv-ln{display:flex;align-items:center;height:20px;border-radius:4px;white-space:pre;overflow:hidden;animation:lv-line .35s cubic-bezier(.2,.8,.2,1) both}
#twocode-ai-monitor .lv-ln:nth-child(3){animation-delay:.05s}#twocode-ai-monitor .lv-ln:nth-child(4){animation-delay:.1s}#twocode-ai-monitor .lv-ln:nth-child(5){animation-delay:.15s}#twocode-ai-monitor .lv-ln:nth-child(6){animation-delay:.2s}#twocode-ai-monitor .lv-ln:nth-child(7){animation-delay:.25s}
@keyframes lv-line{from{opacity:0;transform:translateX(-6px)}}
#twocode-ai-monitor .lv-ln i{flex:none;width:30px;padding-right:8px;text-align:right;font-style:normal;color:#636366}
#twocode-ai-monitor .lv-ln b{flex:none;width:14px;font-weight:600}
#twocode-ai-monitor .lv-ln code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font:inherit}
#twocode-ai-monitor .lv-ln.del{background:rgba(255,69,58,.13)}#twocode-ai-monitor .lv-ln.del b{color:#ff6961}#twocode-ai-monitor .lv-ln.del code{opacity:.75}
#twocode-ai-monitor .lv-ln.add{background:rgba(50,215,75,.12)}#twocode-ai-monitor .lv-ln.add b{color:#32d74b}
#twocode-ai-monitor .sx-k{color:#ff7ab2;font-weight:600}#twocode-ai-monitor .sx-s{color:#ff8170}#twocode-ai-monitor .sx-n{color:#d9c97c}#twocode-ai-monitor .sx-c{color:#7f8c98}#twocode-ai-monitor .sx-t{color:#5dd8ff}
#twocode-ai-monitor .lv-term .lv-file span{background:transparent;padding:0;font:600 13px "Cascadia Mono",Consolas,monospace;color:#32d74b}
#twocode-ai-monitor .lv-term .lv-file{font:600 13px "Cascadia Mono",Consolas,monospace}
#twocode-ai-monitor .lv-out{height:20px;white-space:pre;overflow:hidden;text-overflow:ellipsis;color:#aeaeb2;animation:lv-line .3s ease-out both}
#twocode-ai-monitor .lv-out.bad{color:#ff6961}#twocode-ai-monitor .lv-out.dim{color:#636366}
/* compact (notch-app size) */
#twocode-ai-monitor .lv-ring{width:48px;height:48px;border-radius:9px}
#twocode-ai-monitor .lv-ring svg{width:22px;height:22px}
#twocode-ai-monitor .lv-hero{gap:12px}
#twocode-ai-monitor .lv-who{font-size:10px}
#twocode-ai-monitor .lv-hero .lv-title{font-size:15px;line-height:19px;font-weight:600;letter-spacing:0}
#twocode-ai-monitor .lv-hero .lv-sub{font-size:12px;line-height:16px}
#twocode-ai-monitor .lv-clock{font-size:11px}
#twocode-ai-monitor .lv-prog{height:3px;margin-top:6px}
#twocode-ai-monitor .lv-list{margin-top:8px}
#twocode-ai-monitor .lv-row{height:30px;gap:10px}
#twocode-ai-monitor .lv-ic{width:20px;height:20px;border-radius:5px}
#twocode-ai-monitor .lv-row b{font-size:12px}
#twocode-ai-monitor .lv-row em,#twocode-ai-monitor .lv-cap{font-size:11px}
#twocode-ai-monitor .lv-answer{font-size:13px;line-height:19px}
#twocode-ai-monitor .lv-code{font-size:11.5px;line-height:18px}
#twocode-ai-monitor .lv-file{height:20px;font-size:12px;margin-bottom:2px}
#twocode-ai-monitor .lv-ln{height:18px}
#twocode-ai-monitor .lv-out{height:18px}
#twocode-ai-monitor .lv-limit{height:22px;font-size:11px}
#twocode-ai-monitor .lv-cmd{margin-top:8px;min-height:34px;padding:7px 12px;font-size:12px;border-radius:9px}
#twocode-ai-monitor .lv-two{gap:8px;padding-top:8px}
#twocode-ai-monitor.cl-new .lv-two button{height:32px;font-size:13px;border-radius:9px}
#twocode-ai-monitor.cl-new button{height:28px;font-size:12px}
#twocode-ai-monitor.cl-new .am-shell{padding:0 16px 4px}
/* v10: the glow (black at the top, the state's colour rising from the bottom), a big number left, a frosted card right */
@keyframes cp-turn{to{transform:rotate(360deg)}}
@keyframes cp-in{from{opacity:0;transform:translateY(4px)}}
@keyframes cp-run{to{transform:translateX(122%)}}
@keyframes cp-shine{from{background-position:100% 0}to{background-position:-100% 0}}
#twocode-ai-monitor.cl-new .gl-main{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:20px;align-items:center;margin-top:2px}
#twocode-ai-monitor.cl-new .gl-l{min-width:0}
#twocode-ai-monitor.cl-new .gl-tile{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:12px;font-weight:600;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden;min-width:0;max-width:100%}
#twocode-ai-monitor.cl-new .gl-tile > .gl-ico{flex:none;width:22px;height:22px;border-radius:6px;display:grid;place-items:center;color:#fff;background:linear-gradient(150deg,#eba184,#b54e2c);box-shadow:0 2px 8px rgba(0,0,0,.3)}
#twocode-ai-monitor.cc-codex .gl-tile > .gl-ico{background:linear-gradient(150deg,#6b9bff,#1d4fd8)}
#twocode-ai-monitor.cl-new .gl-tile > .gl-ico.live svg{animation:cp-turn 7s linear infinite}
#twocode-ai-monitor.cl-new .gl-marquee{flex:1;min-width:0;overflow:hidden;white-space:nowrap;position:relative;-webkit-mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 14px),transparent 100%);mask-image:linear-gradient(90deg,#000 0,#000 calc(100% - 14px),transparent 100%)}
#twocode-ai-monitor.cl-new .gl-marquee-text{display:inline-block;white-space:nowrap;font-size:12px;font-weight:600;color:rgba(255,255,255,.85);background:transparent!important;box-shadow:none!important;border:none!important;border-radius:0!important;padding:0!important;margin:0!important;width:auto!important;height:auto!important;will-change:transform}
#twocode-ai-monitor.cl-new .gl-marquee-text.scrolling{animation:am-scroll-marquee 8s ease-in-out infinite alternate}
@keyframes am-scroll-marquee{0%,20%{transform:translateX(0)}80%,100%{transform:translateX(var(--scroll-dist,-60px))}}
#twocode-ai-monitor.cl-new .gl-big{margin:0;font-size:56px;line-height:52px;font-weight:700;letter-spacing:-2.6px;font-variant-numeric:tabular-nums;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor.cl-new .gl-big.word{font-size:38px;line-height:42px;letter-spacing:-1.4px}
#twocode-ai-monitor.cl-new .gl-sub{margin:6px 0 0;font-size:13px;line-height:17px;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor.cl-new .gl-card{min-width:0;max-height:136px;overflow:hidden;box-sizing:border-box;border-radius:14px;background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1);backdrop-filter:blur(14px);padding:10px 12px;display:flex;flex-direction:column;animation:cp-in .3s cubic-bezier(.2,.8,.2,1) both}
#twocode-ai-monitor.cl-new .gl-cap{margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:rgba(255,255,255,.55)}
#twocode-ai-monitor.cl-new .gl-row{display:flex;align-items:center;gap:9px;height:26px;min-width:0;flex:none}
#twocode-ai-monitor.cl-new .gl-row b{flex:none;font-size:12.5px;font-weight:600;color:#fff}
#twocode-ai-monitor.cl-new .gl-row code{flex:1;min-width:0;font:500 11.5px "Cascadia Mono",Consolas,monospace;color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor.cl-new .gl-row.d b{color:rgba(255,255,255,.62)}
#twocode-ai-monitor.cl-new .gl-row .ic{flex:none;width:20px;height:20px;border-radius:6px;display:grid;place-items:center;background:rgba(255,255,255,.12);color:#fff;font-style:normal}
#twocode-ai-monitor.cl-new .gl-spin{flex:none;width:13px;height:13px;box-sizing:border-box;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;animation:cp-turn .8s linear infinite}
#twocode-ai-monitor.cl-new .gl-ok{flex:none;display:grid;color:rgba(255,255,255,.55)}
#twocode-ai-monitor.cl-new .gl-row.h b{flex:1;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#twocode-ai-monitor.cl-new .gl-row.h em{flex:none;font-style:normal;font-size:11px;color:rgba(255,255,255,.6);font-variant-numeric:tabular-nums}
#twocode-ai-monitor.cl-new .gl-dot{flex:none;width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:9px;font-weight:800;background:rgba(255,255,255,.15);color:#fff}
#twocode-ai-monitor.cl-new .gl-dot.ok{background:#30d158;color:#000}#twocode-ai-monitor.cl-new .gl-dot.bad{background:#ff453a;color:#000}#twocode-ai-monitor.cl-new .gl-dot.ask{background:#ffd60a;color:#000}
#twocode-ai-monitor.cl-new .gl-md{min-height:0;overflow:auto;scrollbar-width:none;font-size:12.5px;line-height:18px;color:#fff}
#twocode-ai-monitor.cl-new .gl-md p{margin:0 0 6px}#twocode-ai-monitor.cl-new .gl-md p:last-child{margin:0}#twocode-ai-monitor.cl-new .gl-md ul,#twocode-ai-monitor.cl-new .gl-md ol{margin:0 0 6px;padding-left:18px}
#twocode-ai-monitor.cl-new .gl-md code{font:11.5px "Cascadia Mono",Consolas,monospace;background:rgba(255,255,255,.14);border-radius:5px;padding:1px 5px}
#twocode-ai-monitor.cl-new .gl-md pre{margin:4px 0 6px;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.35);font:11.5px/1.5 "Cascadia Mono",Consolas,monospace;white-space:pre-wrap}
#twocode-ai-monitor.cl-new .gl-think p{margin:0;font-size:13px;line-height:18px;color:#fff;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#twocode-ai-monitor.cl-new .gl-think span{display:inline-block;align-self:flex-start;margin-top:6px;font-size:12px;font-weight:600;background:linear-gradient(90deg,rgba(255,255,255,.4) 20%,#fff 50%,rgba(255,255,255,.4) 80%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:cp-shine 1.8s linear infinite}
#twocode-ai-monitor.cl-new .gl-empty{font-size:12.5px;line-height:18px;color:rgba(255,255,255,.8)}
#twocode-ai-monitor.cl-new .gl-cmd{max-height:100%;overflow:auto;scrollbar-width:none;font:500 12px/18px "Cascadia Mono",Consolas,monospace;color:#fff;white-space:pre-wrap;word-break:break-all}
#twocode-ai-monitor.cl-new .gl-cmd span{color:#7dffa0;margin-right:8px}
#twocode-ai-monitor.cl-new .gl-card .lv-file{color:#fff;margin-bottom:4px}#twocode-ai-monitor.cl-new .gl-card .lv-file em{color:rgba(255,255,255,.6)}#twocode-ai-monitor.cl-new .gl-card .lv-file span{background:rgba(255,255,255,.14);color:#fff}
#twocode-ai-monitor.cl-new .gl-card .lv-ln i{color:rgba(255,255,255,.45)}#twocode-ai-monitor.cl-new .gl-card .lv-out{color:rgba(255,255,255,.75)}#twocode-ai-monitor.cl-new .gl-card .lv-out.dim{color:rgba(255,255,255,.5)}
#twocode-ai-monitor.cl-new .gl-foot{flex:none;position:relative;display:flex;align-items:center;gap:12px;height:32px;margin-top:10px}
#twocode-ai-monitor.cl-new .gl-tools{margin-left:auto;flex:none;display:flex;gap:6px}
#twocode-ai-monitor.cl-new .gl-steps{flex:1;min-width:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
#twocode-ai-monitor.cl-new .gl-steps i{position:relative;display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
#twocode-ai-monitor.cl-new .gl-steps .d i{background:#fff}
#twocode-ai-monitor.cl-new .gl-steps .n i::after{content:"";position:absolute;left:0;top:0;bottom:0;width:45%;border-radius:2px;background:#fff;animation:cp-run 1.3s ease-in-out infinite alternate}
#twocode-ai-monitor.cl-new .gl-steps span{display:block;margin-top:5px;font-size:11px;line-height:13px;font-weight:500;color:rgba(255,255,255,.5)}
#twocode-ai-monitor.cl-new .gl-steps .d span{color:rgba(255,255,255,.72)}#twocode-ai-monitor.cl-new .gl-steps .n span{color:#fff;font-weight:600}
#twocode-ai-monitor.cl-new .gl-steps.done div:last-child span{color:#fff;font-weight:600}
#twocode-ai-monitor.cl-new .gl-steps.bad .n i{background:#fff}#twocode-ai-monitor.cl-new .gl-steps.bad .n i::after{display:none}
#twocode-ai-monitor.cl-new .gl-chip{height:26px;padding:0 10px;border:0;border-radius:8px;background:rgba(255,255,255,.13);color:#fff;font:600 11.5px Inter,"Segoe UI",sans-serif;display:inline-flex;align-items:center;gap:5px;cursor:pointer}
#twocode-ai-monitor.cl-new .gl-chip:hover{background:rgba(255,255,255,.22)}
#twocode-ai-monitor.cl-new .gl-chip em,#twocode-ai-monitor.cl-new .gl-chip span{font-style:normal;font-weight:500;color:rgba(255,255,255,.65)}
#twocode-ai-monitor.cl-new .gl-limit{flex:1;min-width:0;display:flex;align-items:center;gap:10px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,.75)}
#twocode-ai-monitor.cl-new .gl-limit i{flex:1;max-width:200px;height:4px;border-radius:2px;background:rgba(255,255,255,.2);overflow:hidden}
#twocode-ai-monitor.cl-new .gl-limit s{display:block;height:100%;border-radius:2px;background:#fff}
#twocode-ai-monitor.cl-new .gl-limit b{color:#fff;font-variant-numeric:tabular-nums}
#twocode-ai-monitor.cl-new .gl-compose{flex:1;height:32px;padding:0 3px 0 12px;border-radius:10px;background:rgba(255,255,255,.13)}
#twocode-ai-monitor.cl-new .gl-compose textarea{height:18px;font-size:13px;color:#fff}
#twocode-ai-monitor.cl-new .gl-compose textarea::placeholder{color:rgba(255,255,255,.55)}
#twocode-ai-monitor.cl-new .gl-compose #am-send{width:26px;height:26px;border-radius:7px;background:#fff;color:#000}
#twocode-ai-monitor.cl-new .gl-two{flex:none;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
#twocode-ai-monitor.cl-new .gl-two button{height:34px;border:0;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:6px;font:600 13px Inter,"Segoe UI",sans-serif;cursor:pointer}
#twocode-ai-monitor.cl-new .gl-two .gl-no{background:rgba(255,255,255,.14);color:#fff}#twocode-ai-monitor.cl-new .gl-two .gl-no:hover{background:rgba(255,255,255,.22)}
#twocode-ai-monitor.cl-new .gl-two .gl-yes{background:#fff;color:#000}#twocode-ai-monitor.cl-new .gl-two .gl-yes:hover{background:#e5e5ea}
#twocode-ai-monitor.cl-new .gl-two button:active{transform:scale(.98)}
#twocode-ai-monitor.cl-new .gl-col{flex:1;min-height:0;display:flex;flex-direction:column}
#twocode-ai-monitor.cl-new .gl-col .gl-tile{margin:4px 0 4px}
#twocode-ai-monitor.cl-new .gl-title{margin:0 0 8px;font-size:20px;line-height:24px;font-weight:700;letter-spacing:-.4px;color:#fff}
#twocode-ai-monitor.cl-new .gl-col .gl-card{max-height:none}
#twocode-ai-monitor.cl-new .gl-scroll{flex:1;min-height:0;overflow:auto;scrollbar-width:none}
#twocode-ai-monitor.cl-new .gl-note{flex:none;margin-top:8px;height:32px;border:0;border-radius:10px;background:rgba(255,255,255,.13);color:#fff;padding:0 12px;font:13px Inter,"Segoe UI",sans-serif;outline:none}
#twocode-ai-monitor.cc-antigravity .gl-tile > .gl-ico{background:linear-gradient(150deg,#1a73e8,#4285f4)}
#twocode-ai-monitor .am-capsules{display:flex;align-items:center;gap:6px;overflow-x:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent;padding:2px 2px 6px;margin-bottom:2px;flex:none}
#twocode-ai-monitor .am-capsules::-webkit-scrollbar{height:3px}
#twocode-ai-monitor .am-capsules::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:3px}
#twocode-ai-monitor .am-capsules::-webkit-scrollbar-track{background:transparent}
#twocode-ai-monitor .am-capsule{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 10px;border-radius:12px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.75);font:600 11px Inter,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap;flex:none;max-width:180px;transition:all .2s ease}
#twocode-ai-monitor .am-capsule:hover{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.24)}
#twocode-ai-monitor .am-capsule.active{background:rgba(255,255,255,.22);border-color:rgba(255,255,255,.38);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.3)}
#twocode-ai-monitor .am-cap-dot{width:6px;height:6px;border-radius:50%;background:var(--lamp,rgba(255,255,255,.45));box-shadow:0 0 5px var(--lamp,transparent);flex:none;transition:background .2s,box-shadow .2s}
#twocode-ai-monitor .am-cap-dot.blink{animation:am-pulse 1.1s ease-in-out infinite;box-shadow:0 0 8px var(--lamp,#30d158)}
#twocode-ai-monitor .am-cap-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
#twocode-ai-monitor .am-cap-time{font-size:10px;color:rgba(255,255,255,.55);font-variant-numeric:tabular-nums;flex:none}
#twocode-ai-monitor .gl-chat-prompt{display:flex;align-items:flex-start;gap:8px;padding:6px 10px;margin-bottom:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:9px;font-size:11.5px;line-height:15px;color:#fff;flex:none}
#twocode-ai-monitor .gl-prompt-badge{flex:none;margin-top:2px;display:flex;align-items:center;justify-content:center}
#twocode-ai-monitor .gl-prompt-badge.done{color:#30d158}
#twocode-ai-monitor .gl-prompt-badge.working{color:#ff9a1f}
#twocode-ai-monitor .gl-prompt-text{flex:1;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-weight:550;letter-spacing:-.1px}
#twocode-ai-monitor .gl-diff-stat{font-size:11px;color:rgba(255,255,255,.75);display:inline-flex;align-items:center;gap:3px}
#twocode-ai-monitor .gl-diff-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,.08);font-size:11px;color:rgba(255,255,255,.85);margin-bottom:6px;flex:none}
#twocode-ai-monitor .gl-diff-add{color:#30d158;font-weight:700}
#twocode-ai-monitor .gl-diff-del{color:#ff453a;font-weight:700}
#twocode-ai-monitor.cl-new .gl-tasks-scroll{flex:1;min-height:0;max-height:102px;overflow-y:auto;overflow-x:hidden;padding-right:3px;margin-top:2px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.25) transparent}
#twocode-ai-monitor.cl-new .gl-tasks-scroll::-webkit-scrollbar{width:4px}
#twocode-ai-monitor.cl-new .gl-tasks-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.25);border-radius:4px}
#twocode-ai-monitor.cl-new .gl-tasks-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.45)}
#twocode-ai-monitor.cl-new .gl-tasks-scroll .gl-row{border-radius:6px;padding:0 4px;transition:background .15s ease}
#twocode-ai-monitor.cl-new .gl-tasks-scroll .gl-row:hover{background:rgba(255,255,255,.07)}
#twocode-ai-monitor.twocode-glassy .gl-card{background:rgba(255,255,255,.07)!important;backdrop-filter:blur(24px) saturate(180%)!important;-webkit-backdrop-filter:blur(24px) saturate(180%)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18),0 8px 32px rgba(0,0,0,.36)!important}
#twocode-ai-monitor.twocode-glassy .gl-tile > .gl-ico{box-shadow:0 2px 10px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.25)!important}
#twocode-ai-monitor.twocode-glassy .am-capsule{background:rgba(255,255,255,.09)!important;backdrop-filter:blur(14px)!important;border-color:rgba(255,255,255,.16)!important}
#twocode-ai-monitor.twocode-glassy .am-capsule.active{background:rgba(255,255,255,.22)!important;border-color:rgba(255,255,255,.38)!important;box-shadow:0 4px 14px rgba(0,0,0,.35)!important}
#twocode-ai-monitor.twocode-glassy .gl-chip{background:rgba(255,255,255,.09)!important;backdrop-filter:blur(14px)!important;border:1px solid rgba(255,255,255,.16)!important}
#twocode-ai-monitor.twocode-glassy .gl-chip:hover{background:rgba(255,255,255,.18)!important;border-color:rgba(255,255,255,.28)!important}
#twocode-ai-monitor.twocode-glassy .am-gemini-menu{background:rgba(20,24,28,.88)!important;backdrop-filter:blur(30px)!important;border-color:rgba(255,255,255,.2)!important}
#twocode-ai-monitor.cl-new .ch-model-menu.am-gemini-menu{top:auto;bottom:34px;right:0;width:370px;max-height:220px;padding:8px 10px;border-radius:14px;background:#141715;border:1px solid rgba(255,255,255,.14);box-shadow:0 16px 36px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:6px;z-index:50;box-sizing:border-box}
#twocode-ai-monitor .am-gemini-menu .ch-model-head{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:700;color:#fff;padding:0 2px}
#twocode-ai-monitor .am-gemini-menu .ch-model-head small{font-size:10px;color:#9aa596}
#twocode-ai-monitor .am-gemini-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}
#twocode-ai-monitor .am-gemini-card{padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:2px;cursor:default;transition:all .15s ease}
#twocode-ai-monitor .am-gemini-card:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.18)}
#twocode-ai-monitor .am-gemini-card.on{background:rgba(66,133,244,.15);border-color:rgba(66,133,244,.4)}
#twocode-ai-monitor .am-gemini-card b{font-size:11px;font-weight:600;color:#fff;line-height:1.2}
#twocode-ai-monitor .am-gemini-card small{font-size:9.5px;line-height:1.2;color:rgba(255,255,255,.65)}
#twocode-ai-monitor .am-gemini-foot{margin:0;font-size:10px;color:rgba(255,255,255,.6);line-height:1.3;padding:0 2px}
@media(prefers-reduced-motion:reduce){#twocode-ai-monitor.cl-new .gl-tile > .gl-ico.live svg,#twocode-ai-monitor.cl-new .gl-steps .n i::after,#twocode-ai-monitor.cl-new .gl-think span,#twocode-ai-monitor.cl-new .gl-card{animation:none}}
@media(prefers-reduced-motion:reduce){#twocode-ai-monitor .ch-typing i{animation:none}#twocode-ai-monitor .cx-light i.blink,#twocode-ai-monitor .am-blink,#twocode-ai-monitor .am-wave{animation:none}}
`; document.head.appendChild(style);
  const escape = text => String(text || '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
  function md(text) {
    const inline = t => t.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    let html = '', list = null, block = null, para = [];
    const flush = () => { if (para.length) { html += '<p>' + inline(para.join('<br>')) + '</p>'; para = []; } }, close = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const line of escape(text).split('\n')) {
      if (/^\s*```/.test(line)) { if (block) { html += `<pre>${block.join('\n')}</pre>`; block = null; } else { flush(); close(); block = []; } continue; }
      if (block) { block.push(line); continue; }
      const item = line.match(/^\s*(?:([-•*])|(\d+)[.)])\s+(.*)$/), head = line.match(/^#{1,4}\s+(.*)$/);
      if (item) { flush(); const kind = item[1] ? 'ul' : 'ol'; if (list !== kind) { close(); html += `<${kind}>`; list = kind; } html += '<li>' + inline(item[3]) + '</li>'; continue; }
      if (head) { flush(); close(); html += '<p><b>' + inline(head[1]) + '</b></p>'; continue; }
      if (!line.trim()) { flush(); close(); continue; }
      close(); para.push(line);
    }
    if (block) html += `<pre>${block.join('\n')}</pre>`;
    flush(); close(); return html;
  }
  const providers = () => state.providers || [];
  const current = () => providers().find(p => p.provider === selected);
  // Claude Code only shows in the small island while a session has something to tell (like Coucou).
  const shown = p => p.connected && !(p.kind === 'hooks' && p.state === 'ready');
  const active = () => providers().some(shown);
  const busy = p => ['running', 'sending'].includes(p.state);
  const key = p => p?.provider + ':' + (p?.questionId || '');
  const colourOf = state => paletteColour(state) || colours[state] || colours.disconnected; // paletteColour: defined below, used after init
  const lamp = p => `<span class="am-dot ${busy(p) ? 'am-blink' : ''}" style="--lamp:${colourOf(p.state)}"></span>`;
  // After you have looked at Claude Code, green/red/question go quiet again (eyes back to normal).
  function markSeen() {
    if (currentView === 'monitor' && ['claudecode', 'codex', 'antigravity'].includes(selected) && api.aiMonitorHooksSeen) api.aiMonitorHooksSeen().then(update).catch(() => {});
  }
  function open(provider, exact) {
    // Claude Code, Codex, Antigravity, Claude or ChatGPT (the switch at the top of the page).
    // the AI tile on the home screen opens whichever AI has something to tell right now
    if (!provider) provider = 'antigravity';
    if (!exact && (provider === 'claudecode' || provider === 'antigravity') && top() && top().provider !== provider) provider = top().provider;
    const next = Object.hasOwn(names, provider) ? provider : 'antigravity';
    if (next !== selected) markSeen();
    selected = next; choosing = false; error = ''; render();
    setView('monitor'); setMode('expanded'); lastActivity = performance.now();
  }
  function small() {
    if (root.contains(document.activeElement)) document.activeElement.blur();
    markSeen(); currentView = 'home'; setMode('rest');
  }
  const bind = (id, fn) => root.querySelector('#' + id)?.addEventListener('click', fn);
  // Claude Code · Codex · Claude · ChatGPT: each with its own little lamp.
  function picker() {
    return `<div class="am-picks">${PICKS.map(([id, label]) => {
      const q = providers().find(x => x.provider === id), st = q?.connected ? (q.permission ? 'question' : q.state) : 'disconnected';
      return `<button type="button" class="am-pick ${selected === id ? 'on' : ''}" data-pick="${id}"><i class="${q && busy(q) ? 'am-blink' : ''}" style="--lamp:${q?.connected ? colourOf(st) : 'rgba(255,255,255,.18)'}"></i>${label}</button>`;
    }).join('')}</div>`;
  }
  function render() {
    const p = current(), input = root.querySelector('textarea');
    const focused = Boolean(input && input === document.activeElement), start = input?.selectionStart, end = input?.selectionEnd;
    const sub = p?.kind === 'hooks' ? (p.connected ? (p.source?.title ? `Project: ${p.source.title}` : `Volgt al je ${p.name}-sessies`) : 'Nog niet gekoppeld') : '';
    const savedCapsulesScrollLeft = root.querySelector('.am-capsules')?.scrollLeft;
    root.innerHTML = p?.kind === 'hooks' ? `<div class="am-shell">${hooksPage(p, sub)}${error ? `<div class="am-error" role="alert">${escape(error)}</div>` : ''}</div>`
      : `<div class="am-shell"><div class="tc-page-head"><div><p class="tc-page-title">${escape(p?.name || 'Claude Code')}</p><p class="tc-page-sub">${escape(sub)}</p></div><button type="button" id="am-small">Klein</button></div>${
      choosing ? `<div class="am-hint">Open ${escape(names[selected])} in je browser of desktopapp en log daar in. Laat het gesprek open in een eigen venster. Kies daarna dat venster.</div><div class="am-body">${windows.length ? windows.map((win, index) => `<button type="button" class="am-window" data-window="${index}" ${pending ? 'disabled' : ''}>${escape(win.title)} <span class="am-hint">· ${escape(win.process)}</span></button>`).join('') : '<div class="am-hint">Nog geen geschikt venster gevonden. Houd een websitegesprek in een eigen venster.</div>'}</div><div class="am-row"><button type="button" id="am-launch">Open ${escape(names[selected])}</button><button type="button" id="am-scan" ${pending ? 'disabled' : ''}>Vernieuwen</button><button type="button" id="am-cancel">Terug</button></div>` :
      p?.kind === 'hooks' ? hooksPage(p) :
      p?.soon ? `<div class="am-body"><p><strong>${escape(names[selected])} komt binnenkort</strong></p><p class="am-hint">Straks volgt Robo je ${escape(names[selected])}-gesprekken met de TwoCode-extensie voor Chrome. Nu volgt hij Claude Code en Codex.</p></div>` :
      !p?.connected ? `<div class="am-body"><p><strong>Volg ${escape(names[selected])} met Robo</strong></p><p class="am-hint">Zet ${escape(names[selected])} aan in TwoCode → Verbindingen. TwoCode zoekt je gesprek zelf; je hoeft geen venster te kiezen.</p></div><div class="am-row"><button type="button" class="am-primary" id="am-open-connect">Open Verbindingen</button></div>` : false ? `<div class="am-body"><p><strong>Verbind jouw gesprek</strong></p><p class="am-hint">Gebruik de browser of desktopapp waarin je bent ingelogd. Log in op de originele site of app. Je wachtwoord blijft bij ${escape(names[selected])}.</p><p class="am-hint">Houd het gesprek open in een eigen venster terwijl je verder werkt.</p></div><div class="am-row"><button type="button" class="am-primary" id="am-connect">Kies jouw venster</button><button type="button" id="am-launch">Open ${escape(names[selected])}</button></div>` :
      `<div class="am-row">${lamp(p)}<strong>${escape(p.detail || labels[p.state])}</strong><span class="am-clock">${p.elapsed || 0}s</span></div>${busy(p) ? '<div class="am-track" role="status" aria-label="AI is bezig"><div class="am-wave"></div></div>' : ''}<div class="am-hint am-source" title="${escape(p.source?.title)}">${escape(p.source?.process)} · ${escape(p.source?.title)}</div><div class="am-body">${p.state === 'question' ? `<div class="am-question">${escape(p.question)}</div>` : `<p class="am-hint">${p.state === 'done' ? 'Je antwoord staat klaar in het gesprek.' : p.state === 'ready' ? 'Ready. Stel je vraag in het gesprek; de island volgt daarna de status.' : p.state === 'unavailable' ? 'Het gesprek is niet meer leesbaar. Houd het open, herstel het venster als het geminimaliseerd is, of verbind opnieuw.' : busy(p) ? 'Werk verder in een andere app. Laat dit gesprekvenster open; de island meldt een vraag of afgerond antwoord.' : 'Open het gesprek om de situatie te controleren.'}</p>`}</div>${p.canReply ? '<div class="am-compose"><textarea id="am-answer" maxlength="5000" placeholder="Jouw antwoord…" aria-label="Antwoord op de vraag"></textarea><button type="button" class="am-primary" id="am-send">Verstuur</button></div>' : ''}<div class="am-row"><button type="button" id="am-launch">Open gesprek</button><button type="button" id="am-connect">Opnieuw verbinden</button><button type="button" id="am-disconnect">Ontkoppelen</button></div>`
    }${error ? `<div class="am-error" role="alert">${escape(error)}</div>` : ''}</div>`;
    bind('am-small', small); bind('am-connect', choose);
    bind('am-scan', scan); bind('am-launch', launch); bind('am-cancel', () => { choosing = false; error = ''; render(); });
    bind('am-disconnect', async () => { const result = await api.aiMonitorDisconnect(selected); if (result.ok) update(result); else { error = result.error; render(); } });
    bind('am-send', reply);
    bind('am-open-connect', () => { window.twocode.settingsOpen?.('connect'); small(); }); // connecting lives in the TwoCode app now
    bind('am-hooks-install', () => hooks('aiMonitorHooksInstall', current()?.agent)); bind('am-hooks-uninstall', () => hooks('aiMonitorHooksUninstall', current()?.agent));
    root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { if (b.dataset.pick !== selected) { markSeen(); selected = b.dataset.pick; choosing = false; error = ''; render(); } }));
    // Show the end of Claude's message (the question) when the answer box takes space.
    if (p?.kind === 'hooks' && !p.plan && !p.ask) { const body = root.querySelector('.am-body'); if (body) body.scrollTop = body.scrollHeight; }
    if (p?.ask) bindAsk(p);
    bind('am-plan-ok', () => hooks('aiMonitorHooksPlan', p?.sessionId, true, ''));
    bind('am-plan-no', () => hooks('aiMonitorHooksPlan', p?.sessionId, false, root.querySelector('#am-plan-note')?.value || ''));
    bind('am-jump', () => hooks('aiMonitorHooksJump', p?.sessionId));
    bind('am-model', () => { modelMenu = !modelMenu; render(); });
    for (const b of root.querySelectorAll('[data-model]')) b.addEventListener('click', () => { modelMenu = false; hooks('aiMonitorHooksModel', b.dataset.model); });
    root.querySelector('#am-plan-note')?.addEventListener('focus', () => { projectInputFocused = true; sendInteractive(true); });
    bind('am-allow',() => hooks('aiMonitorHooksDecide', p?.sessionId, 'allow')); bind('am-deny', () => hooks('aiMonitorHooksDecide', p?.sessionId, 'deny'));
    for (const b of root.querySelectorAll('.am-capsule[data-sid]')) b.addEventListener('click', () => hooks('aiMonitorHooksSelect', b.dataset.sid));
    for (const button of root.querySelectorAll('[data-provider]')) button.addEventListener('click', () => open(button.dataset.provider));
    for (const button of root.querySelectorAll('[data-window]')) button.addEventListener('click', () => connect(windows[Number(button.dataset.window)]?.id));

    const isGlassy = (typeof window.__twocodeIsGlassy === 'function' && window.__twocodeIsGlassy()) || localStorage.getItem('twocode:glassy') === '1';
    root.classList.toggle('twocode-glassy', isGlassy);
    document.body.classList.toggle('twocode-glassy', isGlassy);

    bind('am-glass-toggle', () => {
      const next = localStorage.getItem('twocode:glassy') === '1' ? '0' : '1';
      localStorage.setItem('twocode:glassy', next);
      root.classList.toggle('twocode-glassy', next === '1');
      document.body.classList.toggle('twocode-glassy', next === '1');
      sound('click');
      render();
    });

    const capsulesEl = root.querySelector('.am-capsules');
    if (capsulesEl) {
      if (savedCapsulesScrollLeft != null && savedCapsulesScrollLeft > 0) {
        capsulesEl.scrollLeft = savedCapsulesScrollLeft;
      }
      capsulesEl.addEventListener('wheel', e => {
        if (e.deltaY) {
          e.preventDefault();
          capsulesEl.scrollLeft += e.deltaY;
        }
      }, { passive: false });

      const activeCap = capsulesEl.querySelector('.am-capsule.active');
      if (activeCap) {
        const left = activeCap.offsetLeft - capsulesEl.offsetLeft;
        const right = left + activeCap.offsetWidth;
        if (left < capsulesEl.scrollLeft || right > capsulesEl.scrollLeft + capsulesEl.clientWidth) {
          activeCap.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    }

    const updateMarquees = () => {
      root.querySelectorAll('.gl-marquee-text').forEach(el => {
        const parent = el.parentElement;
        if (!parent) return;
        const diff = el.scrollWidth - parent.clientWidth;
        if (diff > 4) {
          el.style.setProperty('--scroll-dist', `-${diff + 16}px`);
          el.classList.add('scrolling');
        } else if ((el.textContent || '').length <= 20) {
          el.classList.remove('scrolling');
        }
      });
    };
    updateMarquees();
    requestAnimationFrame(updateMarquees);
    setTimeout(updateMarquees, 150);
    const fresh = root.querySelector('textarea');
    if (fresh) {
      fresh.value = drafts.get(key(p)) || ''; fresh.disabled = pending;
      fresh.addEventListener('input', () => drafts.set(key(current()), fresh.value));
      fresh.addEventListener('focus', () => { projectInputFocused = true; sendInteractive(true); });
      fresh.addEventListener('blur', () => { projectInputFocused = false; });
      fresh.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); reply(); } });
      if (focused) { fresh.focus(); if (typeof fresh.setSelectionRange === 'function') fresh.setSelectionRange(start, end); }
      const send = root.querySelector('#am-send'); if (send) send.disabled = pending;
    } else projectInputFocused = false;
  }
  // "5 uur: 23% · reset 14:30 · week: 41%" under the status.
  function usageLine(p) {
    const u = p.usage || {}, at = s => new Date(s * 1000).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const parts = [];
    if (u.fiveHour) parts.push(`5 uur: <b style="color:${ringColour(u.fiveHour.used)}">${u.fiveHour.used}%</b>${u.fiveHour.resetsAt ? ' · weer vol om ' + at(u.fiveHour.resetsAt) : ''}`);
    if (u.sevenDay) parts.push(`week: ${u.sevenDay.used}%`);
    if (u.context != null) parts.push(`gesprek ${u.context}% vol`);
    return parts.length ? `<div class="am-hint am-usage">${parts.join(' · ')}</div>` : '';
  }
  // Claude page, like an iPhone Live Activity:
  // left a big card with a real traffic light (TwoCode's idea), what Claude does now, a live timer and your question;
  // right the activity feed (one line per step, with an icon) and your 5-hour limit.
  // Questions, plans and permissions get the full width, so answering is easy.
  const ICON_PATHS = {
    read: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    run: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m7 10 3 2.5L7 15M12 15h4"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    web: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16"/>',
    agent: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2"/>',
    other: '<circle cx="12" cy="12" r="7"/><path d="M12 9v3l2 2"/>'
  };
  const svg = (name, size = 15) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ICON_PATHS.other}</svg>`;
  const EN = () => window.__twocodePrefs?.().lang === 'en', T = (nl, en) => EN() ? en : nl;
  const NOW_NL = { read: 'Leest', edit: 'Bewerkt', run: 'Voert uit', search: 'Zoekt', web: 'Zoekt online', agent: 'Helper bezig', other: 'Bezig' };
  const PAST_NL = { read: 'Gelezen', edit: 'Bewerkt', run: 'Uitgevoerd', search: 'Gezocht', web: 'Online gezocht', agent: 'Helper klaar', other: 'Gedaan' };
  const NOW_EN = { read: 'Reading', edit: 'Editing', run: 'Running', search: 'Searching', web: 'Searching the web', agent: 'Helper working', other: 'Working' };
  const PAST_EN = { read: 'Read', edit: 'Edited', run: 'Ran', search: 'Searched', web: 'Searched the web', agent: 'Helper done', other: 'Done' };
  const NOW = new Proxy({}, { get: (_, k) => (EN() ? NOW_EN : NOW_NL)[k] }), PAST = new Proxy({}, { get: (_, k) => (EN() ? PAST_EN : PAST_NL)[k] });
  const clock = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; // 0:42, 2:07 (like a timer)
  const shortWhat = (kind, what) => !what ? '' : ['read', 'edit'].includes(kind) ? what.split(/[\\/]/).pop() : what.replace(/\s+/g, ' ');
  // Live timer: the page is only rebuilt on events, so this ticks the seconds in between.
  setInterval(() => {
    for (const el of root.querySelectorAll('.cx-timer[data-live="1"]')) el.textContent = clock(Number(el.dataset.base) + Math.floor((Date.now() - Number(el.dataset.at)) / 1000));
  }, 1000);

  // Which Claude model Claude Code uses (written to Claude Code's settings.json by the main process).
  const MODEL_INFO = { default: [window.__twocodePrefs?.().lang === 'en' ? 'Default' : 'Standaard', 'Wat Claude Code zelf kiest'], opus: ['Opus', 'Het slimst, voor moeilijke klussen'], sonnet: ['Sonnet', 'Snel en slim, voor de meeste dingen'],
    haiku: ['Haiku', 'Supersnel, voor kleine dingen'], opusplan: ['Opus plan', 'Opus plant, Sonnet bouwt'] };
  const GEMINI_MODELS = {
    'gemini-3.8': ['Gemini 3.8 Flash', 'Standaardmodel voor Antigravity 2.0 (snel en krachtig)'],
    'gemini-3.8-thinking': ['Gemini 3.8 Thinking', 'Geavanceerd redeneren en diepe planning'],
    'gemini-2.5-pro': ['Gemini 2.5 Pro', 'Complexe codeer- en architectuurtaken'],
    'gemini-2.5-flash': ['Gemini 2.5 Flash', 'Lichtgewicht en ultrasnel']
  };
  const GEMINI_MODELS_EN = {
    'gemini-3.8': ['Gemini 3.8 Flash', 'Default model for Antigravity 2.0 (fast & powerful)'],
    'gemini-3.8-thinking': ['Gemini 3.8 Thinking', 'Deep reasoning and complex planning'],
    'gemini-2.5-pro': ['Gemini 2.5 Pro', 'Complex coding and architecture tasks'],
    'gemini-2.5-flash': ['Gemini 2.5 Flash', 'Lightweight and ultra-fast']
  };
  let modelMenu = false;
  function modelPicker(p) {
    if (p.agent === 'antigravity') {
      const activeRaw = p.modelNow || p.model || 'gemini-3.8';
      const cleanActive = String(activeRaw)
        .replace(/^gemini-/i, 'Gemini ')
        .replace(/-flash-high/i, ' 3.8 Flash')
        .replace(/-/g, ' ');
      const button = `<button type="button" class="ch-model gl-chip" id="am-model" aria-expanded="${modelMenu}" title="${T('Antigravity Gemini model', 'Antigravity Gemini model')}"><em>Model</em>${escape(cleanActive)}<span>▾</span></button>`;
      const models = EN() ? GEMINI_MODELS_EN : GEMINI_MODELS;
      const menu = !modelMenu ? '' : `<div class="ch-model-menu am-gemini-menu" role="menu"><div class="ch-model-head"><span>${T('Welk model gebruikt Antigravity?', 'Which model does Antigravity use?')}</span>${p.modelNow ? `<small>${T('Nu in gebruik', 'In use')}: ${escape(cleanActive)}</small>` : ''}</div><div class="am-gemini-grid">${
        Object.entries(models).map(([key, [name, info]]) => `<div class="am-gemini-card ${cleanActive.toLowerCase().includes(name.toLowerCase().replace('gemini ', '')) ? 'on' : ''}"><b>${name}</b><small>${info}</small></div>`).join('')
      }</div><p class="am-gemini-foot">${T('Kies je model linksonder in het Antigravity-venster.', 'Choose your model in the bottom-left of Antigravity.')}</p></div>`;
      return { button, menu };
    }
    const current = p.model || 'default', label = (current === 'default' ? T('Standaard', 'Default') : null) || MODEL_INFO[current]?.[0] || String(current).replace(/^custom:/, '');
    const button = `<button type="button" class="ch-model gl-chip" id="am-model" aria-expanded="${modelMenu}" title="Kies welk Claude-model Claude Code gebruikt"><em>Model</em>${escape(label)}<span>▾</span></button>`;
    const menu = !modelMenu ? '' : `<div class="ch-model-menu" role="menu"><div class="ch-model-head">Welk model gebruikt Claude?${p.modelNow ? `<small>Nu in gebruik: ${escape(p.modelNow)}</small>` : ''}</div>${
      Object.entries(MODEL_INFO).map(([key, [name, info]]) => `<button type="button" role="menuitemradio" aria-checked="${key === current}" class="${key === current ? 'on' : ''}" data-model="${key}"><b>${name}</b><small>${info}</small>${key === current ? '<i>✓</i>' : ''}</button>`).join('')
    }<p>Voor nieuwe sessies · in een lopend gesprek: <code>/model</code></p></div>`;
    return { button, menu };
  }

  // Code live (like an editor): the lines Claude changes, red out / green in, with line numbers and Xcode's dark colours.
  const KEYWORDS = /^(const|let|var|function|return|import|export|from|default|if|else|for|while|of|in|class|new|async|await|try|catch|throw|def|self|elif|None|True|False|true|false|null|undefined|this|type|interface|public|private|static|void|int|string|bool)$/;
  function syntax(line) {
    const out = [], re = /(\/\/.*$|#\s.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
    let last = 0, m;
    while ((m = re.exec(line))) {
      out.push(escape(line.slice(last, m.index)));
      const [all, comment, str, num, word] = m;
      out.push(comment ? `<span class="sx-c">${escape(all)}</span>` : str ? `<span class="sx-s">${escape(all)}</span>` : num ? `<span class="sx-n">${escape(all)}</span>`
        : KEYWORDS.test(word) ? `<span class="sx-k">${escape(all)}</span>` : /^[A-Z]/.test(word) ? `<span class="sx-t">${escape(all)}</span>` : escape(all));
      last = m.index + all.length;
    }
    out.push(escape(line.slice(last)));
    return out.join('');
  }
  function codePanel(code, max = 6) {
    let del = code.start || 1, add = code.start || 1;
    const rows = (code.lines || []).slice(0, max).map(l => { const n = l.t === '-' ? del++ : add++;
      return `<div class="lv-ln ${l.t === '-' ? 'del' : 'add'}"><i>${n}</i><b>${l.t === '-' ? '−' : '+'}</b><code>${syntax(l.text)}</code></div>`; }).join('');
    const ext = (/\.([a-z0-9]{1,4})$/i.exec(code.file || '')?.[1] || '').toUpperCase();
    return `<div class="lv-code"><div class="lv-file">${ext ? `<span>${escape(ext)}</span>` : ''}${escape(code.file || '')}<em>${T('wordt aangepast', 'being edited')}</em></div>${rows}</div>`;
  }
  function termPanel(run) {
    const out = (run.out || []).slice(-3).map((l, i, all) => `<div class="lv-out${run.failed && i === all.length - 1 ? ' bad' : ''}">${escape(l)}</div>`).join('') || `<div class="lv-out dim">${T('Bezig…', 'Running…')}</div>`;
    return `<div class="lv-code lv-term"><div class="lv-file"><span>$</span>${escape(run.command)}</div>${out}</div>`;
  }
  let claudeTall = false; // the page grows a little while it shows code or the terminal
  function hooksPage(p) {
    claudeTall = false;
    const off = pending ? 'disabled' : '';
    const st = p.permission ? 'question' : p.state;
    const project = p.source?.title && p.source.title !== 'Geen actieve sessie' ? p.source.title : '';
    const statusText = EN() ? ({ running: 'Working', sending: 'Working', question: 'Waiting for you', done: 'Done', error: 'Error', stopped: 'Stopped' }[st] || 'Idle')
      : ({ running: 'Bezig', sending: 'Bezig', question: 'Wacht op jou', done: 'Klaar', error: 'Fout', stopped: 'Gestopt' }[st] || 'Rustig');
    // Only while Claude works: a live timer. When he's done the time doesn't matter anymore.
    const timer = busy(p) ? ` · <b class="cx-timer" data-live="1" data-base="${p.elapsed || 0}" data-at="${Date.now()}">${clock(p.elapsed || 0)}</b>` : '';
    const calm = p.agent === 'codex' ? '#5b9bff' : '#e8865a', lampOf = x => ['ready', 'disconnected', 'connecting'].includes(x) ? calm : colourOf(x); // quiet = the AI's own colour, not grey
    const pill = p.connected ? `<span class="ch-status" style="--lamp:${lampOf(st)}"><i class="${busy(p) ? 'am-blink' : ''}"></i>${statusText}${timer}</span>` : '';
    const jump = p.canJump ? `<button type="button" class="cx-jump" id="am-jump" title="Breng het ${escape(p.name)}-venster naar voren">${p.agent === 'antigravity' ? 'Naar Antigravity' : 'Naar terminal'} <span>↗</span></button>` : '';
    const picker = p.connected && p.agent !== 'codex' ? modelPicker(p) : { button: '', menu: '' }; // the Claude model choice is for Claude Code only
    const head = p.connected
      ? `<div class="tc-page-head"><div class="cc-pill"><i style="--lamp:${lampOf(st)}" class="${busy(p) ? 'am-blink' : ''}"></i>${escape(project || p.name)}${project ? `<span>· ${escape(p.name)}</span>` : ''}</div><div class="ch-head-right">${picker.button}${pill}${jump}</div></div>${picker.menu}`
      : `<div class="tc-page-head"><div><p class="cc-kicker">${escape(p.name)}</p><p class="tc-page-title">${escape(project || p.name)}</p></div><div class="ch-head-right">${picker.button}${pill}${jump}</div></div>${picker.menu}`;
    if (!p.connected) {
      if (p.agent === 'codex' && p.available === false) return head + `<div class="cc-card cc-wide"><p class="cc-big">Codex staat nog niet op deze pc</p><p class="am-hint">Installeer Codex (de AI-programmeerhulp van OpenAI) en open hem één keer. Kom daarna hier terug om hem te koppelen.</p></div>`;
      if (p.agent === 'antigravity') {
        return head + `<div class="cc-card cc-wide"><p class="cc-big">Antigravity 2.0 gekoppeld</p><p class="am-hint">TwoCode volgt je Antigravity 2.0 sessies live via hooks. Geef een opdracht in Antigravity om live acties te volgen.</p></div>`;
      }
      return head + `<div class="cc-card cc-wide"><p class="cc-big">Zie meteen wat ${escape(p.name)} doet</p><p class="am-hint">Bezig, een vraag, klaar of een fout: TwoCode laat het zien${p.agent === 'codex' ? ', terwijl jij iets anders doet' : ', ook als je Claude Code vanaf je telefoon bestuurt'}.</p>${
        p.error ? `<p class="am-error">${escape(p.error)}</p>` : p.hooksInstalled ? '<p class="am-hint">Gekoppeld. Even wachten tot TwoCode klaar is met starten.</p>'
          : `<button type="button" class="am-primary" id="am-open-connect">Koppelen in TwoCode</button><p class="am-hint">Eén schakelaar in TwoCode → Verbindingen. Daarna doet TwoCode de rest.</p>`}</div>`;
    }

    // ---- the glow, like the music page: black at the top, the colour of what happens rising from the bottom (glowOf, drawn
    // on the island). Left one big thing (the time, or how many jobs today), right a frosted card with what happens now
    // (the code, the terminal, the steps, his answer, his question); at the bottom how far he is. ----
    const capsules = (p.list && p.list.length > 1)
      ? `<div class="am-capsules">${p.list.map(item => {
          const isWorking = item.state === 'running' || item.state === 'sending';
          const capDotColor = isWorking ? '#30d158' : (item.state === 'error' ? '#ff3b3b' : (item.state === 'question' ? '#ff9a1f' : 'rgba(255,255,255,.45)'));
          return `
          <button type="button" class="am-capsule ${item.active ? 'active' : ''}" data-sid="${escape(item.id)}" title="${escape(item.title || item.project)}">
            <i class="am-cap-dot ${isWorking ? 'blink' : ''}" style="--lamp:${capDotColor}"></i>
            <span class="am-cap-name">${escape(item.title || item.project)}</span>
            ${item.elapsed ? `<span class="am-cap-time">${clock(item.elapsed)}</span>` : ''}
          </button>`;
        }).join('')}</div>`
      : '';
    const steps = p.steps || [], working = busy(p), failed = ['error', 'stopped'].includes(st);
    const idle = !working && !p.prompt && !['done', 'question', 'error', 'stopped'].includes(st);
    const MARK = p.agent === 'antigravity'
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C12 7.5 7.5 12 2 12C7.5 12 12 16.5 12 22C12 16.5 16.5 12 22 12C16.5 12 12 7.5 12 2Z"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 4v16M4 12h16M6.3 6.3l11.4 11.4M17.7 6.3 6.3 17.7"/></svg>';
    const CHECK = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7"/></svg>';
    const CROSS = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    const where = escape(project || p.name);
    const isLong = where.length > 20;
    const estDist = Math.max(40, (where.length - 18) * 8.5);
    const tile = `<div class="gl-tile" title="${where}"><span class="gl-ico ${working ? 'live' : ''}">${MARK}</span><div class="gl-marquee"><div class="gl-marquee-text ${isLong ? 'scrolling' : ''}" style="--scroll-dist:-${estDist}px">${where}</div></div></div>`;
    const two = (noId, noLabel, yesId, yesLabel) => `<div class="gl-two"><button type="button" class="gl-no" id="${noId}" ${off}>${noLabel}</button><button type="button" class="gl-yes" id="${yesId}" ${off}>${yesLabel}</button></div>`;
    // Claude needs you: the question big on the left, what he wants to do in the card, two same-size buttons
    if (p.permission || p.ask || p.plan) {
      const lastAsk = steps[steps.length - 1], editAsk = p.permission && p.code && lastAsk?.kind === 'edit' && lastAsk.state === 'running';
      claudeTall = Boolean(editAsk || p.plan || p.ask);
      if (p.permission && !p.ask && !p.plan) return capsules + `<div class="gl-main"><div class="gl-l">${tile}<p class="gl-big word">${T('Mag dit?', 'May I?')}</p><p class="gl-sub">${escape(p.permission.tool || T(p.name + ' wil iets doen', p.name + ' wants to do something'))}</p></div>`
        + `<div class="gl-card">${editAsk ? codePanel(p.code, 6) : `<div class="gl-cmd"><span>$</span>${escape(p.permission.what || p.permission.tool)}</div>`}</div></div>`
        + two('am-deny', CROSS + T('Weigeren', 'Deny'), 'am-allow', CHECK + T('Toestaan', 'Allow'));
      if (p.plan) return capsules + `<div class="gl-col">${tile}<p class="gl-title">${T(p.name + ' heeft een plan', p.name + ' has a plan')}</p><div class="gl-card gl-scroll am-plan">${planHtml(p.plan)}</div>`
        + `<input id="am-plan-note" class="gl-note" maxlength="4000" placeholder="${T('Wat moet er anders? (mag leeg)', 'What should change? (optional)')}">${two('am-plan-no', T('Aanpassen', 'Change it'), 'am-plan-ok', T('Goedkeuren', 'Approve'))}</div>`;
      return capsules + `<div class="gl-col">${tile}<p class="gl-title">${T(p.name + ' vraagt iets', p.name + ' asks something')}</p><div class="gl-card gl-scroll">${askForm(p)}</div></div>`;
    }
    const phase = st === 'done' ? 3 : steps.reduce((m, x) => Math.max(m, x.kind === 'edit' ? 1 : x.kind === 'run' ? 2 : 0), 0);
    const isBg = Boolean(p.background || (p.detail && p.detail.includes('achtergrond')));
    const doing = isBg ? T('1 taak op achtergrond', '1 task in background')
      : !steps.length ? T('Denkt na', 'Thinking')
      : [T('Code lezen', 'Reading code'), T('Aanpassen', 'Making changes'), T('Tests draaien', 'Running tests')][Math.min(2, phase)];
    const past = (state.history || []).filter(h => (h.agent || 'claude') === (p.agent || 'claude'));
    const today = past.filter(h => new Date(h.at).toDateString() === new Date().toDateString() && h.result === 'done').length;
    const five = p.usage?.fiveHour, lastStep = steps[steps.length - 1];
    const RES = { done: ['ok', CHECK], question: ['ask', '?'], error: ['bad', '!'], stopped: ['bad', '!'] };

    const chatPrompt = p.prompt || p.preview || '';
    const isChatWorking = working;
    const promptHeader = chatPrompt ? `
      <div class="gl-chat-prompt">
        <span class="gl-prompt-badge ${isChatWorking ? 'working' : 'done'}">
          ${isChatWorking ? '<i class="am-cap-dot blink" style="--lamp:#ff9a1f;width:8px;height:8px"></i>' : CHECK}
        </span>
        <span class="gl-prompt-text" title="${escape(chatPrompt)}">
          ${escape(chatPrompt)}
        </span>
      </div>` : '';

    const hasGit = Boolean(p.gitStats && (p.gitStats.files > 0 || p.gitStats.additions > 0 || p.gitStats.deletions > 0));
    const diffPill = hasGit ? `
      <div class="gl-diff-pill">
        <b>${p.gitStats.files} ${p.gitStats.files === 1 ? 'file' : 'files'} changed</b>
        <span class="gl-diff-add">+${p.gitStats.additions}</span>
        <span class="gl-diff-del">-${p.gitStats.deletions}</span>
      </div>` : '';

    let big, word = false, sub, card;
    if (idle) {
      if (hasGit) {
        big = `${p.gitStats.files} files`;
        word = true;
        sub = `<span class="gl-diff-stat"><b>changed</b> <span class="gl-diff-add">+${p.gitStats.additions}</span> <span class="gl-diff-del">-${p.gitStats.deletions}</span></span>`;
      } else {
        big = p.elapsed ? clock(p.elapsed) : T('Klaar', 'Done');
        word = true;
        sub = p.workspace ? `Project · ${escape(p.workspace)}` : T('Klaar · gereed', 'Done · ready');
      }
      const pastDistinct = [];
      for (const h of past) {
        if (!pastDistinct.some(x => x.prompt === h.prompt || (x.project && x.project === h.project))) {
          pastDistinct.push(h);
        }
        if (pastDistinct.length >= 25) break;
      }
      const sessionSummary = p.lastMessage || (p.preview && p.preview !== chatPrompt ? p.preview : '');
      const bodyContent = sessionSummary && sessionSummary !== where && sessionSummary !== chatPrompt
        ? `<div class="gl-tasks-scroll"><div class="gl-md md" style="font-size:12px;line-height:16px">${md(sessionSummary)}</div></div>`
        : pastDistinct.length
          ? `<p class="gl-cap">${T('Laatst gedaan', 'Recently')}</p><div class="gl-tasks-scroll">` + pastDistinct.map(h => { const [cls, g] = RES[h.result] || ['', '•'];
            return `<div class="gl-row h" title="${escape(h.prompt)}"><i class="gl-dot ${cls}">${g}</i><b>${escape(h.prompt)}</b><em>${escape(new Date(h.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }))}</em></div>`; }).join('') + `</div>`
          : `<div class="gl-empty">${T('Klaar voor je volgende vraag.', 'Ready for your next prompt.')}</div>`;
      card = promptHeader + diffPill + bodyContent;
    } else if (st === 'question') {
      big = T('Jouw beurt', 'Your turn'); word = true; sub = T(p.name + ' wacht op je antwoord', p.name + ' is waiting for you');
      card = promptHeader + `<div class="gl-md md">${md(p.question || p.lastMessage || T(p.name + ' heeft je nodig.', p.name + ' needs you.'))}</div>`;
    } else if (st === 'done') {
      if (hasGit) {
        big = `${p.gitStats.files} files`;
        word = true;
        sub = `<span class="gl-diff-stat"><b>changed</b> <span class="gl-diff-add">+${p.gitStats.additions}</span> <span class="gl-diff-del">-${p.gitStats.deletions}</span></span>`;
      } else {
        big = p.elapsed ? clock(p.elapsed) : T('Klaar', 'Done');
        word = !p.elapsed;
        sub = T('Klaar · alle taken voltooid', 'Done · all tasks finished');
      }
      card = promptHeader + diffPill + `<div class="gl-md md">${p.lastMessage ? md(p.lastMessage) : T('Klaar. Het antwoord staat klaar.', 'Done. The answer is ready.')}</div>`;
    } else if (failed) {
      big = T('Gestopt', 'Stopped'); word = true; sub = escape(p.detail || T('Er ging iets mis', 'Something went wrong'));
      card = promptHeader + `<div class="gl-md"><b>${escape(p.detail || T('Er ging iets mis', 'Something went wrong'))}</b><br>${T('Kijk in de terminal wat er misging.', 'Check the terminal to see what went wrong.')}</div>`;
    } else {
      big = `<span class="cx-timer" data-live="1" data-base="${p.elapsed || 0}" data-at="${Date.now()}">${clock(p.elapsed || 0)}</span>`;
      sub = isBg ? T('1 taak op de achtergrond', '1 task running in background') : `${doing} · ${T(`stap ${Math.min(4, phase + 1)} van 4`, `step ${Math.min(4, phase + 1)} of 4`)}`;
      card = promptHeader + (lastStep?.kind === 'edit' && p.code ? codePanel(p.code, 3)
        : lastStep?.kind === 'run' && p.run ? termPanel(p.run)
        : !steps.length ? `<div class="gl-think"><span>${isBg ? '⚡ ' + T('1 taak draait op de achtergrond…', '1 task running in background…') : T(p.name + ' denkt na…', p.name + ' is thinking…')}</span></div>`
        : steps.slice(-3).map(x => { const now = x.state === 'running';
          return `<div class="gl-row${now ? '' : ' d'}"><i class="ic">${svg(x.kind, 12)}</i><b>${(now ? NOW : PAST)[x.kind] || ''}</b><code>${escape(shortWhat(x.kind, x.what))}</code>${now ? '<span class="gl-spin"></span>' : `<span class="gl-ok">${CHECK}</span>`}</div>`; }).join(''));
    }
    const PH = [T('Lezen', 'Read'), T('Aanpassen', 'Edit'), T('Testen', 'Test'), T('Klaar', 'Done')];
    const stepBar = `<div class="gl-steps${st === 'done' ? ' done' : failed ? ' bad' : ''}">${PH.map((label, i) => {
      const cls = st === 'done' || i < phase ? 'd' : i === phase && (working || failed) ? 'n' : ''; return `<div class="${cls}"><i></i><span>${label}</span></div>`; }).join('')}</div>`;
    const compose = p.canReply && !p.ask && !p.plan && !p.permission
      ? `<div class="ch-compose gl-compose"><textarea id="am-answer" maxlength="5000" placeholder="${st === 'question' ? T('Jouw antwoord…', 'Your answer…') : T('Typ iets voor Claude…', 'Type something for Claude…')}" aria-label="${T('Bericht aan Claude Code', 'Message to Claude Code')}"></textarea><button type="button" id="am-send" aria-label="${T('Stuur', 'Send')}" title="${T('Stuur (Enter)', 'Send (Enter)')}">↑</button></div>` : '';
    const limit = five ? `<div class="gl-limit">${T('5-uurslimiet', '5-hour limit')}<i><s style="width:${Math.min(100, five.used)}%"></s></i><b>${five.used}%</b></div>` : '<span></span>';
    const isGlassy = (typeof window.__twocodeIsGlassy === 'function' && window.__twocodeIsGlassy()) || localStorage.getItem('twocode:glassy') === '1';
    const glassToggle = `<button type="button" class="gl-chip" id="am-glass-toggle" title="${T('Wissel tussen mat glas en pikzwart', 'Toggle frosted glass / solid black')}">${isGlassy ? '✨ Glassy' : '◼ Solid'}</button>`;
    const term = p.canJump ? `<button type="button" class="gl-chip" id="am-jump" title="${T('Breng het ' + escape(p.name) + '-venster naar voren', 'Bring ' + escape(p.name) + ' to front')}">${p.agent === 'antigravity' ? 'Antigravity' : 'Terminal'}<em>↗</em></button>` : '';
    const foot = `<div class="gl-foot">${idle ? limit : compose || stepBar}<span class="gl-tools">${idle ? picker.button : ''}${glassToggle}${term}</span>${idle ? picker.menu : ''}</div>`;
    return capsules + `<div class="gl-main"><div class="gl-l">${tile}<p class="gl-big${word ? ' word' : ''}">${big}</p><p class="gl-sub">${sub}</p></div><div class="gl-card">${card}</div></div>${foot}`;
  }
  // "Gelezen 3 · bewerkt 2 · opdrachten 1" for this turn.
  function statsLine(stats = {}) {
    const names = { read: 'gelezen', edit: 'bewerkt', run: 'opdrachten', search: 'gezocht', web: 'internet', agent: 'helpers' };
    const parts = Object.entries(names).filter(([k]) => stats[k]).map(([k, label]) => `${label} <b>${stats[k]}</b>`);
    return parts.length ? `<div class="am-hint am-usage">🛠 ${parts.join(' · ')}</div>` : '';
  }
  // Multiple-choice questions: click an option (or several), or type your own answer.
  let askKey = '', askPick = {}, askOther = {};
  function askForm(p) {
    const keyNow = p.sessionId + JSON.stringify(p.ask);
    if (keyNow !== askKey) { askKey = keyNow; askPick = {}; askOther = {}; }
    return p.ask.map((q, qi) => `<div class="am-ask"><div class="am-said">${q.header ? `<span class="am-tag">${escape(q.header)}</span>` : ''}${escape(q.question)}${q.multiSelect ? ` <i>(${T('kies er meer', 'pick one or more')})</i>` : ''}</div><div class="am-options">${
      q.options.map((o, oi) => `<button type="button" class="am-option ${(askPick[qi] || []).includes(o.label) ? 'on' : ''}" data-q="${qi}" data-o="${oi}" title="${escape(o.description)}"><b>${escape(o.label)}</b>${o.description ? `<small>${escape(o.description)}</small>` : ''}</button>`).join('')
    }</div><div class="cc-inline"><input class="am-note" data-other="${qi}" maxlength="2000" placeholder="${T('Of typ je eigen antwoord…', 'Or type your own answer…')}" value="${escape(askOther[qi] || '')}">${qi === p.ask.length - 1 ? `<button type="button" class="am-primary" id="am-ask-send" ${pending ? 'disabled' : ''}>${T('Stuur', 'Send')}</button>` : ''}</div></div>`).join('');
  }
  function bindAsk(p) {
    for (const b of root.querySelectorAll('[data-q]')) b.addEventListener('click', () => {
      const qi = Number(b.dataset.q), q = p.ask[qi], label = q.options[Number(b.dataset.o)].label, list = askPick[qi] || [];
      askPick[qi] = q.multiSelect ? (list.includes(label) ? list.filter(x => x !== label) : [...list, label]) : [label];
      askOther[qi] = '';
      // One single-choice question: one click is enough.
      if (p.ask.length === 1 && !q.multiSelect) sendAsk(p); else render();
    });
    for (const input of root.querySelectorAll('[data-other]')) {
      input.addEventListener('input', () => { askOther[Number(input.dataset.other)] = input.value; });
      input.addEventListener('focus', () => { projectInputFocused = true; sendInteractive(true); });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendAsk(p); } });
    }
    bind('am-ask-send', () => sendAsk(p));
  }
  function sendAsk(p) {
    const answers = {};
    p.ask.forEach((q, qi) => { answers[q.question] = (askOther[qi] || '').trim() || (q.multiSelect ? askPick[qi] || [] : (askPick[qi] || [])[0] || ''); });
    hooks('aiMonitorHooksAnswer', p.sessionId, answers);
  }
  // Plans are Markdown: show headings, lists and code in a readable way.
  function planHtml(md) {
    return escape(md).split('\n').map(line => {
      const inline = s => s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
      if (/^#{1,6}\s/.test(line)) return `<h4>${inline(line.replace(/^#+\s*/, ''))}</h4>`;
      if (/^\s*([-*]|\d+\.)\s/.test(line)) return `<div class="am-li">• ${inline(line.replace(/^\s*([-*]|\d+\.)\s/, ''))}</div>`;
      return line.trim() ? `<p>${inline(line)}</p>` : '';
    }).join('');
  }
  async function hooks(method, ...args) {
    if (pending) return; pending = true; error = ''; render();
    try { const result = await api[method](...args); if (result.ok) update(result); else error = result.error; }
    catch (failure) { error = failure.message; } finally { pending = false; render(); }
  }
  async function launch() {
    const result = await api.aiMonitorOpenSource(selected);
    if (!result.ok) { error = result.error; render(); }
  }
  async function choose() { choosing = true; error = ''; render(); await scan(); }
  async function scan() {
    if (pending) return; pending = true; render();
    try { const result = await api.aiMonitorWindows(); windows = result.windows || []; error = result.ok ? '' : result.error; }
    catch (failure) { error = failure.message; } finally { pending = false; render(); }
  }
  async function connect(targetId) {
    if (pending || !targetId) return; const provider = selected; pending = true; error = ''; render();
    try {
      const result = await api.aiMonitorConnect(provider, targetId);
      if (result.ok) { choosing = false; update(result); } else error = result.error;
    } catch (failure) { error = failure.message; } finally { pending = false; render(); }
  }
  async function reply() {
    const p = current(), text = (drafts.get(key(p)) || '').trim();
    if (pending || !p?.canReply || !text) return;
    const provider = p.provider, questionId = p.questionId, draftKey = key(p);
    pending = true; error = ''; render();
    try {
      // Claude Code: the answer wakes Claude through the asyncRewake Stop hook.
      const result = p.kind === 'hooks' ? await api.aiMonitorHooksReply(p.sessionId, text) : await api.aiMonitorReply(provider, questionId, text);
      if (result.ok && p.kind === 'hooks') update(result);
      if (result.ok) drafts.delete(draftKey); else error = result.error;
    } catch (failure) { error = failure.message; } finally { pending = false; render(); }
  }
  let stateAt = Date.now(); // when the last state arrived (the clock on Home counts on from there)
  // Done: a steady blue until you look at it (open the Claude page), then green that slowly fades away.
  let doneKey = '', doneSeenAt = 0;
  const DONE_BLUE = '#0a84ff', DONE_FADE = 2800;
  const claudeHooks = () => providers().find(q => q.kind === 'hooks' && q.connected) || providers().find(q => q.kind === 'hooks');
  window.__twocodeDoneLook = p => { // null, or { colour, k } (k: how strong the glow is, 0..1)
    if (!p || p.state !== 'done' || p.permission) return null;
    if (!doneSeenAt) return { colour: DONE_BLUE, k: 1, fresh: true };
    const k = 1 - (performance.now() - doneSeenAt) / DONE_FADE;
    return k > 0 ? { colour: '#30d158', k: k * k * (3 - 2 * k) } : null;
  };
  function update(next) {
    stateAt = Date.now();
    { const q = next?.providers?.find?.(x => x.kind === 'hooks' && x.state === 'done'), key = q ? `${q.sessionId}:${q.elapsed}:${q.prompt}` : '';
      if (key && key !== doneKey) { doneKey = key; doneSeenAt = 0; } if (!key) doneKey = ''; }
    if (!next?.ok || !Array.isArray(next.providers)) return;
    state = next; window.__twocodeMonitorIndicator = providers();
    try { askSize(); settleSize(); } catch {} // a task that starts or ends changes the small island right away
    // Ignore ticking clocks when deciding to re-render; they are updated in place below.
    const signature = JSON.stringify(providers().map(p => ({ ...p, elapsed: 0, list: p.list?.map(s => ({ ...s, elapsed: 0 })) }))) + (state.history?.[0]?.at || 0);
    if (signature !== lastSignature) {
      lastSignature = signature; render();
      statusReader.textContent = providers().map(p => `${p.name}: ${labels[p.state]}`).join('. ');
    }
    const clock = root.querySelector('.am-clock:not([data-sid])'); if (clock) clock.textContent = `${current()?.elapsed || 0}s`;
    for (const item of current()?.list || []) {
      const el = [...root.querySelectorAll('.am-clock[data-sid]')].find(x => x.dataset.sid === item.id); if (el) el.textContent = `${item.elapsed}s`;
    }
  }
  // ---- Traffic light in the eyes of the ghost (read by drawGhost in mascot.html) ----
  // Bright, saturated colours so they stand out from the normal pale eyes, even in the tiny island.
  const EYES = { running: { color: '#ff9a1f', blink: true }, sending: { color: '#ff9a1f', blink: true }, question: { color: '#ff9a1f' },
    done: { color: '#22e05a' }, error: { color: '#ff3b3b' }, stopped: { color: '#ff3b3b' }, unavailable: { color: '#ff3b3b' } };
  const PRIORITY = ['question', 'error', 'stopped', 'unavailable', 'running', 'sending', 'done'];
  const top = () => providers().filter(shown).sort((a, b) => PRIORITY.indexOf(a.state) - PRIORITY.indexOf(b.state))[0];
  // A colour-blind friendly palette can be chosen in Settings (twocode-fun.js provides it).
  const paletteColour = state => {
    const pal = window.__twocodePalette?.(); if (!pal) return null;
    return { running: pal.busy, sending: pal.busy, question: pal.question, done: pal.done, error: pal.error, stopped: pal.error, unavailable: pal.error }[state] || null;
  };
  window.__twocodeEyes = () => { const s = top()?.state, e = EYES[s]; return e ? { ...e, color: paletteColour(s) || e.color } : null; };
  window.__twocodeStateColour = s => paletteColour(s) || EYES[s]?.color || null; // your traffic-light colours (Robo's stage glows in them too)
  // Leaving the Claude Code screen any other way (home, apps, settings) also counts as "seen".
  const oldSetView = setView;
  setView = function (next) { if (next !== 'monitor') markSeen(); return oldSetView(next); };

  // ---- Three sizes: small (rest), medium (compact: music), large (expanded) ----
  const music = () => Boolean(spotifyConnected && spotifyState.is_playing && spotifyState.track);
  // Medium size stays while music plays or a focus timer runs.
  // ...and while it shows a short message (startup "Hoi!", volume bar, battery), so that isn't closed right away.
  const needsAnswer = () => { const p = top(); return Boolean(p && (p.permission || p.state === 'question')); };
  // While music plays the island shows it at medium size. The little button on it tucks the music away
  // (the island stays small, the line under it still shows how far the song is); hover the island and press it again to bring it back.
  let musicTucked = false; try { localStorage.removeItem('twocode:music-tucked'); } catch {}
  function tuckMusic(on) {
    musicTucked = on; try { localStorage.setItem('twocode:music-tucked', on ? '1' : '0'); } catch {}
    window.__twocodeChime?.('pop'); oldSetMode(on ? 'rest' : 'compact', false); if (on) holdClosed = true;
  }
  const claudeWorking = () => { const p = top(); return Boolean(p && busy(p)); }; // a running task is a Live Activity: it stays in view, small
  // for the tucked-away island (tuck-ui.js): the colour of its thin line, and whether Claude or Codex needs you
  window.__twocodeIslandState = () => ({ needsYou: needsAnswer(), working: claudeWorking(), done: top()?.state === 'done', music: music() });
  const medium = () => (music() && !musicTucked) || Boolean(window.__twocodeFocus?.active()) || Boolean(window.__twocodeCompactMessage?.()) || needsAnswer() || claudeWorking();
  window.__twocodeStatus = () => top();
  let holdClosed = false;
  window.__twocodeHoldClosed = () => { holdClosed = true; };
  // While Claude waits for an answer the small island pops open and gets wider (room for the buttons).
  let wideFor = false;
  // A song with lyrics (lyrics-ui.js) makes the small island wider too: room for the line that is sung.
  const lyricsWide = () => Boolean(window.__twocodeLyrics?.has()) && music() && !musicTucked && !window.__twocodeFocus?.active() && !claudeWorking() && !needsAnswer();
  const compactWidth = () => needsAnswer() ? 440 : lyricsWide() ? window.__twocodeLyrics.width() : 300;
  function lyricSize() {
    const w = compactWidth();
    if (w !== UI.COMPACT_W) UI.COMPACT_W = w;
    if (mode === 'compact' && !transition && Math.abs(visual.width - w) > 1) oldSetMode('compact', false);
  }
  function askSize() {
    const want = needsAnswer();
    if (want === wideFor) return; wideFor = want;
    UI.COMPACT_W = compactWidth();
    if (want && mode !== 'expanded') oldSetMode('compact', false);
    else if (!want && mode === 'compact') { oldSetMode('compact', false); settleSize(); }
  }
  const oldTargetHeight = targetHeight, oldSetMode = setMode, oldDrawExpanded = drawExpanded, oldDrawSmall = drawSmall, oldHover = updateHover;
  targetHeight = function () { return ['monitor', 'assistant'].includes(currentView) ? (claudeTall ? 318 : 270) : oldTargetHeight(); };
  // While music plays, the island rests at medium size so the sound wave stays visible.
  let hoverOpening = false;
  setMode = function (next, playSound = true) {
    if (next === 'expanded' && hoverOpening && mode === 'compact' && lyricsWide() && currentView !== 'spotify') setView('spotify'); // a song with lyrics: its page, with the lines before and after
    return oldSetMode(next === 'rest' && medium() ? 'compact' : next, playSound);
  };
  function settleSize() {
    if (!introFinished || pointer.known && inside(pointer.x, pointer.y, islandBounds)) return;
    if (medium() && mode === 'rest') setMode('compact', false);
    else if (!medium() && mode === 'compact') oldSetMode('rest', false);
  }
  window.__twocodeSettleSize = settleSize;
  setInterval(async () => { await refreshSpotify(); settleSize(); }, 4000);
  // the Claude page's glow, only while something happens: Claude's own colour while he works, green when he is done
  // (quiet, waiting for you or stopped: plain black)
  const glowOf = p => { if (!p?.connected || p.kind !== 'hooks' || p.permission) return null;
    if (busy(p)) return { colour: p.agent === 'codex' ? '#3b82f6' : (p.agent === 'antigravity' ? '#4285f4' : '#d97757'), k: 1 };
    return window.__twocodeDoneLook(p); };
  drawExpanded = function (alpha) {
    if (currentView === 'shortcuts') { drawHeader(alpha); drawShortcuts(contentRect()); return; }
    if (!['monitor', 'assistant'].includes(currentView)) return oldDrawExpanded(alpha);
    const glow = glowOf(current()); if (glow) { window.__twocodeTintIsland = glow.colour; window.__twocodeTintStrength = glow.k; window.__twocodeTintAt = performance.now(); }
    drawHeader(alpha); // the Claude page uses the full width (no TwoCode, usage is shown in the page itself)
    // Claude Code / Codex: the page itself (DOM) draws its cards on the black glass
  };
  function drawLamp(p, x, y) {
    const colour = colourOf(p.state);
    ctx.save(); ctx.globalAlpha = busy(p) ? .6 + .4 * Math.cos(performance.now() / 205) : 1;
    ctx.beginPath(); ctx.arc(x, y, 3.8, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.shadowColor = colour; ctx.shadowBlur = 6; ctx.fill(); ctx.restore();
  }
  const short = (value, max) => { const s = String(value || ''); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
  function drawWave(x, y) {
    const t = performance.now() / 160;
    ctx.save(); ctx.fillStyle = window.__twocodeAlbumColour || '#1ed760';
    for (let i = 0; i < 4; i++) {
      const h = 4 + 8 * (0.5 + 0.5 * Math.sin(t + i * 1.7)) * (0.6 + 0.4 * Math.sin(t / 2.3 + i));
      ctx.beginPath(); ctx.roundRect(x + i * 4.5, y - h / 2, 3, h, 1.5); ctx.fill();
    }
    ctx.restore();
  }
  // Medium island: music (or status text) on the left, the ghost with traffic-light eyes far right.
  // Medium island, one clear layout: [left: cover or icon] [middle: wave or text] [right: TwoCode].
  // TwoCode's eyes always show Claude's state; a focus timer is the ring around him.
  // Priority for the middle: short message > Claude needs you > music > focus timer > Claude working.
  let attentionState = '', attentionUntil = 0;
  // The sound wave shows only REAL sound from this PC. Silent (or the sound can't be read) → flat little dots,
  // never a fake wave. Each bar eases to its level, so it rises and settles smoothly.
  const barLevels = {};
  function bars(x0, x1, y, count, maxH = 18) {
    const levels = window.__twocodeAudioLevels?.(), w = (x1 - x0) / count, key = count + ':' + Math.round(maxH);
    const shown = barLevels[key] ||= new Array(count).fill(0);
    const loud = levels ? Math.max(...levels) : 0;
    ctx.save(); const colour = window.__twocodeAlbumColour || '#1ed760';
    for (let i = 0; i < count; i++) {
      const want = levels && loud > 0.04 ? levels[Math.floor(i * levels.length / count)] : 0;
      shown[i] += (want - shown[i]) * (want > shown[i] ? 0.55 : 0.18);
      const h = Math.max(2, Math.min(maxH, 2 + shown[i] * (maxH - 2)));
      ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, shown[i] * 4); ctx.fillStyle = colour;
      ctx.beginPath(); ctx.roundRect(x0 + i * w + w * 0.2, y - h / 2, w * 0.6, h, 1.5); ctx.fill();
    }
    ctx.restore();
  }
  window.__twocodeBars = bars; // also used by the big Spotify player
  // Medium island (36 px high): [album cover] [real sound wave] [TwoCode], like the iPhone's Dynamic Island.
  // While Spotify plays (here or on your phone): a thin line along the bottom of the small island shows how far the song is.
  function songLine() {} // no progress line under the island anymore: the Dynamic Island keeps its edge clean
  // the music button on the medium island: caught on pointerdown (window, capture), before the island reacts to the press
  let swallowTuckClick = false, tuckBox = null; // where the button is (kept between frames)
  window.addEventListener('pointerdown', e => {
    if (mode !== 'compact' || !music() || !inside(e.clientX, e.clientY, tuckBox)) return;
    e.preventDefault(); e.stopImmediatePropagation(); swallowTuckClick = true; tuckMusic(!musicTucked);
  }, true);
  for (const type of ['pointerup', 'mousedown', 'mouseup', 'click']) window.addEventListener(type, e => { if (!swallowTuckClick) return; e.preventDefault(); e.stopImmediatePropagation(); if (type === 'click') swallowTuckClick = false; }, true);
  function smallStatus(p) {
    if (!EN()) return p.detail || labels[p.state];
    const step = (p.steps || []).filter(x => x.state === 'running').pop();
    if (busy(p)) return step ? `${NOW[step.kind] || 'Working'} ${shortWhat(step.kind, step.what)}` : 'Working';
    return { done: 'Done ✓', question: 'Waiting for you', error: 'Error', stopped: 'Stopped' }[p.state] || 'Idle';
  }
  // The volume in the small island: the speaker, a bar that glides to the new level, and the percentage.
  let volumeShown = null;
  function drawVolume(icon, level, left, cy, right) {
    const k = Math.max(0, Math.min(1, level / 100));
    volumeShown = volumeShown == null ? k : volumeShown + (k - volumeShown) * 0.35;
    window.__twocodeIcon?.('speaker', left + 10, cy, 18, '#ffffff', level / 100, '#ffffff');
    const x = left + 34, w = Math.max(60, right - x - 2), h = 8, y = cy - h / 2;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
    if (volumeShown > 0.005) { ctx.beginPath(); ctx.roundRect(x, y, Math.max(h, w * volumeShown), h, h / 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
    ctx.restore();
  }
  drawSmall = function () {
    hit.musicTuck = null; tuckBox = null;
    window.__twocodeLyrics?.tick();
    // opening or closing (the island is still narrow): only Robo's eyes, like the resting island. The old drawing for this
    // moment was a small robot head, which flashed at the top every time the island opened.
    if (mode === 'expanded') { (window.__twocodeIslandEyes || drawGhost)(islandBounds.x + islandBounds.width / 2, 16.5); return; }
    if (mode === 'rest' && window.__twocodeRestFace?.on()) { window.__twocodeRestFace.draw(); return; } // the time, CPU or memory instead of the eyes (rest-ui.js)
    if (mode !== 'compact') { oldDrawSmall(); songLine(); return; }
    songLine(); lyricSize();
    // Like the iPhone's Dynamic Island: Robo's eyes in the middle (the camera), the leading and trailing parts snug
    // against them, in one colour for one activity (Apple: design leading + trailing as one unit).
    const H = islandBounds.height, cy = H / 2, right = islandBounds.x + islandBounds.width - 14, left = islandBounds.x + 14, mid = islandBounds.x + islandBounds.width / 2;
    const p = top(), focus = window.__twocodeFocus, now = performance.now();
    const message = window.__twocodeCompactMessage?.(), needsYou = p && (p.state === 'question' || p.permission);
    if (p && p.state !== attentionState) { attentionState = p.state; attentionUntil = ['question', 'done', 'error'].includes(p.state) ? now + 4000 : 0; } // answered: back to work, not "Error"
    if (!p) attentionState = '';
    const focusOn = Boolean(focus?.active()), musicOn = Boolean(music()), claudeOn = Boolean(p && (needsYou || now < attentionUntil || busy(p)));
    const primary = claudeOn ? 'claude' : focusOn ? 'focus' : musicOn ? 'music' : null;
    window.__twocodeBubbles = message ? [] : [focusOn && primary !== 'focus' ? 'focus' : null, musicOn && primary !== 'music' ? 'music' : null].filter(Boolean);
    const eyes = () => { (window.__twocodeIslandEyes || drawGhost)(mid, cy + 0.5); hit.ghost = { x: mid - 22, y: 0, width: 44, height: H }; };
    hit.ghost = null;
    const mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const lead = (s, colour, x = left, maxW = mid - 26 - left) => text(s, x, cy + 5, 14, colour, 600, 'left', maxW);
    const trail = (s, colour) => text(s, right, cy + 5, 14, colour, 600, 'right', right - mid - 26);
    const mark = (c) => {
      const isAnti = p?.agent === 'antigravity' || p?.provider === 'antigravity';
      if (isAnti) {
        geminiMark(left + 7, cy, c || '#4285f4', 15);
      } else {
        ctx.save(); ctx.strokeStyle = c || '#d97757'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) {
          const an = i * Math.PI / 4;
          ctx.beginPath();
          ctx.moveTo(left + 7 - Math.cos(an) * 6.5, cy - Math.sin(an) * 6.5);
          ctx.lineTo(left + 7 + Math.cos(an) * 6.5, cy + Math.sin(an) * 6.5);
          ctx.stroke();
        }
        ctx.restore();
      }
    };
    const colourFor = () => '#ffffff'; // calm: the words are white, Robo's eyes carry the state's colour

    if (message && !message.trim()) { // hello and goodbye (twocode-fun.js keep the island open with a space): Robo is the show, big in the middle
      (window.__twocodeIslandEyes || drawGhost)(mid, cy + 0.5, 1.35); hit.ghost = { x: mid - 26, y: 0, width: 52, height: H };
      return;
    }
    if (message) {
      const volume = /^(\S+) [▮▯]{10} (\d+)%$/u.exec(message); // the volume (extras-ui.js): a real bar instead of block characters
      if (volume) { drawVolume(volume[1], Number(volume[2]), left, cy, right); return; }
      text(message, left + 2, cy + 5, 14, '#ffffff', 600, 'left', right - left); return;
    }
    if (p && (needsYou || now < attentionUntil)) {
      const colour = colourFor(p.permission ? 'question' : p.state);
      mark(colour);
      // Claude asks permission: answer right here, two same-size buttons, the likely one in white
      if (p.permission && !p.ask && !p.plan && p.permission.kind === 'tool') {
        const bw = 78, bh = 28, by = cy - bh / 2, yesX = right - bw, noX = yesX - bw - 8;
        lead(`${p.permission.what ? p.permission.what.split(/[\\/]/).pop() : p.permission.tool}`, '#ffffff', left + 22, noX - 12 - (left + 22));
        const btn = (x, label, key, primary) => { const over = inside(pointer.x, pointer.y, { x, y: by, width: bw, height: bh });
          ctx.save(); ctx.beginPath(); ctx.roundRect(x, by, bw, bh, 8); ctx.fillStyle = primary ? (over ? '#e5e5ea' : '#ffffff') : (over ? '#3a3a3c' : '#2c2c2e'); ctx.fill(); ctx.restore();
          text(label, x + bw / 2, by + 19, 13, primary ? '#000000' : '#ffffff', 600, 'center'); hit[key] = { x, y: by, width: bw, height: bh }; };
        btn(noX, T('Weiger', 'Deny'), 'cDeny', false); btn(yesX, T('Sta toe', 'Allow'), 'cAllow', true);
        return;
      }
      if (p.ask || p.plan) {
        lead(p.ask ? T('Claude vraagt iets', 'Claude asks') : T('Plan klaar', 'Plan ready'), colour, left + 22, right - 90 - left);
        const w = 70, bh = 28, x = right - w, over = inside(pointer.x, pointer.y, { x, y: cy - bh / 2, width: w, height: bh });
        ctx.save(); ctx.beginPath(); ctx.roundRect(x, cy - bh / 2, w, bh, 8); ctx.fillStyle = over ? '#e5e5ea' : '#ffffff'; ctx.fill(); ctx.restore();
        text(T('Bekijk', 'View'), x + w / 2, cy + 5, 13, '#000000', 600, 'center'); hit.cOpen = { x, y: cy - bh / 2, width: w, height: bh };
        return;
      }
      eyes();
      lead(p.state === 'question' ? T('Vraag', 'Question') : p.state === 'done' ? T('Klaar', 'Done') : T('Fout', 'Error'), colour, left + 22);
      if (p.elapsed && p.state === 'done') trail(mmss(p.elapsed), colour);
      return;
    }
    if (primary === 'claude' && p) {
      const steps = p.steps || [], phase = steps.reduce((m, x) => Math.max(m, x.kind === 'edit' ? 1 : x.kind === 'run' ? 2 : 0), 0);
      mark(); eyes();
      const isBg = Boolean(p.background || (p.detail && p.detail.includes('achtergrond')));
      const statusLabel = busy(p) ? (isBg ? T('Taak bezig', 'Task active') : (steps.length ? [T('Lezen', 'Reading'), T('Aanpassen', 'Editing'), T('Testen', 'Testing')][phase] : T('Denkt na', 'Thinking'))) : smallStatus(p);
      lead(statusLabel, '#ffffff', left + 22);
      if (busy(p)) trail(mmss((p.elapsed || 0) + Math.floor((Date.now() - stateAt) / 1000)), '#8e8e93');
      return;
    }
    if (primary === 'focus') { // the timer: a ring that runs empty, the time on the right
      const r = 8, done = 1 - focus.left() / focus.length();
      ctx.save(); ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(left + 8, cy, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(191,90,242,.3)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(left + 8, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - done)); ctx.strokeStyle = '#bf5af2'; ctx.stroke(); ctx.restore();
      eyes();
      text(focus.label(), right, cy + 5, 15, '#bf5af2', 600, 'right');
      return;
    }
    if (primary === 'music') { // the cover left, the visualizer in its colour right
      const cs = H - 12;
      if (albumImage?.complete && albumImage.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.roundRect(left - 6, cy - cs / 2, cs, cs, 7); ctx.clip(); ctx.drawImage(albumImage, left - 6, cy - cs / 2, cs, cs); ctx.restore(); }
      else { box(left - 6, cy - cs / 2, cs, cs, 7, '#1c1c1e'); window.__twocodeIcon?.('music', left - 6 + cs / 2, cy, 14, '#8e8e93', null, 'rgba(0,0,0,0)'); }
      // the line that is sung now, between the cover and the wave. A new line rolls in from below while the old one rolls
      // out at the top, in a narrow band, so two lines never stand on top of each other; Robo's eyes fade in during the
      // breaks (and out when the singing starts again)
      const lyric = lyricsWide() ? window.__twocodeLyrics.now() : null;
      if (lyric && (lyric.text || lyric.previous)) {
        const x0 = left - 6 + cs + 12, x1 = right - 36 - 12, w = x1 - x0, band = 20, k = lyric.k;
        const line = (s, dy) => {
          const alpha = Math.max(0, 1 - Math.abs(dy) / band); // fades as it leaves the band
          if (!s || alpha <= 0.01) return;
          ctx.save(); ctx.globalAlpha *= alpha; ctx.font = lyric.font;
          let t = s; while (t.length > 1 && ctx.measureText(t).width > w) t = t.slice(0, -2) + '…';
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x0 + w / 2, cy + 0.5 + dy); ctx.restore();
        };
        if (!lyric.text || !lyric.previous) { // from the eyes to a line, or from a line to the eyes: one after the other
          const ek = lyric.text ? Math.max(0, 1 - k / 0.35) : Math.max(0, (k - 0.65) / 0.35); // the eyes only while no words are in the band
          if (ek > 0.01) { ctx.save(); ctx.globalAlpha *= ek; (window.__twocodeIslandEyes || drawGhost)(mid, cy + 0.5); ctx.restore(); }
        }
        ctx.save(); ctx.beginPath(); ctx.rect(x0 - 4, cy - band / 2 - 2, w + 8, band + 4); ctx.clip();
        line(lyric.previous, -band * k);
        line(lyric.text, band * (1 - k));
        ctx.restore();
      } else eyes();
      window.__twocodeVisualizer?.('compact', right - 36, cy, 36, 18, window.__twocodeAlbumColour || '#ffffff', 6);
      return;
    }
    if (p) { mark(); eyes(); lead(smallStatus(p), '#ffffff', left + 22); return; }
    eyes();
  };
  // The second activity in its own little island to the right (like the iPhone's split Dynamic Island): it grows out of
  // the edge, and a click opens that page. Music shows its cover, the timer a ring that runs empty.
  const bubbleK = { focus: 0, music: 0 };
  const baseIslandShape = drawIsland;
  drawIsland = function (...args) {
    const result = baseIslandShape.apply(this, args);
    const list = mode === 'compact' && visual.height < 60 && !transition ? (window.__twocodeBubbles || []) : [];
    let x = islandBounds.x + islandBounds.width + 8;
    hit.bubbleFocus = null; hit.bubbleMusic = null;
    for (const kind of ['focus', 'music']) {
      const on = list.includes(kind);
      bubbleK[kind] += ((on ? 1 : 0) - bubbleK[kind]) * (on ? 0.18 : 0.3);
      if (bubbleK[kind] < 0.02) continue;
      const d = UI.BAR_H + 4, e = 1 - Math.pow(1 - bubbleK[kind], 3), w = d * e, h = d * e;
      ctx.save(); islandPath(x, 0, w, h, h / 2); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
      if (e > 0.6) {
        const cx = x + w / 2, cy = h / 2;
        ctx.save(); ctx.globalAlpha *= (e - 0.6) / 0.4;
        if (kind === 'music') {
          if (albumImage?.complete && albumImage.naturalWidth) { ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, d / 2 - 6, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(albumImage, cx - d / 2 + 6, cy - d / 2 + 6, d - 12, d - 12); ctx.restore(); }
          else window.__twocodeIcon?.('music', cx, cy, 15, '#ffffff', null, 'rgba(0,0,0,0)');
        } else {
          const f = window.__twocodeFocus, left = f?.active() ? f.left() / f.length() : 0;
          ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.arc(cx, cy, d / 2 - 9, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(191,90,242,.3)'; ctx.stroke();
          ctx.beginPath(); ctx.arc(cx, cy, d / 2 - 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.strokeStyle = '#bf5af2'; ctx.stroke();
        }
        ctx.restore();
      }
      hit[kind === 'music' ? 'bubbleMusic' : 'bubbleFocus'] = { x, y: 0, width: d, height: d };
      x += w + 6;
    }
    return result;
  };
  canvas.addEventListener('click', e => {
    const kind = inside(e.clientX, e.clientY, hit.bubbleMusic) ? 'spotify' : inside(e.clientX, e.clientY, hit.bubbleFocus) ? 'focus' : null;
    if (!kind) return;
    e.preventDefault(); e.stopImmediatePropagation(); sound('click');
    setView(kind); setMode('expanded');
  }, true);
  updateHover = function (now) {
    if (['monitor', 'assistant'].includes(currentView)) {
      if (mode !== 'expanded') return;
      // Only stay open while you are really typing here (window focused), or while a reply is being sent.
      const typing = document.hasFocus() && root.contains(document.activeElement) && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName);
      if (typing || pending) { leaveStartedAt = null; return; }
      const over = pointer.known && inside(pointer.x, pointer.y, islandBounds);
      if (over) leaveStartedAt = null;
      else { leaveStartedAt ||= now; if (now - leaveStartedAt > (UI.MONITOR_LEAVE_DELAY || 900)) { small(); leaveStartedAt = null; } }
      return;
    }
    // Folded in with the collapse button: stay closed until the mouse has left the island once.
    if (holdClosed) { if (pointer.known && inside(pointer.x, pointer.y, islandBounds)) { hoverStartedAt = null; return; } holdClosed = false; }
    // Claude waits for an answer: the small island stays small under your mouse, so you can click Toestaan / Weigeren.
    // On the music button the island stays as it is, so you can press it (it would open on hover otherwise)
    if (mode === 'compact' && pointer.known && inside(pointer.x, pointer.y, tuckBox)) { hoverStartedAt = null; return; }
    const pa = top(); // (only when there are buttons to press; a plain question just opens on hover)
    if (mode === 'compact' && pa && (pa.permission || pa.ask || pa.plan) && pointer.known && inside(pointer.x, pointer.y, islandBounds)) { hoverStartedAt = null; return; }
    hoverOpening = true; try { return oldHover(now); } finally { hoverOpening = false; } // see setMode: a song with lyrics opens its page
  };
  // ---- Home: a small dashboard. TwoCode on the left, three live widgets: music, Claude, focus ----
  const baseHomeHeight = targetHeight;
  targetHeight = function () { return currentView === 'home' ? (window.__twocodeGalleryOpen?.() ? 300 : homeEdit ? 200 : 236) : currentView === 'shortcuts' ? 248 : baseHomeHeight(); };
  // A widget card: soft gradient, thin rim, lifts a little on hover. Returns whether the pointer is on it.
  function card(x, y, w, h, key, glow) {
    const bounds = { x, y, width: w, height: h }, over = inside(pointer.x, pointer.y, bounds);
    ctx.save();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, over ? '#1c211b' : '#151915'); g.addColorStop(1, over ? '#141814' : '#0e110e');
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
    if (glow) { ctx.clip(); const r = ctx.createRadialGradient(x + 20, y, 0, x + 20, y, w * 0.9); r.addColorStop(0, glow); r.addColorStop(1, 'rgba(0,0,0,0)'); ctx.globalAlpha = over ? 0.22 : 0.14; ctx.fillStyle = r; ctx.fillRect(x, y, w, h); }
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 15.5); ctx.strokeStyle = over ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.07)'; ctx.stroke(); ctx.restore();
    hit[key] = bounds; return over;
  }
  function miniButton(x, y, r, kind, key) {
    const bounds = { x: x - r, y: y - r, width: r * 2, height: r * 2 }, over = inside(pointer.x, pointer.y, bounds);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = over ? '#ffffff' : '#e8eee4'; ctx.fill();
    ctx.fillStyle = '#050605'; ctx.beginPath();
    if (kind === 'pause') { ctx.roundRect(x - 4, y - 4.5, 3, 9, 1); ctx.roundRect(x + 1, y - 4.5, 3, 9, 1); }
    else { ctx.moveTo(x - 2.5, y - 5); ctx.lineTo(x + 4.5, y); ctx.lineTo(x - 2.5, y + 5); ctx.closePath(); }
    ctx.fill(); ctx.restore();
    hit[key] = bounds;
  }
  const bar = (x, y, w, part, colour) => { box(x, y, w, 4, 2, 'rgba(255,255,255,.1)'); if (part > 0) box(x, y, Math.max(4, w * Math.min(1, part)), 4, 2, colour); };
  // Home (Coucou feel): two dark cards. Left: Claude, with white Robo, the status and a mini terminal that shows
  // the real work (the code Claude changes in red/green, or what the terminal said). Right: app buttons with
  // little Robo faces as icons.
  function cardBox(x, y, w, h, key) {
    const bounds = { x, y, width: w, height: h }, over = key && inside(pointer.x, pointer.y, bounds);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fillStyle = over ? '#191b1d' : '#141517'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    if (key) hit[key] = bounds; return over;
  }
  // App icon: TwoCode's own line icon on a soft coloured tile.
  // App icons are little Robo stickers: Robo himself does something with each app (headphones for Spotify,
  // a laptop for Claude Code, a stopwatch for Focus, peeking out of a box for the Tray …) on a bright tile.
  // Live bits: music notes dance while a song plays, his eyes turn orange while Claude works, the gear turns,
  // the alarm clock shows the real time.
  const ICON_BG = { music: ['#5be38c', '#1fae55'], terminal: ['#ffb38a', '#e8744a'], timer: ['#ffd27a', '#ff9a3d'], tray: ['#8fb8ff', '#4c7ff0'], copy: ['#7fe6d8', '#22b3a3'],
    note: ['#ffe58a', '#f5b92e'], gear: ['#c9b3ff', '#8b6cf0'], clock: ['#9fc2ff', '#6c7ff0'], home: ['#d8f5a8', '#9fd45a'], pen: ['#ffb3d6', '#f0609e'] };
  // Hover: Robo climbs a bit out of his tile, grows and looks ready (happy eyes, glowing light).
  // Click: he squashes and bounces back with a few sparkles.
  const iconAnim = new Map();
  canvas.addEventListener('pointerdown', e => {
    const t = performance.now();
    for (const a of iconAnim.values()) if (a.rect && t - a.seen < 120 && inside(e.clientX, e.clientY, a.rect)) { a.pressAt = t; window.__twocodeIconPressAt = t; }
  }, true);
  function appIcon(x, y, size, icon, colour, hot) {
    const c = ctx, now = performance.now(), u = size / 48, bg = ICON_BG[icon] || ICON_BG.home;
    const key = icon + ':' + Math.round(x / 4) + ':' + Math.round(y / 4);
    let st = iconAnim.get(key); if (!st) { st = { h: 0, pressAt: -1e9, seen: 0 }; iconAnim.set(key, st); }
    const hotRect = hot && typeof hot === 'object' ? hot : { x, y, width: size, height: size };
    const over = Boolean(hot) && !homeEdit && pointer.known && inside(pointer.x, pointer.y, hotRect);
    st.h += ((over ? 1 : 0) - st.h) * 0.2; st.rect = hot ? hotRect : null; st.seen = now;
    const h = st.h, since = now - st.pressAt, press = since < 700 ? Math.exp(-since / 170) * Math.sin(since / 38) : 0, tilePress = since < 220 ? Math.sin(Math.min(1, since / 220) * Math.PI) : 0;
    const p = icon === 'terminal' ? top() : null, working = p && busy(p), playing = icon === 'music' && music() && Boolean(window.__twocodeHearing); // notes only bob when sound really plays here
    c.save(); c.translate(x, y); c.scale(u, u);
    if (tilePress) { c.translate(24, 24); c.scale(1 - 0.12 * tilePress, 1 - 0.12 * tilePress); c.translate(-24, -24); }
    // tile
    c.save(); c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
    const g = c.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
    c.beginPath(); c.roundRect(0, 0, 48, 48, 13); c.fillStyle = g; c.fill(); c.restore();
    c.save(); c.beginPath(); c.roundRect(0, 0, 48, 48, 13); c.clip(); c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.ellipse(16, 4, 26, 14, -0.2, 0, Math.PI * 2); c.fill(); c.restore();
    const ink = '#1d1b26', hx = 24, hy = icon === 'terminal' ? 23 : icon === 'tray' ? 27 : 26;
    const eyesCol = icon === 'terminal' && working ? '#ff9a3d' : '#5fd0ff';
    // Robo's head
    const head = () => {
      if (!['music', 'gear', 'home'].includes(icon)) { c.strokeStyle = '#e8efec'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(hx, hy - 10); c.lineTo(hx, hy - 15); c.stroke(); c.beginPath(); c.arc(hx, hy - 16.5, 2.2 + 0.6 * h, 0, Math.PI * 2); c.fillStyle = working ? '#ff9a3d' : '#c6e994'; c.shadowColor = c.fillStyle; c.shadowBlur = 8 * h; c.fill(); c.shadowBlur = 0; }
      c.fillStyle = '#dfe9e5'; c.beginPath(); c.roundRect(hx - 15.5, hy - 2, 3, 6, 1.5); c.roundRect(hx + 12.5, hy - 2, 3, 6, 1.5); c.fill();
      const hg = c.createLinearGradient(0, hy - 12, 0, hy + 12); hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#dbe7e2');
      c.beginPath(); c.ellipse(hx, hy, 14, 11.5, 0, 0, Math.PI * 2); c.fillStyle = hg; c.fill(); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 0.8; c.stroke();
      c.beginPath(); c.roundRect(hx - 10, hy - 5.5, 20, 12, 5.5); c.fillStyle = ink; c.fill();
      c.fillStyle = eyesCol; c.strokeStyle = eyesCol; c.lineWidth = 1.6; c.lineCap = 'round';
      const blink = Math.floor(now / 3200 + size) % 7 === 0 && (now % 3200) < 140;
      for (const s of [-1, 1]) {
        const ex = hx + s * 4.3, ey = hy + 0.5;
        if (icon === 'music' || st.ready) { c.beginPath(); c.arc(ex, ey + 1.6, 2.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        else if (icon === 'timer' || icon === 'terminal') { c.beginPath(); c.ellipse(ex, ey, 2, 1.3, 0, 0, Math.PI * 2); c.fill(); }
        else if (blink) { c.beginPath(); c.moveTo(ex - 2, ey); c.lineTo(ex + 2, ey); c.stroke(); }
        else { c.beginPath(); c.ellipse(ex, ey, 1.7, 2.7, 0, 0, Math.PI * 2); c.fill(); }
      }
    };
    if (h > 0.02) { c.save(); c.fillStyle = 'rgba(0,0,0,' + (0.22 * h) + ')'; c.beginPath(); c.ellipse(24, 43, 13 + 3 * h, 2.5, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.save(); // everything below is "Robo": it climbs out of the frame on hover and squashes on click
    const lift = 9 * h + Math.sin(now / 260) * 0.8 * h, grow = 1 + 0.2 * h;
    c.translate(24, 44); c.scale(grow * (1 + 0.26 * press), grow * (1 - 0.26 * press)); c.translate(-24, -44 - lift / grow);
    if (h > 0.55 && !['music', 'timer', 'terminal'].includes(icon)) st.ready = true; else st.ready = false;
    head();
    if (icon === 'tray') { // peeking out of a box
      c.fillStyle = '#2f5fc4'; c.beginPath(); c.roundRect(7, 30, 34, 14, 3); c.fill(); c.fillStyle = '#3d70dc'; c.beginPath(); c.roundRect(5, 28, 38, 5, 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.roundRect(19, 36, 10, 2.5, 1.2); c.fill();
    }
    if (icon === 'music') { // headphones + dancing notes
      c.strokeStyle = ink; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(hx, hy + 2, 15.5, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
      c.fillStyle = '#1aa34c'; c.strokeStyle = ink; c.lineWidth = 1.2; for (const s of [-1, 1]) { c.beginPath(); c.roundRect(hx + s * 15.5 - 3, hy - 3, 6, 10, 3); c.fill(); c.stroke(); }
      const bob = playing ? Math.sin(now / 180) * 2 : 0, bob2 = playing ? Math.sin(now / 180 + 2) * 2 : 0;
      c.fillStyle = '#ffffff'; c.strokeStyle = '#ffffff'; c.lineWidth = 1.4;
      c.beginPath(); c.ellipse(39, 12 + bob, 2.2, 1.7, -0.4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(41, 11.5 + bob); c.lineTo(41, 5 + bob); c.lineTo(44, 6 + bob); c.stroke();
      c.globalAlpha = 0.85; c.beginPath(); c.ellipse(8, 9 + bob2, 1.8, 1.4, -0.4, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(9.6, 8.6 + bob2); c.lineTo(9.6, 3.5 + bob2); c.stroke(); c.globalAlpha = 1;
    }
    if (icon === 'terminal') { // a little laptop in front of him
      c.fillStyle = '#2b2a35'; c.beginPath(); c.roundRect(12, 30, 24, 13, 2); c.fill();
      c.fillStyle = '#ff9a3d'; c.font = 'bold 8px Consolas, monospace'; c.textBaseline = 'middle'; c.fillText('>_', 16, 36.5);
      c.fillStyle = '#c9c7d6'; c.beginPath(); c.moveTo(8, 43); c.lineTo(40, 43); c.lineTo(38, 46); c.lineTo(10, 46); c.closePath(); c.fill();
    }
    if (icon === 'timer') { // stopwatch
      const sx = 35.5, sy = 36; c.fillStyle = '#ffffff'; c.strokeStyle = '#e8743a'; c.lineWidth = 2; c.beginPath(); c.arc(sx, sy, 7.5, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#e8743a'; c.beginPath(); c.roundRect(sx - 1.5, sy - 11.5, 3, 3, 1); c.fill();
      const f = window.__twocodeFocus, part = f?.active() ? 1 - f.left() / (f.length() || 1) : (now / 6000) % 1;
      c.strokeStyle = ink; c.lineWidth = 1.4; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.sin(part * Math.PI * 2) * 5, sy - Math.cos(part * Math.PI * 2) * 5); c.stroke();
    }
    if (icon === 'copy') { // holding a clipboard
      c.fillStyle = '#8a5a2b'; c.beginPath(); c.roundRect(14, 30, 20, 16, 2.5); c.fill(); c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(16, 32.5, 16, 12, 1.5); c.fill();
      c.fillStyle = '#9aa3a8'; c.beginPath(); c.roundRect(20, 28.5, 8, 4, 1.5); c.fill(); c.fillStyle = '#22b3a3'; for (let i = 0; i < 3; i++) c.fillRect(18, 35 + i * 3, 12 - i * 3, 1.2);
    }
    if (icon === 'note') { // a sheet of paper and a pencil
      c.save(); c.translate(24, 38); c.rotate(-0.08); c.fillStyle = '#fffdf2'; c.beginPath(); c.roundRect(-10, -7, 20, 13, 1.5); c.fill(); c.fillStyle = '#e6c25a'; for (let i = 0; i < 3; i++) c.fillRect(-7, -4 + i * 3, 13 - (i === 2 ? 5 : 0), 1); c.restore();
      c.save(); c.translate(36, 33); c.rotate(0.7); c.fillStyle = '#ff6b6b'; c.fillRect(-1.6, -9, 3.2, 3); c.fillStyle = '#ffcc33'; c.fillRect(-1.6, -6, 3.2, 10); c.fillStyle = '#f2d7b0'; c.beginPath(); c.moveTo(-1.6, 4); c.lineTo(1.6, 4); c.lineTo(0, 7.5); c.closePath(); c.fill(); c.restore();
    }
    if (icon === 'gear') { // a gear turning on his head
      c.save(); c.translate(hx, hy - 16); c.rotate(now / 1400); c.fillStyle = '#ffffff'; c.beginPath();
      for (let i = 0; i < 16; i++) { const ang = i / 16 * Math.PI * 2, r = i % 2 ? 5 : 7; c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); } c.closePath(); c.fill();
      c.fillStyle = '#8b6cf0'; c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill(); c.restore();
    }
    if (icon === 'clock') { // alarm clock with the real time
      const cx2 = 35.5, cy2 = 36, d = new Date(); c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(cx2 - 5, cy2 - 7, 2.5, 0, Math.PI * 2); c.arc(cx2 + 5, cy2 - 7, 2.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffffff'; c.strokeStyle = '#ff6b6b'; c.lineWidth = 2; c.beginPath(); c.arc(cx2, cy2, 7.5, 0, Math.PI * 2); c.fill(); c.stroke();
      const hand = (ang, len, w) => { c.lineWidth = w; c.beginPath(); c.moveTo(cx2, cy2); c.lineTo(cx2 + Math.sin(ang) * len, cy2 - Math.cos(ang) * len); c.stroke(); };
      c.strokeStyle = ink; c.lineCap = 'round'; hand(((d.getHours() % 12) + d.getMinutes() / 60) / 12 * Math.PI * 2, 3.5, 1.6); hand(d.getMinutes() / 60 * Math.PI * 2, 5.2, 1.1);
    }
    if (icon === 'home') { // a little roof as a hat
      c.fillStyle = '#e4572e'; c.beginPath(); c.moveTo(hx - 13, hy - 9); c.lineTo(hx, hy - 20); c.lineTo(hx + 13, hy - 9); c.closePath(); c.fill(); c.fillStyle = '#b8401f'; c.fillRect(hx + 5, hy - 19, 3, 6);
    }
    c.restore(); // end of Robo
    if (since < 380) { // sparkles
      const k = since / 380; c.fillStyle = '#ffffff';
      for (let i = 0; i < 7; i++) { const ang = i / 7 * Math.PI * 2 + 0.3, rr = 18 + 16 * k; c.globalAlpha = 1 - k; c.beginPath(); c.arc(24 + Math.cos(ang) * rr, 26 + Math.sin(ang) * rr, 2.2 * (1 - k) + 0.6, 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
    }
    c.restore();
  }
  window.__twocodeAppIcon = appIcon;
  function mono(str, x, y, size, colour, maxW) {
    ctx.save(); ctx.font = `${size}px "Cascadia Code", Consolas, monospace`; ctx.fillStyle = colour; ctx.textBaseline = 'alphabetic';
    let s = String(window.__twocodeTr?.(String(str || '')) ?? str ?? ''); if (maxW) while (s.length > 1 && ctx.measureText(s).width > maxW) s = s.slice(0, -2) + '…';
    ctx.fillText(s, x, y); ctx.restore();
  }
  // ---- Home = widgets. Every app is a widget: Klein (1 vakje), Breed (2×1) or Groot (2×2), on a 4 × 2 grid.
  // So 8 small ones, 2 big ones, or anything in between. Press + to edit (iPhone style): everything wiggles,
  // − removes, the arrow badge changes the size, hold and drag to move, empty spots get a + to add a widget.
  const SIZES = { S: [1, 1], W: [2, 1], L: [2, 2] }, SIZE_NAME = { S: 'Klein', W: 'Breed', L: 'Groot' }, COLS = 4, ROWS = 2;
  const PRESETS = [
    { name: 'Standaard', list: [['claude', 'L'], ['spotify', 'S'], ['focus', 'S'], ['tray', 'S'], ['settings', 'S']] },
    { name: '8 klein', list: ['claude', 'spotify', 'focus', 'clock', 'tray', 'clips', 'note', 'settings'].map(id => [id, 'S']) },
    { name: '2 groot', list: [['claude', 'L'], ['spotify', 'L']] },
    { name: '4 breed', list: [['claude', 'W'], ['spotify', 'W'], ['focus', 'W'], ['note', 'W']] },
    { name: 'Muziek', list: [['spotify', 'L'], ['claude', 'W'], ['clock', 'S'], ['focus', 'S']] }
  ];
  let homeEdit = false, gallery = null, drag = null, swallowClick = false, longPress = null, homeGeo = null, widgets = null, cell = { w: 171, h: 64, gap: 8 };
  const anim = {};
  // Lay widgets out: everyone keeps their spot if it is free, the rest fill the first free spot (like iPhone).
  function arrange(list, fixedId) {
    const used = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const free = (c, r, w, h) => { if (c == null || r == null || c < 0 || r < 0 || c + w > COLS || r + h > ROWS) return false; for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (used[y][x]) return false; return true; };
    const take = (c, r, w, h) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) used[y][x] = true; };
    const out = list.map(w => ({ id: w.id, size: w.size, c: w.c, r: w.r, cw: SIZES[w.size][0], ch: SIZES[w.size][1] }));
    const order = [...out.filter(w => w.id === fixedId), ...out.filter(w => w.id !== fixedId)];
    for (const w of order) if (free(w.c, w.r, w.cw, w.ch)) { take(w.c, w.r, w.cw, w.ch); w.ok = true; }
    for (const w of order) {
      if (w.ok) continue;
      let spot = null;
      for (let r = 0; r <= ROWS - w.ch && !spot; r++) for (let c = 0; c <= COLS - w.cw && !spot; c++) if (free(c, r, w.cw, w.ch)) spot = { c, r };
      if (spot) { w.c = spot.c; w.r = spot.r; take(spot.c, spot.r, w.cw, w.ch); w.ok = true; } else w.hidden = true;
    }
    return { placed: out, used, ok: out.every(w => !w.hidden) };
  }
  function loadWidgets() {
    try { const v = JSON.parse(localStorage.getItem('twocode:widgets')); if (Array.isArray(v)) return arrange(v.filter(w => APPS[w.id] && SIZES[w.size])).placed.filter(w => !w.hidden); } catch {}
    // first time: start from the old home (Claude big + your shortcuts, on the side you chose)
    const old = shortcuts().filter(id => id !== 'claude').map(id => ({ id, size: 'S' }));
    let swap = false; try { swap = localStorage.getItem('twocode:homeSwap') === '1'; } catch {}
    const claude = { id: 'claude', size: 'L' };
    return arrange(swap ? [...old.slice(0, 2), claude, ...old.slice(2)] : [claude, ...old]).placed.filter(w => !w.hidden);
  }
  // apps you turned off (Settings → Apps) have no tile on Home (their place stays free until you move things)
  const getWidgets = () => (widgets || (widgets = loadWidgets())).filter(w => installed(w.id));
  function saveWidgets(placed) {
    widgets = placed.filter(w => !w.hidden).map(({ id, size, c, r }) => ({ id, size, c, r }));
    try { localStorage.setItem('twocode:widgets', JSON.stringify(widgets)); } catch {}
  }
  const presetLayout = p => arrange(p.list.filter(([id]) => APPS[id]).map(([id, size]) => ({ id, size })));

  window.__twocodeHomeEdit = on => { homeEdit = on ?? !homeEdit; setGallery(null); drag = null; sound('click'); };
  window.__twocodeHomeEditing = () => homeEdit;
  window.__twocodeWidgetsReload = () => { widgets = null; }; // after the saved layout changed outside the app
  window.__twocodeGallery = () => openGallery();
  window.__twocodeGalleryOpen = () => Boolean(gallery);
  setInterval(() => { if ((homeEdit || gallery) && (currentView !== 'home' || mode !== 'expanded')) { homeEdit = false; setGallery(null); drag = null; } }, 300);

  // live data for the note and clipboard widgets
  let noteText = '', clipList = [];
  function refreshWidgetData() {
    const on = getWidgets().map(w => w.id).concat(gallery ? [gallery.pick] : []);
    if (on.includes('note')) api?.noteGet?.().then(r => { if (r?.ok) noteText = r.text || ''; }).catch(() => {});
    if (on.includes('clips')) api?.clipsGet?.().then(r => { if (r?.ok) clipList = (r.clips || []).map(c => c.text || ''); }).catch(() => {});
  }
  setInterval(() => { if (currentView === 'home' && mode === 'expanded') refreshWidgetData(); }, 2500);
  api?.onClips?.(r => { clipList = (r?.clips || []).map(c => c.text || ''); });

  // ---- drawing helpers ----
  const wiggle = seed => homeEdit && !gallery ? Math.sin(performance.now() / 65 + seed * 1.9) * 0.012 : 0;
  function withWiggle(r, seed, fn) { ctx.save(); ctx.translate(r.x + r.width / 2, r.y + r.height / 2); ctx.rotate(wiggle(seed)); ctx.translate(-(r.x + r.width / 2), -(r.y + r.height / 2)); fn(); ctx.restore(); }
  function widgetBg(r, key) {
    const over = key && inside(pointer.x, pointer.y, r);
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, 16); ctx.fillStyle = over ? '#1b1d20' : '#141517'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    if (key) hit[key] = r;
  }
  function wbtn(x, y, rad, kind, key, primary, live) {
    const b = { x: x - rad, y: y - rad, width: rad * 2, height: rad * 2 }, over = live && inside(pointer.x, pointer.y, b);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = primary ? (over ? '#ffffff' : '#eef2ec') : over ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.07)'; ctx.fill(); ctx.restore();
    const ink = primary ? '#0b0c0d' : '#e8ece6';
    if (kind === 'stop') { ctx.save(); ctx.fillStyle = ink; ctx.beginPath(); ctx.roundRect(x - rad * 0.3, y - rad * 0.3, rad * 0.6, rad * 0.6, 2); ctx.fill(); ctx.restore(); }
    else window.__twocodeMediaIcon?.(kind, x, y, rad * 0.72, ink);
    if (live) hit[key] = b;
  }
  function wrapLines(str, maxW, size, max) {
    ctx.save(); ctx.font = `500 ${size}px Inter, "Segoe UI", sans-serif`;
    const out = [];
    for (const para of String(str || '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? line + ' ' + word : word;
        if (ctx.measureText(next).width > maxW && line) { out.push(line); line = word; } else line = next;
        if (out.length >= max) break;
      }
      if (out.length >= max) break;
      if (line) out.push(line);
    }
    ctx.restore(); return out.slice(0, max);
  }
  function smooth(id, t) { // widgets glide to their new spot while you edit
    if (!homeEdit) { anim[id] = { ...t }; return t; }
    const a = anim[id] || (anim[id] = { ...t }), k = 0.28;
    for (const p of ['x', 'y', 'width', 'height']) a[p] += (t[p] - a[p]) * k;
    return { ...a };
  }
  function badge(x, y, kind) { // − / + / resize bubble
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = kind === '+' ? '#c6e994' : '#3b3e42'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 6; ctx.fill(); ctx.restore();
    ctx.save(); ctx.strokeStyle = kind === '+' ? '#10180c' : '#fff'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
    if (kind === 'size') { ctx.moveTo(x - 3.5, y + 3.5); ctx.lineTo(x + 3.5, y - 3.5); ctx.moveTo(x + 0.5, y - 3.5); ctx.lineTo(x + 3.5, y - 3.5); ctx.lineTo(x + 3.5, y - 0.5); ctx.moveTo(x - 3.5, y + 0.5); ctx.lineTo(x - 3.5, y + 3.5); ctx.lineTo(x - 0.5, y + 3.5); }
    else { ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); if (kind === '+') { ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); } }
    ctx.stroke(); ctx.restore();
  }

  // ---- the widgets themselves ----
  function claudeInfo() {
    const p = top(), st = p ? (p.permission ? 'question' : p.state) : 'ready';
    const agentName = p?.name || 'AI', project = p?.source?.title && p.source.title !== 'Geen actieve sessie' ? p.source.title : agentName;
    const statusText = !p ? 'Wacht op je AI' : p.permission || st === 'question' ? 'Wacht op jou' : busy(p) ? (p.detail || 'Bezig') : st === 'done' ? 'Klaar' : st === 'error' ? (p.detail || 'Fout') : 'Rustig';
    const lastLine = p?.code && busy(p) ? '+ ' + (p.code.lines.find(l => l.t !== '-')?.text || p.code.file) : p?.run ? (p.run.out.slice(-1)[0] || '$ ' + p.run.command) : String(p?.lastMessage || '').split('\n').filter(Boolean)[0] || '';
    return { p, st, project, statusText, dot: p ? colourOf(st) : '#4a504c', lastLine };
  }
  function statusIcon(x, y, st, dot, p) {
    if (st === 'done') { ctx.save(); ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill(); ctx.strokeStyle = '#0d0e0f'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - 2.7, y); ctx.lineTo(x - 0.7, y + 2); ctx.lineTo(x + 2.8, y - 2.4); ctx.stroke(); ctx.restore(); }
    else if (p && busy(p)) { ctx.save(); ctx.translate(x, y); ctx.rotate(performance.now() / 160); ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 1.4); ctx.strokeStyle = dot; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore(); }
    else { ctx.save(); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.strokeStyle = dot; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore(); }
  }
  // Each AI has its own colour (the same as in TwoCode → Verbindingen).
  const AI_COLOUR = { antigravity: '#4285f4', claudecode: '#d97757', codex: '#3b82f6', claude: '#e8a87c', chatgpt: '#10a37f' };
  // All chats going on at once, across AIs: every Claude Code / Codex session, plus the ChatGPT and Claude chats.
  function activeChats() {
    const out = [];
    for (const q of providers().filter(shown)) {
      if (q.kind === 'hooks' && q.list?.length) q.list.forEach(s => out.push({ provider: q.provider, id: s.id, state: s.state, name: q.name, project: s.project }));
      else out.push({ provider: q.provider, id: q.provider, state: q.permission ? 'question' : q.state, name: q.name, project: q.source?.title || '' });
    }
    return out.sort((a, b) => PRIORITY.indexOf(a.state) - PRIORITY.indexOf(b.state));
  }
  // A small bot in an AI's colour with a status light on its cheek (it bobs while that AI works).
  function miniBot(x, y, w, colour, lamp, working, current) {
    const h = w * 0.8, bob = working ? Math.sin(performance.now() / 180 + x) * 1.5 : 0;
    ctx.save(); ctx.translate(0, bob);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h * 0.42); ctx.fillStyle = colour; ctx.fill();
    if (current) { ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.stroke(); }
    ctx.fillStyle = '#141414';
    for (const ex of [0.36, 0.64]) { ctx.beginPath(); ctx.roundRect(x + w * ex - 1.4, y + h * 0.34, 2.8, h * 0.32, 1.4); ctx.fill(); }
    ctx.beginPath(); ctx.arc(x + w - 1, y + h - 1, 3.2, 0, Math.PI * 2); ctx.fillStyle = lamp; ctx.shadowColor = lamp; ctx.shadowBlur = 5; ctx.fill();
    ctx.restore();
  }
  const CHAT_WORDS = { running: 'Bezig', sending: 'Bezig', question: 'Wacht op jou', done: 'Klaar', error: 'Fout', ready: 'Rustig' };
  // Nothing going on: which AIs Robo is watching (or where to connect one).
  function drawIdleAi(tx, y, tw, h, live) {
    const watching = providers().filter(q => q.connected || q.hooksInstalled), last = state.history?.[0];
    const hungry = window.__twocodeHomeTitle?.(); // "I'm hungry… finish a task 🍪" (twocode-fun.js) instead of "Idle"
    text(hungry || 'Rustig', tx, y + 30, hungry ? 13 : 14, hungry ? '#ffc27a' : '#f2f5ef', 700, 'left', tw);
    if (last) { // the last job, so a quiet card still tells you something (click it for the whole list)
      const word = { done: '✓ Klaar', question: '● Vraag', error: '✕ Fout' }[last.result] || '', colour = { done: '#7ef0a4', question: '#ffc27a', error: '#ff9a9a' }[last.result] || '#aab2ad';
      const at = new Date(last.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
      text(`${T('Laatst', 'Last')}: ${last.prompt}`, tx, y + 50, 11, '#c9d0cb', 600, 'left', tw - 70);
      text(word, tx + tw, y + 50, 10.5, colour, 700, 'right');
      text(`${at}${last.project ? ' · ' + last.project : ''}`, tx, y + 65, 10, '#7d847f', 500, 'left', tw);
    } else text(watching.length ? 'Robo meldt het als je AI klaar is of iets vraagt.' : 'Koppel je AI in TwoCode → Verbindingen.', tx, y + 50, 11, '#8a918c', 500, 'left', tw);
    watching.slice(0, 4).forEach((q, i) => {
      const bx = tx + i * 70, by = y + h - 44;
      miniBot(bx, by, 20, AI_COLOUR[q.provider] || '#aaa', q.connected ? colourOf(q.state === 'disconnected' ? 'ready' : q.state) : '#4a504c', false, false);
      text(q.name, bx + 26, by + 12, 10, '#aab2ad', 600, 'left', 44);
    });
  }
  // ChatGPT or Claude (the app or the website), like Coucou: the chat's name, one status line,
  // and a dark box with the start of the answer, so you see it's really following your chat.
  function drawChatApp(p, st, tx, y, tw, h) {
    const lamp = colourOf(st), name = p.name || 'AI', title = p.source?.title || name;
    ctx.save(); ctx.beginPath(); ctx.arc(tx + 4, y + 21, 3.6, 0, Math.PI * 2); ctx.fillStyle = lamp; ctx.shadowColor = lamp; ctx.shadowBlur = 6; ctx.fill(); ctx.restore();
    text(title, tx + 14, y + 25, 12.5, '#f2f5ef', 700, 'left', tw * 0.62);
    text(name, tx + tw, y + 25, 11, '#7d847f', 600, 'right', tw * 0.3);
    const line = st === 'question' ? name + ' vraagt iets' : st === 'done' ? 'Klaar · je antwoord staat klaar' : busy(p) ? name + ' schrijft…' : st === 'error' ? 'Er ging iets mis' : st === 'login' ? 'Log eerst in' : 'Volgt dit gesprek';
    statusIcon(tx + 7, y + 40, st, lamp, p);
    text(line, tx + 18, y + 44, 11.5, st === 'done' ? lamp : '#e8ece6', 700, 'left', tw - 60);
    if (busy(p) && p.elapsed) text(p.elapsed + ' s', tx + tw, y + 44, 10.5, '#7d847f', 600, 'right');
    const bx = tx, by = y + 54, bw = tw, bh = h - 66;
    if (bh < 20) return;
    ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fillStyle = '#0b0c0d'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.stroke(); ctx.clip();
    const said = String(st === 'question' && p.question ? p.question : p.preview || '').replace(/\s+/g, ' ').trim();
    const lines = said ? wrapLines(busy(p) ? said.slice(-400) : said.slice(0, 400), bw - 20, 10, Math.max(1, Math.floor((bh - 10) / 13))) : [];
    if (lines.length) lines.forEach((l, i) => text(l, bx + 10, by + 16 + i * 13, 10, '#aab2ad', 500, 'left', bw - 20));
    else text(busy(p) ? 'Het antwoord komt eraan…' : 'Stel je vraag in ' + name + '. Robo kijkt mee.', bx + 10, by + 16, 10, '#5d6460', 500, 'left', bw - 20);
    ctx.restore();
  }
  // Several chats at once (two Claude Code sessions, Codex and ChatGPT…): a short summary and one row each.
  function drawChatList(chats, tx, y, tw, h, live) {
    const count = s => chats.filter(c => (s === 'busy' ? busy(c) : c.state === s)).length;
    const parts = [[count('busy'), 'bezig'], [count('question'), 'wachten op jou'], [count('done'), 'klaar']].filter(([n]) => n).map(([n, w]) => `${n} ${w}`);
    text(`${chats.length} chats`, tx, y + 29, 14, '#f2f5ef', 700, 'left', tw * 0.4);
    text(parts.join(' · '), tx + tw, y + 29, 11, '#8a918c', 600, 'right', tw * 0.6);
    const top = y + 42, rowH = Math.max(22, Math.min(28, (h - 54) / Math.min(chats.length, 4))), rows = Math.max(1, Math.floor((h - 50) / rowH));
    chats.slice(0, rows).forEach((c, i) => {
      const ry = top + i * rowH, over = live && inside(pointer.x, pointer.y, { x: tx - 6, y: ry, width: tw + 6, height: rowH });
      if (over) { ctx.save(); ctx.beginPath(); ctx.roundRect(tx - 6, ry, tw + 6, rowH - 2, 8); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill(); ctx.restore(); }
      miniBot(tx, ry + rowH / 2 - 8, 20, AI_COLOUR[c.provider] || '#aaa', colourOf(c.state), busy(c), false);
      text(c.project && c.project !== c.name ? c.project : c.name, tx + 30, ry + rowH / 2 + 4, 11.5, '#e8ece6', 650, 'left', tw * 0.45);
      if (c.project && c.project !== c.name) text(c.name, tx + 30 + Math.min(tw * 0.45, c.project.length * 6.6) + 6, ry + rowH / 2 + 4, 10, '#7d847f', 600, 'left', tw * 0.2);
      text(CHAT_WORDS[c.state] || '', tx + tw, ry + rowH / 2 + 4, 10.5, colourOf(c.state), 700, 'right');
      if (live) hit['aichip_' + i] = { x: tx - 6, y: ry, width: tw + 6, height: rowH, provider: c.provider };
    });
    if (chats.length > rows) text(`+ nog ${chats.length - rows}`, tx + tw, y + h - 8, 10, '#6b726e', 600, 'right');
  }
  function drawClaudeCard(lx, y, leftW, h, live) {
    const { p, st, project, statusText, dot } = claudeInfo(), agentName = p?.name || 'AI';
    cardBox(lx, y, leftW, h, live ? 'monitor_claudecode' : null);
    const robo = Math.min(70, h * 0.55);
    drawGhost(lx + 52, y + h / 2 - 2, robo);
    if (live) hit.ghost = { x: lx + 14, y: y + 18, width: 76, height: h - 36 };
    const tx = lx + 100, tw = leftW - 112;
    for (const key of Object.keys(hit)) if (key.startsWith('aichip_')) delete hit[key];
    // Three calm versions of this card: nothing going on, a chat app (ChatGPT / Claude), or several chats at once.
    const chats = activeChats();
    if (chats.length > 1) return drawChatList(chats, tx, y, tw, h, live);
    if (!p) return drawIdleAi(tx, y, tw, h, live);
    if (p.kind !== 'hooks') return drawChatApp(p, st, tx, y, tw, h);
    ctx.save(); ctx.beginPath(); ctx.arc(tx + 4, y + 21, 3.6, 0, Math.PI * 2); ctx.fillStyle = dot; if (p) { ctx.shadowColor = dot; ctx.shadowBlur = 6; } ctx.fill(); ctx.restore();
    text(project, tx + 14, y + 25, 12.5, '#f2f5ef', 700, 'left', tw * 0.55);
    if (project !== agentName) text(agentName, tx + 14 + Math.min(tw * 0.55, project.length * 7.4) + 8, y + 25, 11, '#7d847f', 500, 'left', tw * 0.35);
    const steps = p?.steps || [], doneSteps = steps.filter(s => s.state === 'done').length;
    if (steps.length) text(`${doneSteps}/${steps.length}`, tx + tw, y + 25, 10.5, '#7d847f', 600, 'right');
    const sx = tx + 2, sy = y + 44;
    statusIcon(sx + 5, sy - 4, st, dot, p);
    const summary = st === 'done' && p?.run?.out?.length ? (p.run.out.find(l => /pass|passed|ok|success|klaar/i.test(l)) || '') : '';
    text(statusText, sx + 16, sy, 11.5, p ? (st === 'done' ? dot : '#e8ece6') : '#8a918c', 700, 'left', tw * 0.5);
    // your 5-hour Claude limit, once it starts to matter
    const lim = usage().fiveHour;
    if (lim && lim.used >= 50) {
      const c = ringColour(lim.used), bw = 74, bx = tx + tw - bw, pulse = lim.used >= 90 ? 0.65 + 0.35 * Math.cos(performance.now() / 260) : 1;
      ctx.save(); ctx.globalAlpha = pulse; text(`Limiet ${lim.used}%`, tx + tw, sy - 2, 10.5, c, 800, 'right');
      ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.roundRect(bx, sy + 3, bw, 3, 1.5); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(bx, sy + 3, bw * Math.min(1, lim.used / 100), 3, 1.5); ctx.fill(); ctx.restore();
    }
    if (summary.trim()) text(summary.trim(), sx + 16 + Math.min(tw * 0.5, statusText.length * 7) + 8, sy, 11, '#aab2ad', 500, 'left', tw * 0.45);
    const bx = tx, by = y + 54, bw = tw, bh = h - 66;
    if (bh < 20) return;
    ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fillStyle = '#0b0c0d'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.clip();
    const lh = 13, mx = bx + 10;
    if (p?.code && busy(p)) {
      mono(p.code.file, mx, by + 14, 9.5, '#7ab8ff', bw - 20);
      p.code.lines.slice(0, Math.floor((bh - 22) / lh)).forEach((l, i) => {
        const ly = by + 22 + i * lh;
        ctx.fillStyle = l.t === '-' ? 'rgba(255,80,80,.14)' : 'rgba(60,220,120,.13)'; ctx.fillRect(bx + 4, ly - 1, bw - 8, lh);
        mono((l.t === '-' ? '- ' : '+ ') + l.text, mx, ly + 9.5, 9.5, l.t === '-' ? '#ff8f8f' : '#7ee6a2', bw - 20);
      });
    } else if (p?.run) {
      mono('$ ' + p.run.command, mx, by + 14, 9.5, '#cfd5d1', bw - 20);
      p.run.out.slice(-Math.floor((bh - 20) / lh)).forEach((l, i) => {
        const good = /\bpass(ed)?\b|✓|success/i.test(l), bad = /\bfail(ed)?\b|error|✕/i.test(l);
        mono(l, mx, by + 28 + i * lh, 9.5, good ? '#7ee6a2' : bad ? '#ff8f8f' : '#8a918c', bw - 20);
      });
    } else if (p?.lastMessage) {
      String(p.lastMessage).split('\n').filter(Boolean).slice(0, Math.floor((bh - 8) / lh)).forEach((l, i) => mono(l, mx, by + 15 + i * lh, 9.5, '#aab2ad', bw - 20));
    } else {
      mono(p ? '…' : '$ claude', mx, by + 15, 9.5, '#5d6460', bw - 20);
      if (!p) mono('TwoCode volgt het vanzelf', mx, by + 28, 9.5, '#3f4542', bw - 20);
    }
    ctx.restore();
  }
  function claudeWidget(w, r) {
    const { p, st, project, statusText, dot, lastLine } = claudeInfo(), small = w.size === 'S';
    const rs = small ? Math.min(34, r.height * 0.5) : Math.min(44, r.height * 0.62);
    drawGhost(r.x + (small ? 28 : 36), r.y + r.height / 2, rs);
    const tx = r.x + (small ? 54 : 70), tw = r.x + r.width - tx - 12, my = r.y + r.height / 2;
    if (small) {
      text(project, tx, my - 3, 12, '#f2f5ef', 700, 'left', tw);
      text(statusText, tx, my + 13, 10.5, p ? (st === 'done' ? dot : '#c9d0cb') : '#8a918c', 600, 'left', tw);
      return;
    }
    ctx.save(); ctx.beginPath(); ctx.arc(tx + 4, my - 15, 3.6, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill(); ctx.restore();
    text(project, tx + 14, my - 11, 12.5, '#f2f5ef', 700, 'left', tw - 14);
    statusIcon(tx + 5, my + 2, st, dot, p);
    text(statusText, tx + 16, my + 6, 11.5, p ? (st === 'done' ? dot : '#e8ece6') : '#8a918c', 700, 'left', tw - 16);
    if (lastLine && r.height > 56) mono(lastLine, tx, my + 22, 9.5, '#7d847f', tw);
  }
  function cover(x, y, s, rad) {
    const art = albumImage?.complete && albumImage.naturalWidth;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, s, s, rad); ctx.clip();
    if (art) ctx.drawImage(albumImage, x, y, s, s);
    else { ctx.fillStyle = APPS.spotify.tint(); ctx.globalAlpha = 0.22; ctx.fillRect(x, y, s, s); }
    ctx.restore();
    if (!art) window.__twocodeIcon?.('music', x + s / 2, y + s / 2, s * 0.5, '#f4f7f2');
  }
  function spotifyWidget(w, r, live) {
    const t = spotifyState.track;
    if (!t) return genericWidget(w, r);
    const artist = t.artist || (Array.isArray(t.artists) ? t.artists.map(a => a.name || a).join(', ') : '');
    const playing = spotifyState.is_playing, part = spotifyState.duration_ms ? Math.min(1, ((spotifyState.progress_ms || 0) + (playing ? performance.now() - spotifySyncAt : 0)) / spotifyState.duration_ms) : 0;
    if (w.size === 'S') {
      const s = Math.min(40, r.height - 20); cover(r.x + 12, r.y + (r.height - s) / 2, s, 9);
      text(t.name, r.x + s + 22, r.y + r.height / 2 - 2, 12, '#f2f5ef', 700, 'left', r.width - s - 30);
      text(artist, r.x + s + 22, r.y + r.height / 2 + 13, 10.5, '#8f998d', 500, 'left', r.width - s - 30);
      return;
    }
    if (w.size === 'W') {
      const s = r.height - 18; cover(r.x + 9, r.y + 9, s, 10);
      const tx = r.x + s + 22, tw = r.width - s - 22 - 90;
      text(t.name, tx, r.y + r.height / 2 - 2, 13, '#f2f5ef', 700, 'left', tw);
      text(artist, tx, r.y + r.height / 2 + 14, 11, '#8f998d', 500, 'left', tw);
      wbtn(r.x + r.width - 62, r.y + r.height / 2, 12, 'next', 'hmNext', false, live);
      wbtn(r.x + r.width - 28, r.y + r.height / 2, 16, playing ? 'pause' : 'play', 'homePlay', true, live);
      return;
    }
    const s = Math.min(r.height - 20, r.width * 0.42); cover(r.x + 10, r.y + 10, s, 14);
    const tx = r.x + s + 24, tw = r.x + r.width - tx - 14;
    text(t.name, tx, r.y + 30, 14.5, '#fff', 700, 'left', tw);
    text(artist, tx, r.y + 48, 11.5, '#9aa596', 500, 'left', tw);
    if (spotifyState.device && !spotifyState.device.here) text('Speelt op ' + spotifyState.device.name, tx, r.y + 68, 10.5, window.__twocodeAlbumColour || '#1ed760', 600, 'left', tw); // where it plays (no fake sound wave)
    const py = r.y + r.height - 50;
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.roundRect(tx, py, tw, 4, 2); ctx.fill(); ctx.fillStyle = '#f4f7f0'; ctx.beginPath(); ctx.roundRect(tx, py, Math.max(4, tw * part), 4, 2); ctx.fill(); ctx.restore();
    const cy = r.y + r.height - 24, mid = tx + tw / 2;
    wbtn(mid - 42, cy, 13, 'previous', 'hmPrev', false, live);
    wbtn(mid, cy, 17, playing ? 'pause' : 'play', 'homePlay', true, live);
    wbtn(mid + 42, cy, 13, 'next', 'hmNext', false, live);
  }
  function focusWidget(w, r, live) {
    const f = window.__twocodeFocus; if (!f) return genericWidget(w, r);
    const on = f.active(), part = on ? Math.min(1, Math.max(0, 1 - f.left() / (f.length() || 1))) : 0, label = on ? f.label() : `${f.minutes()}:00`;
    const ring = (cx, cy, rad, lw) => {
      ctx.save(); ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,179,92,.16)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
      if (part > 0) { ctx.strokeStyle = '#ffb35c'; ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + part * Math.PI * 2); ctx.stroke(); }
      ctx.restore();
    };
    if (w.size === 'S') {
      ring(r.x + 30, r.y + r.height / 2, 17, 3.5); window.__twocodeIcon?.('timer', r.x + 30, r.y + r.height / 2, 16, '#ffd3a1');
      text(label, r.x + 58, r.y + r.height / 2 - 1, 15, '#fff', 700, 'left', r.width - 66);
      text(on ? 'Focus loopt' : 'Focus', r.x + 58, r.y + r.height / 2 + 14, 10.5, '#8f998d', 500, 'left', r.width - 66);
      return;
    }
    if (w.size === 'W') {
      const rad = r.height / 2 - 12; ring(r.x + 14 + rad, r.y + r.height / 2, rad, 4); window.__twocodeIcon?.('timer', r.x + 14 + rad, r.y + r.height / 2, 18, '#ffd3a1');
      text(label, r.x + rad * 2 + 30, r.y + r.height / 2 + 2, 20, '#fff', 700);
      text(on ? 'Blijf gefocust' : 'Focus', r.x + rad * 2 + 30, r.y + r.height / 2 + 17, 10.5, '#8f998d', 500);
      wbtn(r.x + r.width - 28, r.y + r.height / 2, 16, on ? 'stop' : 'play', 'focusQuick', true, live);
      return;
    }
    const rad = Math.min(r.height / 2 - 14, r.width * 0.2), cx = r.x + 18 + rad, cy = r.y + r.height / 2;
    ring(cx, cy, rad, 6);
    text(label, cx, cy + 7, 21, '#fff', 700, 'center');
    const tx = cx + rad + 22;
    text('Focus', tx, r.y + 36, 15, '#fff', 700);
    text(on ? 'Blijf gefocust, Robo let op' : 'Klaar om te starten', tx, r.y + 54, 11, '#8f998d', 500, 'left', r.x + r.width - tx - 12);
    wbtn(tx + 18, r.y + r.height - 32, 18, on ? 'stop' : 'play', 'focusQuick', true, live);
  }
  function noteWidget(w, r) {
    if (w.size === 'S') return genericWidget(w, r);
    window.__twocodeIcon?.('note', r.x + 22, r.y + 20, 16, '#ffd166');
    text('Notitie', r.x + 36, r.y + 25, 12, '#f2f5ef', 700);
    const lines = wrapLines(noteText, r.width - 32, 11.5, Math.max(1, Math.floor((r.height - 38) / 16)));
    if (!lines.length) { text('Tik om iets op te schrijven', r.x + 16, r.y + 46, 11.5, '#6f7a6b', 500); return; }
    lines.forEach((l, i) => text(l, r.x + 16, r.y + 46 + i * 16, 11.5, '#d9dfd4', 500, 'left', r.width - 32));
  }
  function clipsWidget(w, r) {
    if (w.size === 'S') return genericWidget(w, r);
    window.__twocodeIcon?.('copy', r.x + 22, r.y + 20, 16, '#5ad1c4');
    text('Klembord', r.x + 36, r.y + 25, 12, '#f2f5ef', 700);
    if (clipList.length) text(String(clipList.length), r.x + r.width - 16, r.y + 25, 11, '#7d847f', 600, 'right');
    const max = Math.max(1, Math.floor((r.height - 36) / 17));
    if (!clipList.length) { text('Kopieer iets, dan staat het hier', r.x + 16, r.y + 46, 11.5, '#6f7a6b', 500); return; }
    clipList.slice(0, max).forEach((c, i) => {
      const ly = r.y + 36 + i * 17;
      if (i) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(r.x + 14, ly - 2, r.width - 28, 1); }
      mono(String(c).replace(/\s+/g, ' ').trim(), r.x + 16, ly + 11, 10, '#cfd5d1', r.width - 32);
    });
  }
  function clockWidget(w, r) {
    const d = new Date(), time = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const day = d.toLocaleDateString('nl-NL', w.size === 'S' ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' });
    const sec = (d.getSeconds() + d.getMilliseconds() / 1000) / 60;
    if (w.size === 'L') {
      text(time, r.x + r.width / 2, r.y + r.height / 2 + 10, 44, '#fff', 700, 'center');
      text(day, r.x + r.width / 2, r.y + r.height / 2 + 34, 12.5, '#9aa596', 500, 'center');
    } else if (w.size === 'W') {
      text(time, r.x + 18, r.y + r.height / 2 + 11, 30, '#fff', 700);
      text(day, r.x + r.width - 18, r.y + r.height / 2 + 5, 12, '#9aa596', 500, 'right', r.width / 2 - 20);
    } else {
      text(time, r.x + 16, r.y + r.height / 2 + 3, 22, '#fff', 700);
      text(day, r.x + 16, r.y + r.height / 2 + 19, 10.5, '#8f998d', 500, 'left', r.width - 28);
    }
    ctx.save(); ctx.fillStyle = 'rgba(138,180,255,.6)'; ctx.fillRect(r.x + 16, r.y + r.height - 6, (r.width - 32) * sec, 2); ctx.restore();
  }
  function genericWidget(w, r) {
    const a = APPS[w.id], status = appStatus(w.id), my = r.y + r.height / 2;
    if (w.size === 'S') {
      appIcon(r.x + 12, my - 15, 30, a.icon, a.tint(), r);
      text(a.label, r.x + 52, my - 2, 12, '#f2f5ef', 700, 'left', r.width - 60);
      text(status, r.x + 52, my + 13, 10.5, '#8f998d', 500, 'left', r.width - 60);
    } else if (w.size === 'W') {
      appIcon(r.x + 14, my - 19, 38, a.icon, a.tint(), r);
      text(a.label, r.x + 64, my - 2, 14, '#f2f5ef', 700, 'left', r.width - 76);
      text(status, r.x + 64, my + 15, 11.5, '#8f998d', 500, 'left', r.width - 76);
    } else {
      appIcon(r.x + 16, r.y + 16, 46, a.icon, a.tint(), r);
      text(a.label, r.x + 18, r.y + r.height - 36, 16, '#fff', 700, 'left', r.width - 36);
      text(status, r.x + 18, r.y + r.height - 18, 11.5, '#8f998d', 500, 'left', r.width - 36);
    }
  }
  const RENDER = { claude: claudeWidget, spotify: spotifyWidget, focus: focusWidget, note: noteWidget, clips: clipsWidget, clock: clockWidget };
  function drawWidget(w, r, live) {
    if (w.id === 'claude' && w.size === 'L') return drawClaudeCard(r.x, r.y, r.width, r.height, live);
    widgetBg(r, live ? APPS[w.id].key : null);
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.width, r.height, 16); ctx.clip();
    try { (RENDER[w.id] || genericWidget)(w, r, live); } finally { ctx.restore(); }
  }

  // ---- the grid ----
  function gridGeo(area) {
    const gap = 8, x = area.x, y = area.y, cw = (area.width - gap * (COLS - 1)) / COLS, ch = (area.height - 2 - gap * (ROWS - 1)) / ROWS;
    return { gap, x, y, cw, ch, rect: (c, r, w = 1, h = 1) => ({ x: x + c * (cw + gap), y: y + r * (ch + gap), width: w * cw + (w - 1) * gap, height: h * ch + (h - 1) * gap }) };
  }
  function dragPlan(g) { // where would everything go if you dropped it here?
    const list = getWidgets(), me = list.find(w => w.id === drag.id); if (!me) return null;
    const [sw, sh] = SIZES[me.size], left = drag.px - drag.dx, topY = drag.py - drag.dy;
    const c = Math.max(0, Math.min(COLS - sw, Math.round((left - g.x) / (g.cw + g.gap)))), r = Math.max(0, Math.min(ROWS - sh, Math.round((topY - g.y) / (g.ch + g.gap))));
    if (c === me.c && r === me.r) return null;
    const plan = arrange(list.map(w => w.id === me.id ? { ...w, c, r } : w), me.id);
    if (plan.ok) return plan;
    // no room around it: swap places with what is there
    const other = list.find(w => w.id !== me.id && w.c === c && w.r === r && w.size === me.size);
    if (other) { const swapped = arrange(list.map(w => w.id === me.id ? { ...w, c, r } : w.id === other.id ? { ...w, c: me.c, r: me.r } : w), me.id); if (swapped.ok) return swapped; }
    return null;
  }
  // ---- Home, like an expanded Dynamic Island: everything right on the black, no cards. Left what Claude does now
  // (with a 4-step progress bar), right your music and a focus timer, at the bottom a row of apps. ----
  const C = { purple: '#bf5af2', orange: '#ff9230', yellow: '#ffd600', green: '#30d158', red: '#ff4245', blue: '#0091ff', teal: '#00d2e0', grey: '#8e8e93', g2: '#2c2c2e', g3: '#3a3a3c', g1: '#1c1c1e' };
  function big(str, x, y, size, colour, weight = 600, maxW = 0, align = 'left') { // display text: Inter, tighter as it grows
    ctx.save(); ctx.font = `${weight} ${size}px Inter, "Segoe UI", sans-serif`; ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    if (size >= 20) ctx.letterSpacing = `${(-0.012 * size).toFixed(2)}px`;
    let t = String(window.__twocodeTr?.(String(str || '')) ?? str ?? ''); if (maxW) while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -2) + '…';
    ctx.fillText(t, x, y); ctx.restore();
  }
  const dot = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  function claudeMark(x, y, colour, size = 16) { // a simple star mark, no container (Apple: logo marks without a container)
    ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = size * 0.16; ctx.lineCap = 'round'; const r = size * 0.4;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
    ctx.restore();
  }
  function geminiMark(x, y, colour, size = 16) {
    ctx.save();
    const r = size * 0.52;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.restore();
  }
  const phaseOf = steps => steps.reduce((m, s) => Math.max(m, s.kind === 'edit' ? 1 : s.kind === 'run' ? 2 : 0), 0);
  // the 4-step bar (Lezen → Aanpassen → Testen → Klaar): done white, the current step in the state's colour
  function steps4(x, y, w, phase, colour, done) {
    const gap = 4, sw = (w - gap * 3) / 4, labels = [T('Lezen', 'Read'), T('Aanpassen', 'Edit'), T('Testen', 'Test'), T('Klaar', 'Done')];
    for (let i = 0; i < 4; i++) {
      const sx = x + i * (sw + gap), full = done || i < phase, now = !done && i === phase;
      box(sx, y, sw, 6, 3, C.g3);
      if (full) box(sx, y, sw, 6, 3, done ? C.green : '#ffffff');
      if (now) { const t = (performance.now() / 1600) % 1; box(sx, y, Math.max(6, sw * (0.35 + 0.45 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)))), 6, 3, colour); }
      text(labels[i], i === 0 ? sx : i === 3 ? sx + sw : sx + sw / 2, y + 24, 12, (now || (done && i === 3)) ? '#ffffff' : C.grey, 600, i === 0 ? 'left' : i === 3 ? 'right' : 'center');
    }
  }
  // ---- Home, like Apple Music: calm black, white and grey; colour only comes from a cover (the album, Claude's tile).
  // One "now playing" row on top (Claude's job, your music, or all quiet) and a tab bar of apps underneath. ----
  const alpha = (c, a) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if (m) return `rgba(${m[1]},${m[2]},${m[3]},${a})`; const n = parseInt(String(c).replace('#', '').slice(0, 6), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  window.__twocodeClaudeCover = (x, y, s, r, agent) => { // a square cover like an album
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, s, s, r); const g = ctx.createLinearGradient(x, y, x + s, y + s);
    if (agent === 'codex') { g.addColorStop(0, '#3a3a3c'); g.addColorStop(1, '#141416'); }
    else if (agent === 'antigravity') { g.addColorStop(0, '#4285f4'); g.addColorStop(1, '#1a73e8'); }
    else { g.addColorStop(0, '#e08a6c'); g.addColorStop(1, '#9c4126'); }
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    if (agent === 'antigravity') geminiMark(x + s / 2, y + s / 2, '#ffffff', s * 0.46);
    else claudeMark(x + s / 2, y + s / 2, '#ffffff', s * 0.42);
  };
  function scrub(x, y, w, part, live) { // a thin progress line like the music scrubber
    box(x, y, w, 4, 2, C.g3);
    if (part > 0) box(x, y, Math.max(4, w * Math.min(1, part)), 4, 2, '#ffffff');
    if (live) { const t = (performance.now() / 1400) % 1, sx = x + w * Math.min(1, part); ctx.save(); ctx.globalAlpha = 0.5 * (1 - t); box(sx, y, Math.min(w - (sx - x), 40 * t + 4), 4, 2, '#ffffff'); ctx.restore(); }
  }
  const caps = (str, x, y, colour = C.grey, maxW = 0, align = 'left') => { ctx.save(); ctx.letterSpacing = '0.4px'; text(String(window.__twocodeTr?.(str) ?? str).toUpperCase(), x, y, 12, colour, 600, align, maxW); ctx.restore(); };
  // Home, compact like a notch app: small sharp type, one thing at a time (Claude's job, your music, or all quiet).
  // The pages themselves are one hover away in the tabs at the bottom of the island (icons-ui.js).
  const tiny = (str, x, y, size, colour, weight = 500, align = 'left', maxW = 0) => text(str, x, y, size, colour, weight, align, maxW);
  const clockText = p => { const sec = (p.elapsed || 0) + Math.floor((Date.now() - stateAt) / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  // ---- Home: three glowing tiles, like the Claude page: black with a thin edge, each one glowing from the bottom in its
  // own colour (Claude's orange, your cover's colour, focus purple). When something happens in a tile it comes alive:
  // the glow breathes and a soft light drifts along the bottom. Each tile opens its page. ----
  const WHITE = 'rgba(255,255,255,.18)';
  function widget(x, y, s, key, colour, live, under = null) {
    const b = { x, y, width: s, height: s }, over = inside(pointer.x, pointer.y, b), t = performance.now() / 1000;
    const isGlassy = (typeof window.__twocodeIsGlassy === 'function' && window.__twocodeIsGlassy()) || localStorage.getItem('twocode:glassy') === '1';
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, s, s, 22); ctx.fillStyle = isGlassy ? 'rgba(255,255,255,.07)' : '#000'; ctx.fill(); ctx.clip();
    const k = live ? 0.82 + 0.3 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / 2.6)) : 1; // breathing while something happens
    const glow = (c, a) => { const g = ctx.createLinearGradient(0, y + s * 0.18, 0, y + s);
      g.addColorStop(0, alpha(c, 0)); g.addColorStop(0.58, alpha(c, 0.3 * a)); g.addColorStop(1, alpha(c, Math.min(0.92, 0.72 * a)));
      ctx.fillStyle = g; ctx.fillRect(x, y, s, s); };
    if (under) glow(under.colour, under.k);          // e.g. Claude's own orange coming back
    glow(colour, k * (under ? 1 - under.k : 1));     // ...while the green of "done" fades away
    if (live) { // a soft light drifting along the bottom
      const lx = x + s * (0.5 + 0.38 * Math.sin(t / 1.6)), ly = y + s * 1.02, light = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * 0.62);
      light.addColorStop(0, 'rgba(255,255,255,.22)'); light.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = light; ctx.fillRect(x, y, s, s);
    }
    if (over) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x, y, s, s); }
    ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, s - 1, s - 1, 21.5);
    ctx.strokeStyle = isGlassy ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.1)';
    ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    if (key) hit[key] = b; return over;
  }
  function ring(cx, cy, r, part, colour, track, lw = 5) {
    ctx.save(); ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.strokeStyle = track; ctx.stroke();
    if (part > 0.001) { ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, part)); ctx.strokeStyle = colour; ctx.stroke(); }
    ctx.restore();
  }
  const label = (str, x, y) => tiny(str, x, y, 11, 'rgba(255,255,255,.65)', 600);
  const lower = (str, x, y, w) => tiny(str, x, y, 12, 'rgba(255,255,255,.8)', 500, 'left', w);
  function claudeWidget(x, y, s) {
    const info = claudeInfo(), p = info.p || providers().find(q => q.agent === 'antigravity' && q.connected) || providers().find(q => q.kind === 'hooks' && q.connected) || providers().find(q => q.agent === 'antigravity') || providers().find(q => q.kind === 'hooks'), st = info.p ? info.st : (p?.state || 'ready');
    const isAnti = !p?.agent || p.agent === 'antigravity';
    const pad = 14, rx = x + s - pad - 20, ry = y + pad + 20, key = 'monitor_' + (p?.provider || 'antigravity');
    const mark = (mx, my, sz = 16) => isAnti ? geminiMark(mx, my, '#ffffff', sz * 1.1) : claudeMark(mx, my, '#ffffff', sz);
    if (!p?.connected) {
      widget(x, y, s, key, '#4285f4', false);
      label(p?.agent === 'codex' ? 'Codex' : (isAnti ? 'Antigravity' : 'Claude Code'), x + pad, y + pad + 11);
      ring(rx, ry, 18, 0, '#ffffff', WHITE); mark(rx, ry, 16);
      big(T('Koppel', 'Connect'), x + pad, y + s - 34, 26, '#ffffff', 700, s - pad * 2); lower(T('in Instellingen', 'in Settings'), x + pad, y + s - 15, s - pad * 2);
      return;
    }
    const working = busy(p), failed = ['error', 'stopped'].includes(st), steps = p.steps || [], phase = phaseOf(steps);
    const doneLook = window.__twocodeDoneLook(st === 'done' ? p : null), recent = Boolean(doneLook), five = p.usage?.fiveHour;
    const past = (state.history || []).filter(h => (h.agent || 'claude') === (p.agent || 'claude'));
    const today = past.filter(h => new Date(h.at).toDateString() === new Date().toDateString() && h.result === 'done').length;
    let colour = p.agent === 'codex' ? '#3b82f6' : (isAnti ? '#4285f4' : '#d97757'), live = false, part, head, line;
    if (working) { live = true; part = (phase + 0.5) / 4; head = clockText(p); line = (!steps.length ? T('Denkt na', 'Thinking') : [T('Lezen', 'Reading'), T('Aanpassen', 'Editing'), T('Testen', 'Testing')][phase]) + (p.code?.file && steps[steps.length - 1]?.kind === 'edit' ? ' · ' + p.code.file : ''); }
    else if (st === 'question') { live = true; colour = '#ff9f0a'; part = 1; head = p.permission ? T('Mag dit?', 'May I?') : T('Jouw beurt', 'Your turn'); line = T('Wacht op jou', 'Waiting for you'); }
    else if (doneLook) { colour = doneLook.colour; part = 1; head = T('Klaar', 'Done'); line = p.prompt || T('Alle stappen gedaan', 'Every step done'); }
    else if (failed) { colour = C.red; part = 1; head = T('Gestopt', 'Stopped'); line = p.detail || ''; }
    else { part = five ? five.used / 100 : 0; head = String(today); line = T(today === 1 ? 'klus vandaag' : 'klussen vandaag', today === 1 ? 'job today' : 'jobs today'); }
    // done and looked at: the green fades and agent's own colour comes back underneath
    widget(x, y, s, key, colour, live, doneLook && !doneLook.fresh ? { colour: p.agent === 'codex' ? '#3b82f6' : (isAnti ? '#4285f4' : '#d97757'), k: 1 - doneLook.k } : null);
    label(p.agent === 'codex' ? 'Codex' : (isAnti ? 'Antigravity' : 'Claude Code'), x + pad, y + pad + 11);
    if (p.list && p.list.length > 1) tiny(`+${p.list.length - 1}`, x + pad + (isAnti ? 66 : 72), y + pad + 11, 10, 'rgba(255,255,255,.9)', 700);
    ring(rx, ry, 18, part, '#ffffff', WHITE);
    if (working) { ctx.save(); ctx.translate(rx, ry); ctx.rotate(performance.now() / 1100); mark(0, 0, 16); ctx.restore(); }
    else if (!recent && st !== 'question' && !failed && five) text(five.used + '%', rx, ry + 3.5, 10, '#ffffff', 700, 'center');
    else mark(rx, ry, 16);
    big(head, x + pad, y + s - 34, head.length > 6 ? 22 : 28, '#ffffff', 700, s - pad * 2);
    lower(line, x + pad, y + s - 15, s - pad * 2);
  }
  function musicWidget(x, y, s) {
    const pad = 14, track = spotifyState?.track, art = track && albumImage?.complete && albumImage.naturalWidth, playing = Boolean(spotifyConnected && spotifyState?.is_playing && track);
    const colour = (track && window.__twocodeAlbumColour) || '#ff375f', cs = 44, cx0 = x + s - pad - cs, cy0 = y + pad;
    widget(x, y, s, 'spotifyApp', colour, playing);
    label(T('Muziek', 'Music'), x + pad, y + pad + 11);
    if (!spotifyConnected || !track) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx0 + cs / 2, cy0 + cs / 2, 20, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill(); ctx.restore();
      window.__twocodeIcon?.('music', cx0 + cs / 2, cy0 + cs / 2, 20, '#ffffff', null, 'rgba(0,0,0,0)');
      big(spotifyConnected ? T('Stil', 'Quiet') : 'Spotify', x + pad, y + s - 34, 28, '#ffffff', 700, s - pad * 2);
      lower(spotifyConnected ? T('Er speelt niks', 'Nothing playing') : T('Koppel je muziek', 'Connect your music'), x + pad, y + s - 15, s - pad * 2);
      return;
    }
    // the cover top right (glowing in its own colour), the song bottom left, a round white play button
    ctx.save(); ctx.shadowColor = alpha(colour, 0.6); ctx.shadowBlur = 18; ctx.shadowOffsetY = 5; box(cx0, cy0, cs, cs, 10, '#1c1c1e'); ctx.restore();
    if (art) { ctx.save(); ctx.beginPath(); ctx.roundRect(cx0, cy0, cs, cs, 10); ctx.clip(); ctx.drawImage(albumImage, cx0, cy0, cs, cs); ctx.restore(); }
    if (playing) window.__twocodeVisualizer?.('homeTile', x + pad, y + pad + 30, 18, 12, '#ffffff', 4);
    big(track.name || 'Spotify', x + pad, y + s - 32, 16, '#ffffff', 700, s - pad * 2 - 34);
    lower(playing ? (track.artist || '') : T('gepauzeerd', 'paused'), x + pad, y + s - 15, s - pad * 2 - 34);
    const pb = { x: x + s - 12 - 30, y: y + s - 12 - 30, width: 30, height: 30 }, over = inside(pointer.x, pointer.y, pb);
    ctx.save(); ctx.beginPath(); ctx.arc(pb.x + 15, pb.y + 15, 15, 0, Math.PI * 2); ctx.fillStyle = over ? '#e5e5ea' : '#ffffff'; ctx.fill(); ctx.restore();
    window.__twocodeMediaIcon?.(playing ? 'pause' : 'play', pb.x + 15 + (playing ? 0 : 1), pb.y + 15, 11, '#000000');
    hit.homePlay = pb;
  }
  function focusWidget(x, y, s) {
    const f = window.__twocodeFocus, on = Boolean(f?.active()), pad = 14, rx = x + s - pad - 20, ry = y + pad + 20;
    widget(x, y, s, 'focusApp', C.purple, on);
    label(T('Focus', 'Focus'), x + pad, y + pad + 11);
    const qb = { x: rx - 20, y: ry - 20, width: 40, height: 40 }, over = inside(pointer.x, pointer.y, qb);
    if (on) { // the ring runs empty, a stop button in it
      ring(rx, ry, 18, f.left() / f.length(), '#ffffff', WHITE);
      box(rx - 5, ry - 5, 10, 10, 2.5, over ? 'rgba(255,255,255,.7)' : '#ffffff');
    } else { // ready: a round white start button
      ctx.save(); ctx.beginPath(); ctx.arc(rx, ry, 20, 0, Math.PI * 2); ctx.fillStyle = over ? '#e5e5ea' : '#ffffff'; ctx.fill(); ctx.restore();
      window.__twocodeMediaIcon?.('play', rx + 1.5, ry, 13, C.purple);
    }
    hit.focusQuick = qb;
    const chosen = (f?.chosen?.() || 1500), mmss = sec => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, mins = Math.max(1, Math.ceil((f?.left() || 0) / 60000));
    big(on ? f.label() : mmss(chosen), x + pad, y + s - 34, 28, '#ffffff', 700, s - pad * 2);
    lower(on ? T(`nog ${mins} min`, `${mins} min left`) : T('Klaar om te starten', 'Ready to start'), x + pad, y + s - 15, s - pad * 2);
  }
  function drawBlocks(area) {
    for (const key of ['hmPrev', 'hmNext', 'homePlay', 'focusQuick', 'hmVol', 'focusApp', 'spotifyApp', 'ghost', 'chatApp']) delete hit[key];
    for (const key of Object.keys(hit)) if (key.startsWith('monitor_')) delete hit[key];
    // the tiles of the apps you have (Settings → Apps: a user turned Focus off and still saw its tile), centred
    const tiles = [['claude', claudeWidget], ['spotify', musicWidget], ['focus', focusWidget]].filter(([id]) => installed(id));
    // your own links (rest-ui.js): a block of small squares next to them; with three big tiles it is half as wide (2 links)
    const links = (window.__twocodeLinks?.() || []).length, half = links && tiles.length >= 3 ? 0.5 : 1, parts = tiles.length + (links ? half : 0);
    for (const key of Object.keys(hit)) if (key.startsWith('link_')) delete hit[key];
    const gap = 10, s = Math.min((area.width - gap * (Math.max(3, Math.ceil(parts)) - 1)) / Math.max(3, parts), area.height - 6), y = area.y + 2;
    const total = s * parts + gap * (tiles.length + (links ? 1 : 0) - 1), x0 = area.x + (area.width - total) / 2;
    tiles.forEach(([, draw], i) => draw(x0 + (s + gap) * i, y, s));
    if (links) window.__twocodeLinksBlock?.(x0 + (s + gap) * tiles.length, y, s * half, s);
  }
  canvas.addEventListener('click', e => { // "Alle apps" on Home
    if (currentView !== 'home' || mode !== 'expanded' || !inside(e.clientX, e.clientY, hit.allApps)) return;
    e.preventDefault(); e.stopImmediatePropagation(); setView('apps'); sound('click');
  }, true);
  window.__twocodeEditQuick = () => { editShortcuts = true; setView('shortcuts'); setMode('expanded'); sound('click'); }; // the + button: choose your quick buttons

  drawHome = function (area) {
    if (gallery) { drawGallery(area); return; }
    if (!homeEdit) { drawBlocks(area); return; } // the widget grid only while editing it
    const g = gridGeo(area);
    cell = { w: g.cw, h: g.ch, gap: g.gap };
    const plan = drag?.moved ? dragPlan(g) : null;
    if (drag) drag.plan = plan;
    const { placed, used } = plan || arrange(getWidgets());
    homeGeo = { area, g };
    placed.forEach((w, i) => {
      if (w.hidden) return;
      const target = g.rect(w.c, w.r, w.cw, w.ch);
      if (drag?.moved && drag.id === w.id) { anim[w.id] = { ...target }; return; } // drawn on top, below
      const r = smooth(w.id, target);
      withWiggle(r, i + 1, () => { drawWidget(w, r, !homeEdit); if (homeEdit) { badge(r.x + 6, r.y + 6, '-'); badge(r.x + r.width - 6, r.y + r.height - 6, 'size'); } });
      hit['hmW_' + w.id] = target;
      if (homeEdit) { hit['hmMinus_' + w.id] = { x: r.x - 6, y: r.y - 6, width: 24, height: 24 }; hit['hmSize_' + w.id] = { x: r.x + r.width - 18, y: r.y + r.height - 18, width: 24, height: 24 }; }
    });
    // empty spots: a + to add a widget there
    if (!drag?.moved) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (used[r][c]) continue;
      const b = g.rect(c, r);
      ctx.save(); ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.roundRect(b.x + 0.5, b.y + 0.5, b.width - 1, b.height - 1, 15.5); ctx.strokeStyle = homeEdit ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.07)'; ctx.stroke(); ctx.restore();
      if (homeEdit) badge(b.x + b.width / 2, b.y + b.height / 2, '+');
      else window.__twocodeIcon?.('plus', b.x + b.width / 2, b.y + b.height / 2, 18, inside(pointer.x, pointer.y, b) ? '#c6e994' : '#4a504c');
      hit[`hmAdd_${c}_${r}`] = b;
    }
    // the widget you are dragging follows the mouse, a bit bigger
    if (drag?.moved) {
      const w = getWidgets().find(x => x.id === drag.id);
      if (w) {
        const [sw, sh] = SIZES[w.size], rw = sw * g.cw + (sw - 1) * g.gap, rh = sh * g.ch + (sh - 1) * g.gap, r = { x: drag.px - drag.dx, y: drag.py - drag.dy, width: rw, height: rh };
        ctx.save(); ctx.translate(r.x + rw / 2, r.y + rh / 2); ctx.scale(1.05, 1.05); ctx.translate(-(r.x + rw / 2), -(r.y + rh / 2));
        ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8; ctx.fillStyle = '#141517'; ctx.beginPath(); ctx.roundRect(r.x, r.y, rw, rh, 16); ctx.fill(); ctx.shadowColor = 'transparent';
        drawWidget(w, r, false); ctx.restore();
      }
    }
    delete hit.todayApp; delete hit.assistantApp; delete hit.projectApp;
  };

  // ---- the + menu: a widget gallery with a live preview, sizes and ready-made layouts ----
  function openGallery(c, r) {
    homeEdit = true; drag = null;
    const on = getWidgets().map(w => w.id), pick = Object.keys(APPS).find(id => installed(id) && !on.includes(id)) || 'claude';
    gallery = { pick, size: getWidgets().find(w => w.id === pick)?.size || 'S', c, r };
    refreshWidgetData(); sound('click'); setMode('expanded', false);
  }
  function setGallery(v) { const was = Boolean(gallery); gallery = v; if (was !== Boolean(v) && mode === 'expanded') setMode('expanded', false); }
  function galleryResult() { // what would happen if you press the button
    const list = getWidgets(), mine = list.find(w => w.id === gallery.pick);
    if (mine && mine.size === gallery.size) return { label: 'Staat er al', ok: false };
    const item = { id: gallery.pick, size: gallery.size, c: mine ? mine.c : gallery.c, r: mine ? mine.r : gallery.r };
    const rest = list.filter(w => w.id !== gallery.pick);
    let plan = arrange([...rest, item], item.id);
    if (!plan.ok) plan = arrange([...rest, { ...item, c: undefined, r: undefined }]);
    if (!plan.ok) return { label: 'Geen plek', ok: false, hint: 'Haal eerst iets weg of maak iets kleiner' };
    return { label: mine ? `Maak ${SIZE_NAME[gallery.size].toLowerCase()}` : 'Toevoegen', ok: true, plan };
  }
  function chip(x, y, w, h, label, on, key) {
    const b = { x, y, width: w, height: h }, over = inside(pointer.x, pointer.y, b);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fillStyle = on ? '#c6e994' : over ? '#24272a' : '#1a1c1e'; ctx.fill(); ctx.restore();
    text(label, x + w / 2, y + h / 2 + 4, 11.5, on ? '#10180c' : '#e8ece6', 700, 'center');
    hit[key] = b;
  }
  function drawGallery(area) {
    const x = area.x, y = area.y, W = area.width;
    text('Widgets', x + 4, y + 20, 16, '#fff', 700);
    text('Kies een app en een maat, of pak een kant-en-klare indeling', x + 78, y + 20, 11, '#8f998d', 500, 'left', W - 200);
    chip(x + W - 74, y + 4, 74, 26, 'Klaar', true, 'hmGalClose');
    // ready-made layouts, each with a tiny picture of the grid
    const py = y + 32, pw = (W - 4 * 8) / 5, ph = 40;
    PRESETS.forEach((p, i) => {
      const bx = x + i * (pw + 8), b = { x: bx, y: py, width: pw, height: ph }, over = inside(pointer.x, pointer.y, b);
      ctx.save(); ctx.beginPath(); ctx.roundRect(bx, py, pw, ph, 12); ctx.fillStyle = over ? '#202326' : '#16181a'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.stroke(); ctx.restore();
      const tw = 40, th = 22, tx = bx + 10, ty = py + (ph - th) / 2, tg = 2, tcw = (tw - tg * 3) / 4, tch = (th - tg) / 2;
      presetLayout(p).placed.forEach(w => { if (w.hidden) return; ctx.save(); ctx.beginPath(); ctx.roundRect(tx + w.c * (tcw + tg), ty + w.r * (tch + tg), w.cw * tcw + (w.cw - 1) * tg, w.ch * tch + (w.ch - 1) * tg, 3); ctx.fillStyle = APPS[w.id].tint(); ctx.globalAlpha = 0.75; ctx.fill(); ctx.restore(); });
      text(p.name, tx + tw + 10, py + ph / 2 + 4, 11.5, '#e8ece6', 700, 'left', pw - tw - 26);
      hit['hmPreset_' + i] = b;
    });
    // left: all apps
    const by = py + ph + 10, colW = 122, rowH = 29, onHome = getWidgets().map(w => w.id);
    Object.keys(APPS).filter(id => installed(id)).forEach((id, i) => {
      const a = APPS[id], bx = x + (i % 2) * (colW + 6), byy = by + Math.floor(i / 2) * (rowH + 5), b = { x: bx, y: byy, width: colW, height: rowH }, sel = gallery.pick === id, over = inside(pointer.x, pointer.y, b);
      ctx.save(); ctx.beginPath(); ctx.roundRect(bx, byy, colW, rowH, 10); ctx.fillStyle = sel ? 'rgba(198,233,148,.14)' : over ? '#202326' : '#16181a'; ctx.fill(); if (sel) { ctx.strokeStyle = 'rgba(198,233,148,.6)'; ctx.stroke(); } ctx.restore();
      appIcon(bx + 5, byy + 4, 21, a.icon, a.tint(), b);
      text(a.label, bx + 33, byy + 19, 11.5, '#eef2ec', 600, 'left', colW - 52);
      if (onHome.includes(id)) { ctx.save(); ctx.beginPath(); ctx.arc(bx + colW - 12, byy + rowH / 2, 5, 0, Math.PI * 2); ctx.fillStyle = '#c6e994'; ctx.fill(); ctx.restore(); }
      hit['hmGalApp_' + id] = b;
    });
    // right: sizes + live preview + button
    const rx = x + colW * 2 + 26, rw = x + W - rx, sy = by;
    ['S', 'W', 'L'].forEach((s, i) => chip(rx + i * 80, sy, 72, 26, SIZE_NAME[s], gallery.size === s, 'hmGalSize_' + s));
    const res = galleryResult();
    const bw = 130, bb = { x: x + W - bw, y: sy, width: bw, height: 26 };
    ctx.save(); ctx.beginPath(); ctx.roundRect(bb.x, bb.y, bw, 26, 13); ctx.fillStyle = res.ok ? (inside(pointer.x, pointer.y, bb) ? '#d9f7b3' : '#c6e994') : '#2a2d30'; ctx.fill(); ctx.restore();
    text(res.label, bb.x + bw / 2, bb.y + 17, 11.5, res.ok ? '#10180c' : '#8f998d', 700, 'center');
    hit.hmGalAdd = bb;
    const [sw, sh] = SIZES[gallery.size], pwid = sw * cell.w + (sw - 1) * cell.gap, phei = sh * cell.h + (sh - 1) * cell.gap;
    const availH = area.y + area.height - (sy + 38) - (res.hint ? 16 : 2), scale = Math.min(1, rw / pwid, availH / phei);
    const prx = rx + (rw - pwid * scale) / 2, pry = sy + 36 + (availH - phei * scale) / 2;
    ctx.save(); ctx.translate(prx, pry); ctx.scale(scale, scale);
    drawWidget({ id: gallery.pick, size: gallery.size }, { x: 0, y: 0, width: pwid, height: phei }, false);
    ctx.restore();
    if (res.hint) text(res.hint, rx + rw / 2, area.y + area.height - 4, 10.5, '#ffb35c', 600, 'center');
  }

  // ---- mouse: hold a widget (iPhone) → edit mode; drag to move ----
  const onHome = () => currentView === 'home' && mode === 'expanded';
  canvas.addEventListener('pointerdown', e => {
    swallowClick = false;
    if (!onHome() || gallery || !homeGeo) return;
    if (homeEdit && getWidgets().some(w => inside(e.clientX, e.clientY, hit['hmMinus_' + w.id]) || inside(e.clientX, e.clientY, hit['hmSize_' + w.id]))) return;
    if (Object.keys(hit).some(k => /^(homePlay|hmPrev|hmNext|focusQuick)$/.test(k) && inside(e.clientX, e.clientY, hit[k]))) return;
    const w = getWidgets().find(x => inside(e.clientX, e.clientY, hit['hmW_' + x.id]));
    if (!w) return;
    const r = homeGeo.g.rect(w.c, w.r);
    drag = { id: w.id, x0: e.clientX, y0: e.clientY, px: e.clientX, py: e.clientY, dx: e.clientX - r.x, dy: e.clientY - r.y, moved: false };
    if (!homeEdit) { clearTimeout(longPress); longPress = setTimeout(() => { if (drag && !drag.moved) { window.__twocodeHomeEdit(true); drag = { ...drag }; swallowClick = true; } }, 500); }
    try { canvas.setPointerCapture(e.pointerId); } catch {}
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    drag.px = e.clientX; drag.py = e.clientY;
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) { if (homeEdit) drag.moved = true; else { clearTimeout(longPress); drag = null; } }
  });
  canvas.addEventListener('pointerup', () => {
    clearTimeout(longPress);
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    swallowClick = true;
    if (d.plan) { saveWidgets(d.plan.placed); sound('click'); }
  });
  canvas.addEventListener('click', e => {
    if (!onHome()) return;
    const at = b => inside(e.clientX, e.clientY, b), stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    if (swallowClick) { swallowClick = false; stop(); return; }
    if (e.clientY < 36) return; // the header has its own buttons
    if (gallery) {
      stop();
      if (at(hit.hmGalClose)) { setGallery(null); sound('click'); return; }
      for (let i = 0; i < PRESETS.length; i++) if (at(hit['hmPreset_' + i])) { saveWidgets(presetLayout(PRESETS[i]).placed); setGallery(null); window.__twocodeKick?.(0.04); sound('click'); return; }
      for (const id of Object.keys(APPS)) if (at(hit['hmGalApp_' + id])) { gallery.pick = id; gallery.size = getWidgets().find(w => w.id === id)?.size || gallery.size; sound('click'); return; }
      for (const s of Object.keys(SIZES)) if (at(hit['hmGalSize_' + s])) { gallery.size = s; sound('click'); return; }
      if (at(hit.hmGalAdd)) { const res = galleryResult(); if (res.ok) { saveWidgets(res.plan.placed); setGallery(null); window.__twocodeKick?.(0.03); sound('click'); } else window.__twocodeFlash?.(res.hint || res.label, 1200); }
      return;
    }
    for (const k of Object.keys(hit)) if (k.startsWith('hmAdd_') && at(hit[k])) { stop(); const [, c, r] = k.split('_'); openGallery(+c, +r); return; }
    if (!homeEdit) return;
    stop(); // in edit mode a tap never opens apps
    for (const w of getWidgets()) {
      if (at(hit['hmMinus_' + w.id])) { saveWidgets(getWidgets().filter(x => x.id !== w.id)); sound('click'); return; }
      if (at(hit['hmSize_' + w.id])) {
        const order = ['S', 'W', 'L'], list = getWidgets();
        for (let k = 1; k < 3; k++) {
          const size = order[(order.indexOf(w.size) + k) % 3], plan = arrange(list.map(x => x.id === w.id ? { ...x, size, c: Math.min(x.c, COLS - SIZES[size][0]), r: Math.min(x.r, ROWS - SIZES[size][1]) } : x), w.id);
          if (plan.ok) { saveWidgets(plan.placed); window.__twocodeFlash?.(SIZE_NAME[size], 700); sound('click'); return; }
        }
        window.__twocodeFlash?.('Geen plek om groter te maken', 1200); return;
      }
    }
  }, true);

  // Quick buttons on the home widgets (play/pause music, start focus) — before the card's own click.
  canvas.addEventListener('click', event => {
    if (currentView !== 'home' || mode !== 'expanded') return;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (inside(event.clientX, event.clientY, hit.homePlay)) {
      stop(); const next = spotifyState.is_playing ? 'pause' : 'play';
      spotifyState.is_playing = next === 'play'; spotifySyncAt = performance.now();
      api.spotifyControl?.(next).catch(() => {}); setTimeout(() => refreshSpotify(), 400); sound('click');
    } else if (inside(event.clientX, event.clientY, hit.hmPrev) || inside(event.clientX, event.clientY, hit.hmNext)) {
      stop(); api.spotifyControl?.(inside(event.clientX, event.clientY, hit.hmNext) ? 'next' : 'previous').catch(() => {}); setTimeout(() => refreshSpotify(), 500); sound('click');
    } else if (inside(event.clientX, event.clientY, hit.focusQuick)) { stop(); window.__twocodeFocus?.toggle(); }
  }, true);

  // ---- Apps (the + button): a grid of app tiles, each with a live status line ----
  const TILE_TINT = { music: '#1ed760', terminal: '#c6e994', timer: '#ffb35c', tray: '#8ab4ff', gear: '#b9c2b4' };
  function tile(x, y, w, h, iconName, name, status, key, tint) {
    const over = card(x, y, w, h, key, tint);
    const iy = y + (h - 40) / 2;
    appIcon(x + 14, iy, 40, iconName, tint, { x, y, width: w, height: h });
    text(name, x + 66, y + h / 2 - 2, 13, '#fff', 700, 'left', w - 92);
    text(status, x + 66, y + h / 2 + 15, 10.5, '#8f998d', 500, 'left', w - 80);
    if (over) text('›', x + w - 18, y + h / 2 + 6, 18, 'rgba(255,255,255,.55)', 400, 'center');
  }
  // All apps, like the iPhone home screen: coloured app icons with their name under them, nothing else.
  const HOME_ICONS = [
    { id: 'spotify', key: 'spotifyApp', icon: 'music', nl: 'Muziek', en: 'Music', c: '#ffffff' },
    { id: 'chat', key: 'chatApp', icon: 'robo', nl: 'Robo', en: 'Robo', c: '#ffffff' },
    { id: 'claude', key: 'monitor_antigravity', icon: 'antigravity', nl: 'Antigravity', en: 'Antigravity', c: '#ffffff' },
    { id: 'focus', key: 'focusApp', icon: 'timer', nl: 'Focus', en: 'Focus', c: '#ffffff' },
    { id: 'tray', key: 'trayApp', icon: 'tray', nl: 'Lade', en: 'Tray', c: '#ffffff' },
    { id: 'clips', key: 'clipsApp', icon: 'copy', nl: 'Klembord', en: 'Clipboard', c: '#ffffff' },
    { id: 'note', key: 'noteApp', icon: 'note', nl: 'Notitie', en: 'Note', c: '#ffffff' },
    { id: 'mirror', key: 'mirrorApp', icon: 'camera', nl: 'Spiegel', en: 'Mirror', c: '#ffffff' },
    { id: 'settings', key: 'settingsApp', icon: 'gear', nl: 'Instellingen', en: 'Settings', c: '#ffffff' }
  ];
  const iconHover = {};
  function homeIcon(cx, cy, s, app) {
    const b = { x: cx - s / 2 - 10, y: cy - s / 2 - 6, width: s + 20, height: s + 34 }, over = inside(pointer.x, pointer.y, b);
    iconHover[app.id] = (iconHover[app.id] || 0) + ((over ? 1 : 0) - (iconHover[app.id] || 0)) * 0.3;
    const k = iconHover[app.id], r = s * 0.27;
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx - s / 2, cy - s / 2, s, s, s * 0.22); ctx.fillStyle = k > 0.5 ? '#2c2c2e' : '#1c1c1e'; ctx.fill(); ctx.restore(); // a calm grey tile
    if (app.icon === 'robo') { // Robo's two eyes
      for (const side of [-1, 1]) { ctx.save(); ctx.beginPath(); ctx.ellipse(cx + side * s * 0.12, cy, s * 0.06, s * 0.095, 0, 0, Math.PI * 2); ctx.fillStyle = app.c; ctx.fill(); ctx.restore(); }
    } else if (app.icon === 'camera') {
      ctx.save(); ctx.strokeStyle = app.c; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.roundRect(cx - s * 0.25, cy - s * 0.15, s * 0.36, s * 0.3, 5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s * 0.13, cy - s * 0.04); ctx.lineTo(cx + s * 0.26, cy - s * 0.12); ctx.lineTo(cx + s * 0.26, cy + s * 0.12); ctx.lineTo(cx + s * 0.13, cy + s * 0.04); ctx.closePath(); ctx.stroke(); ctx.restore();
    } else window.__twocodeIcon?.(app.icon, cx, cy, s * 0.46, app.c, null, 'rgba(0,0,0,0)');
    return { b, over };
  }
  drawApps = function (area) {
    const focus = window.__twocodeFocus, p = top(), tray = window.__twocodeTrayCount?.() || 0, en = EN();
    const off = window.__twocodeAppsOff?.() || new Set(), shown = HOME_ICONS.filter(a => !off.has(a.id));
    for (const a of HOME_ICONS) if (!shown.includes(a)) delete hit[a.key];
    const cols = 5, rows = Math.ceil(shown.length / cols), s = 44, colW = area.width / cols, rowH = 82;
    const y0 = area.y + Math.max(8, (area.height - rows * rowH) / 2) + s / 2;
    shown.forEach((app, i) => {
      const cx = area.x + colW * (i % cols) + colW / 2, cy = y0 + Math.floor(i / cols) * rowH;
      const { b } = homeIcon(cx, cy, s, app);
      const label = app.id === 'focus' && focus?.active() ? focus.label() : en ? app.en : app.nl;
      text(label, cx, cy + s / 2 + 16, 11, '#ffffff', 500, 'center', colW - 8);
      // little red badges, like on the iPhone: files in the tray, Claude waiting for you
      const count = app.id === 'tray' ? tray : app.id === 'claude' && p && (p.permission || p.state === 'question') ? 1 : 0;
      if (count) { ctx.save(); ctx.beginPath(); ctx.arc(cx + s / 2 - 4, cy - s / 2 + 4, 10, 0, Math.PI * 2); ctx.fillStyle = '#ff4245'; ctx.fill(); ctx.restore(); text(String(count), cx + s / 2 - 4, cy - s / 2 + 8, 11, '#fff', 700, 'center'); }
      if (app.id === 'claude' && p && busy(p)) { ctx.save(); ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 260); ctx.beginPath(); ctx.arc(cx + s / 2 - 4, cy - s / 2 + 4, 6, 0, Math.PI * 2); ctx.fillStyle = '#ff9230'; ctx.fill(); ctx.restore(); }
      hit[app.key] = b;
    });
    delete hit.todayApp; delete hit.assistantApp; delete hit.projectApp;
  };
  canvas.addEventListener('click', e => { // Robo's app opens the chat
    if (!['apps', 'home'].includes(currentView) || mode !== 'expanded' || !inside(e.clientX, e.clientY, hit.chatApp)) return;
    e.preventDefault(); e.stopImmediatePropagation(); setView('chat'); setMode('expanded');
  }, true);
  // ---- Your shortcuts (the + button): you choose which apps are here (max 4). The same apps are on the home card. ----
  const APPS = {
    spotify: { icon: 'music', label: 'Spotify', key: 'spotifyApp', tint: () => window.__twocodeAlbumColour || '#1ed760' },
    claude: { icon: 'antigravity', label: 'Antigravity', key: 'monitor_antigravity', tint: () => '#4285f4' },
    focus: { icon: 'timer', label: 'Focus', key: 'focusApp', tint: () => '#ffb35c' },
    tray: { icon: 'tray', label: 'Lade', key: 'trayApp', tint: () => '#7ab8ff' },
    clips: { icon: 'copy', label: 'Klembord', key: 'clipsApp', tint: () => '#5ad1c4' },
    note: { icon: 'note', label: 'Notitie', key: 'noteApp', tint: () => '#ffd166' },
    settings: { icon: 'gear', label: 'Instellingen', key: 'settingsApp', tint: () => '#b98cff' },
    clock: { icon: 'clock', label: 'Klok', key: 'clockApp', tint: () => '#8ab4ff' },
    chat: { icon: 'chat', label: 'Robo', key: 'chatApp', tint: () => '#e3ffd4' }
  };
  const APP_OF_KEY = Object.fromEntries(Object.entries(APPS).map(([id, a]) => [a.key, id]));
  const MAX_SHORTCUTS = 4, DEFAULT_SHORTCUTS = ['spotify', 'focus', 'tray', 'settings'];
  const installed = id => !(window.__twocodeAppsOff?.() || new Set()).has(id);
  const shortcuts = () => { try { const v = JSON.parse(localStorage.getItem('twocode:shortcuts')); if (Array.isArray(v) && v.length) return v.filter(id => APPS[id] && installed(id)).slice(0, MAX_SHORTCUTS); } catch {} return DEFAULT_SHORTCUTS.filter(installed); };
  const saveShortcuts = list => { try { localStorage.setItem('twocode:shortcuts', JSON.stringify(list)); } catch {} };
  window.__twocodeShortcuts = shortcuts;
  let editShortcuts = false;
  function appStatus(id) {
    const focus = window.__twocodeFocus, p = top(), tray = window.__twocodeTrayCount?.() || 0;
    if (id === 'spotify') return spotifyState.track ? short(spotifyState.track.name, 20) : 'Muziek';
    if (id === 'claude') return p ? p.detail || labels[p.state] : 'Rustig';
    if (id === 'focus') return focus?.active() ? `Nog ${focus.label()}` : `${focus?.minutes?.() || 25} min`;
    if (id === 'tray') return tray ? `${tray} bestand${tray === 1 ? '' : 'en'}` : 'Leeg';
    if (id === 'clips') return 'Laatste kopieën';
    if (id === 'note') return 'Opschrijven';
    if (id === 'clock') return new Date().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    return 'Kleuren, geluid';
  }
  // The + page: pick the four quick buttons on your home screen (tap an app to put it on or take it off).
  const QUICK_CHOICES = ['focus', 'tray', 'clips', 'note', 'chat', 'settings'];
  function drawShortcuts(area) {
    const x = area.x, w = area.width, list = shortcuts().filter(id => QUICK_CHOICES.includes(id)), en = EN();
    big(T('Snelknoppen', 'Quick buttons'), x + 8, area.y + 26, 22, '#fff', 600);
    text(T(`Kies ${MAX_SHORTCUTS} apps voor je Home · ${list.length} van de ${MAX_SHORTCUTS}`, `Pick ${MAX_SHORTCUTS} apps for your Home · ${list.length} of ${MAX_SHORTCUTS}`), x + 8, area.y + 46, 13, 'rgba(255,255,255,.55)', 500);
    const bw = 86, bx = x + w - bw - 4, by = area.y + 8, overB = inside(pointer.x, pointer.y, { x: bx, y: by, width: bw, height: 34 });
    ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, bw, 34, 17); ctx.fillStyle = overB ? '#e9e9ee' : '#ffffff'; ctx.fill(); ctx.restore();
    text(T('Klaar', 'Done'), bx + bw / 2, by + 22, 13, '#141416', 600, 'center');
    hit.scEdit = { x: bx, y: by, width: bw, height: 34 };
    const apps = QUICK_CHOICES.filter(installed).map(id => HOME_ICONS.find(h => h.id === id)).filter(Boolean);
    const colW = w / apps.length, s = 58, cy = area.y + 82 + s / 2;
    apps.forEach((app, i) => {
      const cx = x + colW * i + colW / 2, on = list.includes(app.id);
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.42; const { b } = homeIcon(cx, cy, s, app); ctx.restore();
      text(en ? app.en : app.nl, cx, cy + s / 2 + 20, 12.5, on ? '#ffffff' : 'rgba(255,255,255,.5)', 500, 'center', colW - 8);
      // a white check when it is on your home screen, an empty circle when not
      const kx = cx + s / 2 - 4, ky = cy - s / 2 + 4;
      ctx.save(); ctx.beginPath(); ctx.arc(kx, ky, 11, 0, Math.PI * 2);
      if (on) { ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#141416'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(kx - 4.5, ky + 0.5); ctx.lineTo(kx - 1.2, ky + 3.8); ctx.lineTo(kx + 4.6, ky - 3); ctx.stroke(); }
      else { ctx.fillStyle = 'rgba(20,20,22,.8)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.6; ctx.stroke(); }
      ctx.restore();
      hit['scToggle_' + app.id] = b;
    });
    text(T('Tip: sneltoetsen stel je in bij Instellingen → Algemeen', 'Tip: set your keyboard shortcuts in Settings → General'), x + w / 2, area.y + area.height - 8, 12, 'rgba(255,255,255,.4)', 500, 'center');
  }
  canvas.addEventListener('click', event => {
    if (currentView !== 'shortcuts' || mode !== 'expanded') return;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (inside(event.clientX, event.clientY, hit.scEdit)) { stop(); editShortcuts = false; setView('home'); sound('click'); return; }
    for (const id of QUICK_CHOICES) {
      if (!inside(event.clientX, event.clientY, hit['scToggle_' + id])) continue;
      stop(); let list = shortcuts().filter(x => QUICK_CHOICES.includes(x));
      if (list.includes(id)) list = list.filter(x => x !== id);
      else if (list.length < MAX_SHORTCUTS) list.push(id);
      else { window.__twocodeFlash?.(T('Max 4 · haal er eerst een uit', 'Max 4 · take one off first'), 1200); return; }
      saveShortcuts(list); sound('click'); return;
    }
  }, true);

  // ---- Usage ring: fills with how much of your 5-hour Claude limit you used ----
  const usage = () => providers().find(p => p.provider === 'claudecode')?.usage || {};
  const ringColour = used => used >= 85 ? '#ff3b3b' : used >= 60 ? '#ff9a1f' : '#22e05a';
  function drawUsageRing(x, y, r) {
    const w = usage().fiveHour; if (!w) return;
    const used = w.used / 100, start = -Math.PI / 2;
    ctx.save(); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.stroke();
    if (used > 0) {
      ctx.beginPath(); ctx.arc(x, y, r, start, start + Math.PI * 2 * Math.min(1, used));
      ctx.strokeStyle = ringColour(w.used); ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8; ctx.stroke();
    }
    ctx.restore();
    text(w.used + '%', x - 10, y + r + 16, 10, '#d9e2d3', 600);
  }
  canvas.addEventListener('click', event => {
    // A tap on Robo himself is for Robo (he hops, gets angry, gets dizzy), not for the card he stands on.
    if (mode === 'expanded' && inside(event.clientX, event.clientY, hit.ghost)) return;
    // one of the little bots on the AI card: open that chat
    for (const [key, box] of Object.entries(hit)) {
      if (key.startsWith('aichip_') && inside(event.clientX, event.clientY, box)) { event.preventDefault(); event.stopImmediatePropagation(); open(box.provider, true); return; }
    }
    for (const provider of Object.keys(names)) {
      if (inside(event.clientX, event.clientY, hit['monitor_' + provider])) { event.preventDefault(); event.stopImmediatePropagation(); open(provider); return; }
    }
    // Answer from the small island (Toestaan / Weigeren / Bekijk).
    if (mode === 'compact') {
      const p = top(), stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
      if (p && inside(event.clientX, event.clientY, hit.cAllow)) { stop(); hooks('aiMonitorHooksDecide', p.sessionId, 'allow'); sound('click'); return; }
      if (p && inside(event.clientX, event.clientY, hit.cDeny)) { stop(); hooks('aiMonitorHooksDecide', p.sessionId, 'deny'); sound('click'); return; }
      if (p && inside(event.clientX, event.clientY, hit.cOpen)) { stop(); open(p.provider); return; }
    }
    // Click the small or medium island while the eyes show a colour: open that status.
    if (active() && mode !== 'expanded' && inside(event.clientX, event.clientY, islandBounds)) {
      event.preventDefault(); event.stopImmediatePropagation();
      const p = top();
      // Claude is done or wants you: go straight to the Claude Code window (the page only if that fails).
      if (p?.kind === 'hooks' && p.canJump && ['done', 'error'].includes(p.state) && !p.ask && !p.plan && !p.permission) { // a question opens the page, so you can read it
        api.aiMonitorHooksJump(p.sessionId).then(result => {
          if (!result?.ok) return open(p.provider);
          if (p.state !== 'question') api.aiMonitorHooksSeen?.().then(update).catch(() => {});
          sound('click');
        }).catch(() => open(p.provider));
        return;
      }
      open(p?.provider);
    }
  }, true);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && ['monitor', 'assistant'].includes(currentView)) { event.preventDefault(); event.stopImmediatePropagation(); small(); }
  }, true);
  api.onAiMonitorState(update); api.onAiMonitorOpen(({ provider }) => open(provider));
  api.aiMonitorGet().then(update).catch(failure => { error = failure.message; render(); });
  function position() {
    const show = ['monitor', 'assistant'].includes(currentView) && mode === 'expanded' && visual.width > 500 && visual.height > Math.min(targetHeight() - 30, 150);
    if (show && doneKey && !doneSeenAt && current()?.state === 'done') doneSeenAt = performance.now(); // you looked: green, fading out
    const display = show ? 'block' : 'none'; if (root.style.display !== display) root.style.display = display;
    if (show) {
      const p = current(), stage = Boolean(p?.kind === 'hooks' && p.connected && window.__twocodePlaceOnStage);
      root.classList.toggle('cl-new', stage); root.classList.toggle('cc-codex', stage && p?.agent === 'codex'); root.classList.toggle('cc-antigravity', stage && p?.agent === 'antigravity'); // Codex: blue, AGY: google blue
      if (stage) window.__twocodePlaceOnStage(root, contentRect()); else window.__twocodePage.place(root, contentRect());
    }
    requestAnimationFrame(position);
  }
  window.__twocodeMonitor = Object.freeze({ open, small, state: () => state, refresh: () => { lastSignature = ''; update(state); } }); render(); requestAnimationFrame(position);
})();
