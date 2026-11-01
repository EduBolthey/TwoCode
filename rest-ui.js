'use strict';
// Two ideas from users, in the island:
//  - the resting island can show the time, the processor (CPU) or the memory instead of Robo's eyes
//    (Settings → General → Resting island; system-main.cjs measures the PC);
//  - your own links (Settings → Apps → Your links, links-main.cjs) as small squares on Home, next to Claude and Music.
(function rest() {
  const api = window.twocode;
  const face = () => window.__twocodePrefs?.().restFace || 'eyes';
  const EN = () => window.__twocodePrefs?.().lang !== 'nl';

  // ---------- the resting island ----------
  let stats = null, asking = false;
  setInterval(async () => {
    if (!['cpu', 'ram'].includes(face()) || asking || !api?.systemStats) return;
    asking = true; try { stats = await api.systemStats(); } catch {} finally { asking = false; }
  }, 2000);
  window.__twocodeRestFace = {
    on: () => face() !== 'eyes',
    draw() { // centred in the small black pill; Robo can still be grabbed there
      const cx = innerWidth / 2, cy = visual.height / 2, f = face();
      const value = f === 'time' ? new Date().toLocaleTimeString(EN() ? 'en-GB' : 'nl-NL', { hour: '2-digit', minute: '2-digit' })
        : f === 'cpu' ? `CPU ${stats ? stats.cpu : '–'}%` : `${EN() ? 'RAM' : 'Geheugen'} ${stats ? stats.ram : '–'}%`;
      ctx.save(); ctx.font = '600 13px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(value, cx, cy + 0.5); ctx.restore();
      hit.ghost = { x: cx - 30, y: 0, width: 60, height: visual.height };
    },
  };

  // ---------- your links on Home ----------
  let links = [];
  api?.linksGet?.().then(v => { links = Array.isArray(v) ? v : []; }).catch(() => {});
  api?.onLinks?.(v => { links = Array.isArray(v) ? v : []; });
  const tint = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 62% 52%)`; };

  const faviconCache = new Map();
  function getFaviconImage(url) {
    if (!url) return null;
    let domain = '';
    try {
      domain = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
    if (!domain) return null;
    if (faviconCache.has(domain)) return faviconCache.get(domain);
    const img = new Image();
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    img.onerror = () => {
      if (!img.src.includes('duckduckgo.com')) {
        img.src = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`;
      }
    };
    faviconCache.set(domain, img);
    return img;
  }

  window.__twocodeLinks = () => links;
  /** The block of small squares at x, y: w wide (a column of 2 when narrow, else 2 by 2), s high. */
  window.__twocodeLinksBlock = (x, y, w, s) => {
    const cols = w < s * 0.75 ? 1 : 2, rows = 2, gap = 8, cw = (w - gap * (cols - 1)) / cols, ch = (s - gap) / rows;
    links.slice(0, cols * rows).forEach((l, i) => {
      const bx = x + (i % cols) * (cw + gap), by = y + Math.floor(i / cols) * (ch + gap), b = { x: bx, y: by, width: cw, height: ch };
      const over = inside(pointer.x, pointer.y, b), colour = tint(l.url);
      const isGlassy = (typeof window.__twocodeIsGlassy === 'function' && window.__twocodeIsGlassy()) || localStorage.getItem('twocode:glassy') === '1';
      ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, cw, ch, 14);
      ctx.fillStyle = isGlassy ? (over ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.09)') : (over ? '#2c2c2e' : '#1c1c1e');
      ctx.fill();
      if (isGlassy) {
        ctx.strokeStyle = 'rgba(255,255,255,.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
      const r = Math.min(16, ch * 0.25), ix = bx + cw / 2, iy = by + ch * 0.42;

      const favicon = getFaviconImage(l.url);
      const urlLow = String(l.url || '').toLowerCase();
      const nameLow = String(l.name || '').toLowerCase();
      const isYT = urlLow.includes('youtube.com') || nameLow === 'youtube';
      const isGemini = urlLow.includes('gemini.google.com') || nameLow.includes('gemini');

      if (favicon && favicon.complete && favicon.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix, iy, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.fill();
        ctx.clip();
        ctx.drawImage(favicon, ix - r + 1, iy - r + 1, (r - 1) * 2, (r - 1) * 2);
        ctx.restore();
      } else if (isYT) {
        // High-res YouTube badge
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix, iy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const tr = r * 0.5;
        ctx.moveTo(ix - tr * 0.5, iy - tr);
        ctx.lineTo(ix + tr * 0.8, iy);
        ctx.lineTo(ix - tr * 0.5, iy + tr);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (isGemini) {
        // High-res Gemini sparkle badge
        ctx.save();
        ctx.beginPath();
        ctx.arc(ix, iy, r, 0, Math.PI * 2);
        const grad = ctx.createLinearGradient(ix - r, iy - r, ix + r, iy + r);
        grad.addColorStop(0, '#1a73e8');
        grad.addColorStop(1, '#8e24aa');
        ctx.fillStyle = grad;
        ctx.fill();
        // 4-point sparkle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const sr = r * 0.75;
        ctx.moveTo(ix, iy - sr);
        ctx.quadraticCurveTo(ix, iy, ix + sr, iy);
        ctx.quadraticCurveTo(ix, iy, ix, iy + sr);
        ctx.quadraticCurveTo(ix, iy, ix - sr, iy);
        ctx.quadraticCurveTo(ix, iy, ix, iy - sr);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save(); ctx.beginPath(); ctx.arc(ix, iy, r, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill();
        ctx.font = `700 ${Math.round(r * 1.05)}px Inter, "Segoe UI", sans-serif`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((l.name[0] || '?').toUpperCase(), ix, iy + 1); ctx.restore();
      }

      ctx.save(); ctx.font = '600 11px Inter, "Segoe UI", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
      let t = l.name; while (t.length > 1 && ctx.measureText(t).width > cw - 10) t = t.slice(0, -2) + '…';
      ctx.fillText(t, ix, by + ch - 10); ctx.restore();
      hit['link_' + i] = b;
    });
  };
  canvas.addEventListener('click', e => { // a link square: open it in your browser
    if (currentView !== 'home' || mode !== 'expanded') return;
    const i = links.findIndex((_, k) => inside(e.clientX, e.clientY, hit['link_' + k]));
    if (i < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    window.__twocodeChime?.('pop'); api?.linksOpen?.(links[i].url);
  }, true);
})();
