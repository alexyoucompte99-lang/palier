/* Palier · onglet Suivi : poids, sommeil, nutrition, énergie, écran, temps de travail (30 h). */
function renderSuivi(root) {
  const n = VIEW.range || 30; const days = dayLabels(n); const s = settings();
  const morn = {}; all('morning').forEach(m => morn[m.d] = m);
  const eve = {}; all('evening').forEach(e => eve[e.d] = e);
  const meals = {}; all('meal').forEach(m => { meals[m.d] = meals[m.d] || { k: 0, p: 0 }; meals[m.d].k += m.kcal || 0; meals[m.d].p += m.prot || 0; });
  const weeks = weekLabels(10);
  const hoursC = weeks.map(w => r1(workMinutes(w, addDays(w, 6), 'court') / 60)), hoursL = weeks.map(w => r1(workMinutes(w, addDays(w, 6), 'liberte') / 60));
  const mon = monday(); const wk = weekStats(mon), prev = weekStats(addDays(mon, -7));
  const libPct = wk.hours ? Math.round(wk.hoursLib / wk.hours * 100) : 0;
  const lastW = all('morning').filter(m => m.weight != null).sort((a, b) => b.d.localeCompare(a.d)); const w0 = lastW[0], w7 = lastW.find(m => m.d <= addDays(today(), -7));
  const kpi = (v, l, d) => `<div class="kpi card" style="margin:0"><div class="v">${v}</div><div class="l">${l}</div>${d || ''}</div>`;
  const delta = (a, b, unit, invert) => { if (a == null || b == null) return ''; const d = a - b; if (Math.abs(d) < 0.05) return '<div class="delta muted">= sem. dernière</div>'; const good = invert ? d < 0 : d > 0; return `<div class="delta ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${r1(d)}${unit} vs sem. dernière</div>`; };
  root.innerHTML = `
    <div class="row between" style="margin-top:6px"><h1>Suivi</h1>${segHtml('range', [{ v: 14, l: '14 j' }, { v: 30, l: '30 j' }, { v: 90, l: '90 j' }], n)}</div>
    <div class="sec"><h2>Cette semaine</h2><span class="small muted">vs la précédente</span></div>
    <div class="kpis">
      ${kpi(r1(wk.hours) + ' h', 'travail · cible ≤ ' + s.hours_week + ' h', delta(wk.hours, prev.hours, ' h', true))}
      ${kpi(libPct + ' %', 'liberté future (' + r1(wk.hoursLib) + ' h)', delta(wk.hoursLib, prev.hoursLib, ' h'))}
      ${kpi(wk.sleep != null ? hm(wk.sleep * 60) : '–', 'sommeil moyen', delta(wk.sleep, prev.sleep, ' h'))}
      ${kpi(wk.energy != null ? r1(wk.energy) + '/10' : '–', 'énergie moyenne', delta(wk.energy, prev.energy, ''))}
      ${kpi(w0 ? w0.weight + ' kg' : '–', 'poids', w0 && w7 ? delta(w0.weight, w7.weight, ' kg', true) : '')}
      ${kpi(wk.kcal != null ? Math.round(wk.kcal) : '–', 'kcal / jour · cible ' + s.kcal, '')}
      ${kpi(wk.prot != null ? Math.round(wk.prot) + ' g' : '–', 'protéines / jour · cible ' + s.prot, '')}
      ${kpi(wk.screen != null ? hm(wk.screen) : '–', 'écran / jour', delta(wk.screen != null ? wk.screen / 60 : null, prev.screen != null ? prev.screen / 60 : null, ' h', true))}
    </div>
    <div class="card"><div class="card-h"><h3>Temps de travail par semaine</h3><span class="small muted">court terme vs liberté future</span></div><div data-c="hours"></div></div>
    <div class="card"><div class="card-h"><h3>Poids</h3></div><div data-c="weight"></div></div>
    <div class="card"><div class="card-h"><h3>Sommeil</h3><span class="small muted">heures par nuit</span></div><div data-c="sleep"></div></div>
    <div class="card"><div class="card-h"><h3>Calories</h3><span class="small muted">cible ${s.kcal}</span></div><div data-c="kcal"></div></div>
    <div class="card"><div class="card-h"><h3>Protéines</h3><span class="small muted">cible ${s.prot} g</span></div><div data-c="prot"></div></div>
    <div class="card"><div class="card-h"><h3>Énergie & réveil</h3><span class="small muted">/10</span></div><div data-c="energy"></div></div>
    <div class="card"><div class="card-h"><h3>Temps d'écran</h3><span class="small muted">heures par jour</span></div><div data-c="screen"></div></div>
    <div style="height:20px"></div>`;
  wireSegs(root); root.querySelector('[data-seg="range"]').addEventListener('change', () => { VIEW.range = segVal(root, 'range'); render(); });
  const c = k => root.querySelector(`[data-c="${k}"]`);
  const lab = days.map(shortDay);
  barChart(c('hours'), { labels: weeks.map(w => 'S' + weekKey(w).slice(-2)), series: [{ name: 'court terme', color: CH.blue, vals: hoursC }, { name: 'liberté future', color: CH.amber, vals: hoursL }], ref: { y: s.hours_week, label: 'max ' + s.hours_week + ' h' }, fmt: v => r1(v) + ' h', h: 170 });
  lineChart(c('weight'), { labels: lab, series: [{ name: 'kg', color: CH.violet, pts: days.map(d => ({ x: shortDay(d), y: morn[d] && morn[d].weight != null ? morn[d].weight : null })) }], fmt: v => r1(v), h: 160 });
  lineChart(c('sleep'), { labels: lab, series: [{ name: 'h', color: CH.teal, pts: days.map(d => ({ x: shortDay(d), y: morn[d] ? (morn[d].sleep_h ?? morn[d].sleep_h_auto ?? null) : null })) }], fmt: v => r1(v) + ' h', ref: { y: 7.5, label: '7h30' }, ymin: 4, ymax: 10, area: true, h: 160 });
  barChart(c('kcal'), { labels: lab, series: [{ name: 'kcal', color: CH.orange, vals: days.map(d => meals[d] ? meals[d].k : 0) }], ref: { y: s.kcal, label: s.kcal + ' kcal' }, fmt: v => Math.round(v), h: 160 });
  barChart(c('prot'), { labels: lab, series: [{ name: 'g', color: CH.blue, vals: days.map(d => meals[d] ? meals[d].p : 0) }], ref: { y: s.prot, label: s.prot + ' g' }, fmt: v => Math.round(v), h: 150 });
  lineChart(c('energy'), { labels: lab, series: [{ name: 'énergie du soir', color: CH.amber, pts: days.map(d => ({ x: shortDay(d), y: eve[d] && eve[d].energy != null ? eve[d].energy : null })) }, { name: 'forme au réveil', color: CH.teal, pts: days.map(d => ({ x: shortDay(d), y: morn[d] && morn[d].feel != null ? morn[d].feel : null })) }], fmt: v => r1(v), ymin: 0, ymax: 10, h: 160 });
  barChart(c('screen'), { labels: lab, series: [{ name: 'h', color: CH.rose, vals: days.map(d => morn[d] && morn[d].screen_min != null ? r1(morn[d].screen_min / 60) : 0) }], fmt: v => r1(v) + ' h', h: 150 });
}
