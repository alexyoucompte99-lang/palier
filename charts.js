/* Palier · graphiques SVG légers (ligne, barres empilées) avec survol. Une seule échelle par graphe. */
const CH = { blue: 'var(--blue)', acc: 'var(--acc)', amber: 'var(--amber)', violet: 'var(--violet)', teal: 'var(--teal)', rose: 'var(--rose)', olive: 'var(--olive)', orange: 'var(--orange)', muted: 'var(--soft)' };

function lineChart(el, opts) {
  // opts: series:[{name,color,pts:[{x:label,y}]}], fmt, ref:{y,label}, ymin, ymax, area
  const W = 640, H = opts.h || 200, L = 38, R = 10, T = 14, B = 26;
  const series = opts.series.filter(s => s.pts.length);
  const labels = opts.labels || (series[0] ? series[0].pts.map(p => p.x) : []);
  const ys = series.flatMap(s => s.pts.map(p => p.y)).filter(v => v != null).concat(opts.ref ? [opts.ref.y] : []);
  if (!ys.length) { el.innerHTML = '<div class="empty">Pas encore de données</div>'; return; }
  let ymin = opts.ymin != null ? opts.ymin : Math.min(...ys), ymax = opts.ymax != null ? opts.ymax : Math.max(...ys);
  if (ymin === ymax) { ymin -= 1; ymax += 1; }
  const padY = (ymax - ymin) * 0.08; ymin = opts.ymin != null ? ymin : ymin - padY; ymax = opts.ymax != null ? ymax : ymax + padY;
  const n = Math.max(labels.length, 2);
  const X = i => L + (W - L - R) * (n === 1 ? .5 : i / (n - 1));
  const Y = v => T + (H - T - B) * (1 - (v - ymin) / (ymax - ymin));
  const fmt = opts.fmt || (v => Math.round(v));
  let g = '';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) { const v = ymin + (ymax - ymin) * i / ticks; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="var(--soft)">${fmt(v)}</text>`; }
  const step = Math.ceil(n / 7);
  labels.forEach((l, i) => { if (i % step === 0 || i === n - 1) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--soft)">${esc(l)}</text>`; });
  if (opts.ref) g += `<line x1="${L}" x2="${W - R}" y1="${Y(opts.ref.y)}" y2="${Y(opts.ref.y)}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${W - R}" y="${Y(opts.ref.y) - 4}" text-anchor="end" font-size="10" font-weight="700" fill="var(--amber)">${esc(opts.ref.label || '')}</text>`;
  series.forEach(s => {
    const pts = s.pts.map((p, i) => p.y == null ? null : [X(i), Y(p.y)]);
    let d = '', started = false;
    pts.forEach(p => { if (!p) { started = false; return; } d += (started ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); started = true; });
    if (opts.area) { const first = pts.find(Boolean), last = [...pts].reverse().find(Boolean); if (first && last) g += `<path d="${d}L${last[0]} ${Y(ymin)}L${first[0]} ${Y(ymin)}Z" fill="${s.color}" opacity=".08"/>`; }
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
    pts.forEach((p, i) => { if (p) g += `<circle cx="${p[0]}" cy="${p[1]}" r="${n > 20 ? 2.5 : 4}" fill="${s.color}" stroke="var(--card)" stroke-width="2" data-i="${i}"/>`; });
  });
  el.classList.add('chart');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}<rect x="${L}" y="0" width="${W - L - R}" height="${H}" fill="transparent" data-hit/></svg><div class="tip"></div>` + (series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '');
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
  const move = e => {
    const r = svg.getBoundingClientRect(); const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; const sx = cx / r.width * W;
    let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const d = Math.abs(X(i) - sx); if (d < bd) { bd = d; best = i; } }
    const parts = series.map(s => s.pts[best] && s.pts[best].y != null ? (series.length > 1 ? s.name + ' ' : '') + (s.fmt || fmt)(s.pts[best].y) : null).filter(Boolean);
    if (!parts.length) { tip.style.display = 'none'; return; }
    tip.innerHTML = `<span class="soft">${esc(labels[best])}</span> · ${parts.map(esc).join(' · ')}`;
    tip.style.display = 'block'; tip.style.left = (X(best) / W * r.width) + 'px'; tip.style.top = '14px';
  };
  svg.addEventListener('mousemove', move); svg.addEventListener('touchstart', move, { passive: true }); svg.addEventListener('touchmove', move, { passive: true });
  svg.addEventListener('mouseleave', () => tip.style.display = 'none');
}

function barChart(el, opts) {
  // opts: labels, series:[{name,color,vals:[]}] (empilées), fmt, ref:{y,label}, ymax
  const W = 640, H = opts.h || 190, L = 38, R = 10, T = 14, B = 26;
  const n = opts.labels.length;
  const totals = opts.labels.map((_, i) => sum(opts.series.map(s => s.vals[i] || 0)));
  let ymax = opts.ymax != null ? opts.ymax : Math.max(1, ...totals, opts.ref ? opts.ref.y : 0) * 1.12;
  const fmt = opts.fmt || (v => Math.round(v));
  const bw = (W - L - R) / n, gap = Math.min(10, bw * 0.3);
  const Y = v => T + (H - T - B) * (1 - v / ymax);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = ymax * i / 4; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="10" fill="var(--soft)">${fmt(v)}</text>`; }
  const step = Math.ceil(n / 8);
  opts.labels.forEach((l, i) => {
    if (i % step === 0 || i === n - 1) g += `<text x="${L + bw * i + bw / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="var(--soft)">${esc(l)}</text>`;
    let acc = 0;
    opts.series.forEach((s, k) => {
      const v = s.vals[i] || 0; if (!v) return;
      const y0 = Y(acc + v), y1 = Y(acc);
      const isTop = acc + v >= totals[i] - 1e-9;
      g += `<rect x="${L + bw * i + gap / 2}" y="${y0}" width="${bw - gap}" height="${Math.max(0, y1 - y0 - (acc ? 2 : 0))}" rx="${isTop ? 4 : 0}" fill="${s.color}" data-i="${i}"/>`;
      acc += v;
    });
    if (opts.showVals && totals[i]) g += `<text x="${L + bw * i + bw / 2}" y="${Y(totals[i]) - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--muted)">${fmt(totals[i])}</text>`;
  });
  if (opts.ref) g += `<line x1="${L}" x2="${W - R}" y1="${Y(opts.ref.y)}" y2="${Y(opts.ref.y)}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="4 4"/><text x="${W - R}" y="${Y(opts.ref.y) - 4}" text-anchor="end" font-size="10" font-weight="700" fill="var(--amber)">${esc(opts.ref.label || '')}</text>`;
  el.classList.add('chart');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${g}</svg><div class="tip"></div>` + (opts.series.length > 1 ? `<div class="legend">${opts.series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '');
  const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
  const move = e => {
    const r = svg.getBoundingClientRect(); const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; const i = Math.min(n - 1, Math.max(0, Math.floor((cx / r.width * W - L) / bw)));
    const parts = opts.series.map(s => s.vals[i] ? (opts.series.length > 1 ? s.name + ' ' : '') + fmt(s.vals[i]) : null).filter(Boolean);
    if (!parts.length) { tip.style.display = 'none'; return; }
    tip.innerHTML = `<span class="soft">${esc(opts.labels[i])}</span> · ${parts.map(esc).join(' · ')}` + (opts.series.length > 1 ? ` · total ${esc(fmt(totals[i]))}` : '');
    tip.style.display = 'block'; tip.style.left = ((L + bw * i + bw / 2) / W * r.width) + 'px'; tip.style.top = '14px';
  };
  svg.addEventListener('mousemove', move); svg.addEventListener('touchstart', move, { passive: true }); svg.addEventListener('touchmove', move, { passive: true });
  svg.addEventListener('mouseleave', () => tip.style.display = 'none');
}

// séries journalières sur N jours
function dayLabels(n, end) { const a = []; for (let i = n - 1; i >= 0; i--) a.push(addDays(end || today(), -i)); return a; }
function shortDay(s) { const d = new Date(s + 'T12:00:00'); return d.getDate() + '/' + (d.getMonth() + 1); }
function weekLabels(n) { const a = []; const m = monday(); for (let i = n - 1; i >= 0; i--) a.push(addDays(m, -7 * i)); return a; }
