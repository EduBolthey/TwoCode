'use strict';
// Focus page: choose hours, minutes and seconds, start, and watch the countdown.
// Timer logic lives in twocode-fun.js (window.__twocodeFocus); layout comes from pages-ui.js.
(function focusPage() {
  const root = document.createElement('section'); root.id = 'twocode-focus'; document.body.appendChild(root);
  const style = document.createElement('style'); style.textContent = `
#twocode-focus{position:absolute;z-index:60;display:none;color:#fff;font:15px/1.4 Inter,"Segoe UI",sans-serif;pointer-events:auto;user-select:none}
#twocode-focus *{box-sizing:border-box}
#twocode-focus button{border:0;cursor:pointer;font-family:inherit;color:#fff;background:transparent;padding:0}
#twocode-focus .fo-body{height:100%;display:flex;flex-direction:column}
#twocode-focus .fo-row{flex:1;min-height:0;display:flex;align-items:center;justify-content:space-between;gap:16px}
/* round buttons like the Clock app and the timer in the Dynamic Island: a tinted circle, the label in the colour */
#twocode-focus .fo-round{flex:none;min-width:92px;height:44px;padding:0 16px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--b);color:var(--f);font-size:15px;font-weight:600}
#twocode-focus .fo-round.sm{min-width:0;height:40px;padding:0 14px}
#twocode-focus .fo-round:hover{filter:brightness(1.2)}
#twocode-focus .fo-round.white:hover{filter:none;background:#e5e5ea}
#twocode-focus .fo-round:active{transform:scale(.97);transition:transform .1s ease-out}
#twocode-focus .fo-round:disabled{opacity:.4;cursor:default}
#twocode-focus .grey{--b:#1c1c1e;--f:#ffffff}
#twocode-focus .white{--b:#ffffff;--f:#000000}
/* the picker wheel */
#twocode-focus .fo-wheel{position:relative;flex:1;height:132px;display:flex;justify-content:center;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 24%,#000 76%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0%,#000 24%,#000 76%,transparent 100%)}
#twocode-focus .fo-band{position:absolute;left:0;right:0;top:50%;height:40px;margin-top:-20px;border-radius:12px;background:#1c1c1e}
#twocode-focus .fo-col{position:relative;width:50%;height:100%;cursor:ns-resize}
#twocode-focus .fo-list{position:absolute;left:0;right:0;top:50%;transition:transform .3s cubic-bezier(.2,.9,.3,1)}
#twocode-focus .fo-num{height:40px;display:flex;align-items:center;justify-content:flex-end;padding-right:54px;font-size:24px;font-weight:600;font-variant-numeric:tabular-nums;color:#48484a;cursor:pointer}
#twocode-focus .fo-num.on{color:#fff}
#twocode-focus .fo-unit{position:absolute;left:calc(100% - 48px);top:50%;margin-top:-11px;font-size:17px;font-weight:600;pointer-events:none}
#twocode-focus .fo-fade{display:none}
#twocode-focus .fo-foot{flex:none;height:34px;display:flex;align-items:center;gap:6px}
#twocode-focus .fo-chip{height:30px;padding:0 13px;border-radius:8px;background:#1c1c1e;font-size:13px;font-weight:600;color:#fff}
#twocode-focus .fo-chip:hover{background:#2c2c2e}
#twocode-focus .fo-chip.on{background:#3a3a3c;color:#fff}
#twocode-focus .fo-end{margin-left:auto;font-size:13px;font-weight:600;color:#8e8e93;font-variant-numeric:tabular-nums}
/* running: like the timer in the iPhone's Dynamic Island, two round buttons left, big white digits right */
#twocode-focus .fo-run{flex:1;display:flex;align-items:center;gap:12px}
#twocode-focus .fo-big{margin-left:auto;text-align:right}
#twocode-focus .fo-big small{display:block;font-size:15px;font-weight:600;color:#8e8e93;margin-bottom:-4px}
#twocode-focus .fo-big b{display:block;font-size:76px;line-height:84px;font-weight:500;letter-spacing:-2px;color:#fff;font-variant-numeric:tabular-nums}
#twocode-focus .fo-bar{flex:none;height:4px;border-radius:2px;background:#3a3a3c;overflow:hidden;margin:6px 0 10px}
#twocode-focus .fo-bar i{display:block;height:100%;border-radius:2px;background:#fff;transition:width .6s linear}
/* compact (notch-app size) */
#twocode-focus .fo-row{gap:12px}
#twocode-focus .fo-round{min-width:76px;height:34px;padding:0 12px;border-radius:9px;font-size:13px}
#twocode-focus .fo-round.sm{height:30px;padding:0 12px;font-size:12px}
#twocode-focus .fo-wheel{height:104px}
#twocode-focus .fo-band{height:32px;margin-top:-16px;border-radius:9px}
#twocode-focus .fo-num{height:32px;font-size:19px;padding-right:46px}
#twocode-focus .fo-unit{left:calc(100% - 42px);margin-top:-9px;font-size:13px}
#twocode-focus .fo-foot{height:28px;gap:5px}
#twocode-focus .fo-chip{height:24px;padding:0 10px;border-radius:7px;font-size:11px}
#twocode-focus .fo-end{font-size:11px}
#twocode-focus .fo-big small{font-size:12px;margin-bottom:-2px}
#twocode-focus .fo-big b{font-size:52px;line-height:58px;letter-spacing:-1.5px}
#twocode-focus .fo-bar{height:3px;margin:4px 0 6px}
#twocode-focus .fo-foot span{font-size:11px !important}
body.twocode-glassy #twocode-focus .fo-band,
#twocode-focus.twocode-glassy .fo-band{background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.14)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04),0 4px 16px rgba(0,0,0,.2)!important}
body.twocode-glassy #twocode-focus .grey,
#twocode-focus.twocode-glassy .grey{--b:rgba(255,255,255,.09)!important;border:1px solid rgba(255,255,255,.14)!important;backdrop-filter:blur(14px)!important;-webkit-backdrop-filter:blur(14px)!important;color:#fff!important}
body.twocode-glassy #twocode-focus .grey:hover,
#twocode-focus.twocode-glassy .grey:hover{--b:rgba(255,255,255,.18)!important;border-color:rgba(255,255,255,.26)!important}
body.twocode-glassy #twocode-focus .white,
#twocode-focus.twocode-glassy .white{background:#fff!important;color:#000!important;box-shadow:0 4px 16px rgba(0,0,0,.35)!important}
body.twocode-glassy #twocode-focus .fo-chip,
#twocode-focus.twocode-glassy .fo-chip{background:rgba(255,255,255,.08)!important;border:1px solid rgba(255,255,255,.12)!important;backdrop-filter:blur(12px)!important;-webkit-backdrop-filter:blur(12px)!important;color:rgba(255,255,255,.85)!important}
body.twocode-glassy #twocode-focus .fo-chip:hover,
#twocode-focus.twocode-glassy .fo-chip:hover{background:rgba(255,255,255,.16)!important;border-color:rgba(255,255,255,.22)!important}
body.twocode-glassy #twocode-focus .fo-chip.on,
#twocode-focus.twocode-glassy .fo-chip.on{background:rgba(255,255,255,.22)!important;border-color:rgba(255,255,255,.38)!important;color:#fff!important;box-shadow:0 2px 8px rgba(0,0,0,.25)!important}
body.twocode-glassy #twocode-focus .fo-bar,
#twocode-focus.twocode-glassy .fo-bar{background:rgba(255,255,255,.16)!important}
body.twocode-glassy #twocode-focus .fo-num,
#twocode-focus.twocode-glassy .fo-num{color:rgba(255,255,255,.32)}
body.twocode-glassy #twocode-focus .fo-num.on,
#twocode-focus.twocode-glassy .fo-num.on{color:#fff!important;text-shadow:0 1px 8px rgba(0,0,0,.4)}
body.twocode-glassy #twocode-focus .fo-unit,
#twocode-focus.twocode-glassy .fo-unit{color:rgba(255,255,255,.72)}
body.twocode-glassy #twocode-focus .fo-end,
#twocode-focus.twocode-glassy .fo-end{color:rgba(255,255,255,.65)!important}`;
  document.head.appendChild(style);

  const F = () => window.__twocodeFocus;
  const EN = () => window.__twocodePrefs?.().lang === 'en', T = (nl, en) => EN() ? en : nl;
  const ROW = 32, HOURS = 6, MINUTES = 60;
  let lastKey = '';
  const at = ms => new Date(ms).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  function column(kind, value, count, unit) {
    const nums = Array.from({ length: count }, (_, i) => `<div class="fo-num${i === value ? ' on' : ''}" data-pick="${kind}" data-v="${i}">${kind === 'm' ? String(i).padStart(2, '0') : i}</div>`).join('');
    return `<div class="fo-col" data-col="${kind}"><div class="fo-list" style="transform:translateY(${-(value * ROW) - ROW / 2}px)">${nums}</div><span class="fo-unit">${unit}</span></div>`;
  }
  function render() {
    const isGlassy = Boolean(window.__twocodeIsGlassy?.() || localStorage.getItem('twocode:glassy') === '1' || document.body.classList.contains('twocode-glassy')); root.classList.toggle('twocode-glassy', isGlassy); const f = F(); if (!f) return;
    const running = f.active();
    const key = running ? 'run' : 'idle:' + f.chosen();
    if (key === lastKey) return update(); // only rebuild when something changed
    lastKey = key;
    const sec = f.chosen(), h = Math.min(HOURS - 1, Math.floor(sec / 3600)), m = Math.floor(sec % 3600 / 60);
    const X = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    const PRESETS = [5, 15, 25, 50];
    const svgI = (d, fill) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="${fill || 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const IC = { play: svgI('<path d="M7 4.5v15l12.5-7.5z"/>', 'currentColor'), stop: `<svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="#ff453a"/></svg>`,
      plus: svgI('<path d="M12 5v14M5 12h14"/>'), reset: svgI('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5"/>') };
    root.innerHTML = running
      ? `<div class="fo-body"><div class="fo-run"><button type="button" class="fo-round sm grey" data-stop="1">${IC.stop}${T('Stop', 'Stop')}</button>
          <button type="button" class="fo-round sm grey" data-plus="300">${IC.plus}5 min</button>
          <div class="fo-big"><small>Focus</small><b id="fo-left">${f.label()}</b></div></div>
          <div class="fo-bar"><i id="fo-ring"></i></div>
          <div class="fo-foot"><span style="font-size:13px;font-weight:600;color:#8e8e93">${T('Robo seint je als de tijd om is', 'Robo lets you know when time is up')}</span><span class="fo-end" id="fo-end"></span></div></div>`
      : `<div class="fo-body"><div class="fo-row"><button type="button" class="fo-round grey" data-set="${25 * 60}">${IC.reset}${T('Herstel', 'Reset')}</button>
          <div class="fo-wheel"><div class="fo-band"></div>${column('h', h, HOURS, T('uur', 'hr'))}${column('m', m, MINUTES, 'min')}<div class="fo-fade"></div></div>
          <button type="button" class="fo-round white" data-start="1"${sec < 60 ? ' disabled' : ''}>${IC.play}Start</button></div>
          <div class="fo-foot">${PRESETS.map(n => `<button type="button" class="fo-chip${sec === n * 60 ? ' on' : ''}" data-set="${n * 60}">${n} min</button>`).join('')}<span class="fo-end" id="fo-end"></span></div></div>`;
    update();
  }
  function update() {
    const isGlassy = Boolean(window.__twocodeIsGlassy?.() || localStorage.getItem('twocode:glassy') === '1' || document.body.classList.contains('twocode-glassy')); root.classList.toggle('twocode-glassy', isGlassy); const f = F(); if (!f) return;
    const end = root.querySelector('#fo-end');
    if (!f.active()) { if (end) end.textContent = T('Klaar om ', 'Done at ') + at(Date.now() + f.chosen() * 1000); return; }
    const left = root.querySelector('#fo-left'), ring = root.querySelector('#fo-ring');
    if (left) left.textContent = f.label();
    if (ring) ring.style.width = (100 * f.left() / f.length()).toFixed(2) + '%'; // full at the start, runs empty
    if (end) end.textContent = T('klaar om ', 'done at ') + at(Date.now() + f.left());
  }
  const setPart = (kind, v) => { const f = F(), sec = f.chosen(), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    const nh = kind === 'h' ? Math.max(0, Math.min(HOURS - 1, v)) : h, nm = kind === 'm' ? (v + MINUTES) % MINUTES : m;
    f.choose(nh * 3600 + nm * 60); lastKey = ''; render(); };
  root.addEventListener('click', e => {
    const num = e.target.closest('[data-pick]');
    if (num) { setPart(num.dataset.pick, Number(num.dataset.v)); sound('click'); return; }
    const b = e.target.closest('button'), f = F(); if (!b || !f) return;
    if (b.dataset.set) f.choose(Number(b.dataset.set));
    if (b.dataset.start) f.start();
    if (b.dataset.plus) f.add(Number(b.dataset.plus));
    if (b.dataset.stop) f.stop();
    sound('click'); lastKey = ''; render();
  });
  // Scroll on the wheel to turn it, one number per notch (like the iPhone).
  root.addEventListener('wheel', e => {
    const col = e.target.closest('[data-col]'), f = F(); if (!col || !f) return;
    e.preventDefault(); const sec = f.chosen(), kind = col.dataset.col, now = kind === 'h' ? Math.floor(sec / 3600) : Math.floor(sec % 3600 / 60);
    setPart(kind, now + (e.deltaY > 0 ? 1 : -1)); sound('click');
  }, { passive: false });

  const baseExpanded = drawExpanded;
  drawExpanded = function (alpha) { if (currentView !== 'focus') return baseExpanded(alpha); drawHeader(alpha); };
  let shown = false;
  (function position() {
    const isGlassy = Boolean(window.__twocodeIsGlassy?.() || localStorage.getItem('twocode:glassy') === '1' || document.body.classList.contains('twocode-glassy')); if (root.classList.contains('twocode-glassy') !== isGlassy) root.classList.toggle('twocode-glassy', isGlassy); const show = currentView === 'focus' && mode === 'expanded' && visual.width > 500 && visual.height > Math.min(targetHeight() - 30, 150);
    const display = show ? 'block' : 'none'; if (root.style.display !== display) root.style.display = display;
    if (show) { window.__twocodePage.place(root, contentRect()); if (!shown) lastKey = ''; render(); }
    shown = show;
    requestAnimationFrame(position);
  })();
})();
