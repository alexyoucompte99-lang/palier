/* Palier · onglet Sport : muscu (3 séances, séries, récap), run (programme 5 km en 20 min), boxe, méditation. */
function renderSport(root) {
  const sub = VIEW.sport || 'muscu';
  root.innerHTML = `<div class="row between" style="margin-top:6px"><h1>Sport</h1><span class="chip chip-amber">🔥 ${streakWeeks()} sem.</span></div>
    <div class="seg mt" data-seg="sub">${[['muscu', '🏋️ Muscu'], ['run', '🏃 Run'], ['boxe', '🥊 Boxe'], ['medit', '🧘 Médit.']].map(([v, l]) => `<button data-v="${v}" class="${sub === v ? 'on' : ''}">${l}</button>`).join('')}</div><div id="sport-body"></div>`;
  wireSegs(root); root.querySelector('[data-seg="sub"]').addEventListener('change', () => { VIEW.sport = segVal(root, 'sub'); render(); });
  const body = root.querySelector('#sport-body');
  if (sub === 'muscu') renderMuscu(body); else if (sub === 'run') renderRun(body); else if (sub === 'boxe') renderBoxe(body); else renderMedit(body);
}

// ================= MUSCU =================
const e1rm = (w, r) => w * (1 + r / 30);
function workoutStats(w) { let ton = 0, sets = 0, reps = 0; (w.ex || []).forEach(e => (e.sets || []).forEach(s => { ton += (s.w || 0) * (s.r || 0); sets++; reps += s.r || 0; })); return { ton, sets, reps }; }
function lastWorkoutOfPlan(plan, before) { return all('workout').filter(w => w.status === 'done' && w.plan === plan && (!before || w.id !== before)).sort((a, b) => (b.end || 0) - (a.end || 0))[0]; }
function lastSetsOf(exName, exceptId) { const ws = all('workout').filter(w => w.status === 'done' && w.id !== exceptId).sort((a, b) => (b.end || 0) - (a.end || 0)); for (const w of ws) { const e = (w.ex || []).find(x => x.name.toLowerCase() === exName.toLowerCase()); if (e && e.sets && e.sets.length) return { sets: e.sets, d: w.d }; } return null; }
function bestE1rm(exName) { let best = 0, when = null; all('workout').filter(w => w.status === 'done').forEach(w => (w.ex || []).forEach(e => { if (e.name.toLowerCase() !== exName.toLowerCase()) return; (e.sets || []).forEach(s => { const v = e1rm(s.w || 0, s.r || 0); if (v > best) { best = v; when = w.d; } }); })); return { best, when }; }

function renderMuscu(body) {
  const live = all('workout').find(w => w.status === 'live');
  const hist = all('workout').filter(w => w.status === 'done').sort((a, b) => (b.end || 0) - (a.end || 0));
  const plans = all('plan');
  const exNames = []; hist.forEach(w => (w.ex || []).forEach(e => { if (!exNames.includes(e.name)) exNames.push(e.name); }));
  const selEx = VIEW.ex && exNames.includes(VIEW.ex) ? VIEW.ex : exNames[0];
  const mon = monday();
  body.innerHTML = `
    ${live ? `<div class="card acc"><div class="row between"><div><div class="small muted">Séance en cours</div><div class="big">${esc(live.name)}</div></div><button class="btn" style="background:#fff;color:var(--acc);border-color:#fff" data-resume>Reprendre →</button></div></div>` : `<div class="sec"><h2>Démarrer une séance</h2><span class="small muted">${inRange('workout', mon, addDays(mon, 6)).filter(w => w.status === 'done').length}/3 cette semaine</span></div>
    <div class="grid3">${plans.map(p => { const l = lastWorkoutOfPlan(p.id); return `<button class="tile" data-start="${p.id}"><span class="t">${esc(p.name)}</span><span class="s">${esc(p.sub || '')}</span><span class="s">${l ? 'dernière : ' + fmtDate(l.d) + ' · ' + Math.round(workoutStats(l).ton / 100) / 10 + ' t' : 'jamais faite'}</span></button>`; }).join('')}</div>
    <div class="row mt"><button class="btn sm ghost" data-editplans>✎ Modifier les séances</button></div>`}
    <div class="sec"><h2>Évolution</h2></div>
    <div class="card"><div class="card-h"><h3>Tonnage par séance</h3><span class="small muted">kg soulevés (poids × reps)</span></div><div data-chart-ton></div></div>
    ${exNames.length ? `<div class="card"><div class="card-h"><h3>Force estimée (1RM)</h3><select class="in" style="width:auto;margin:0;padding:6px 10px;font-size:13px" data-ex>${exNames.map(n => `<option ${n === selEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div><div data-chart-ex></div></div>` : ''}
    <div class="sec"><h2>Historique</h2></div>
    <div class="card">${hist.slice(0, 20).map(w => { const s = workoutStats(w); return `<div class="task" data-wo="${w.id}" style="cursor:pointer"><div class="grow"><div class="title">${esc(w.name)} <span class="muted small">· ${fmtDate(w.d, true)}</span></div><div class="meta"><span>${Math.round(s.ton / 100) / 10} t</span><span>${s.sets} séries</span><span>${s.reps} reps</span><span>${hm(w.dur)}</span></div></div></div>`; }).join('') || '<div class="empty">Ta première séance t\'attend 💪</div>'}</div>`;
  body.querySelectorAll('[data-start]').forEach(b => b.addEventListener('click', () => startWorkout(b.dataset.start)));
  const r = body.querySelector('[data-resume]'); if (r) r.addEventListener('click', () => liveWorkoutSheet(live));
  const ep = body.querySelector('[data-editplans]'); if (ep) ep.addEventListener('click', plansSheet);
  body.querySelectorAll('[data-wo]').forEach(b => b.addEventListener('click', () => recapSheet(get(b.dataset.wo), true)));
  const sel = body.querySelector('[data-ex]'); if (sel) sel.addEventListener('change', () => { VIEW.ex = sel.value; render(); });
  const last = hist.slice(0, 20).reverse();
  lineChart(body.querySelector('[data-chart-ton]'), { series: [{ name: 'tonnage', color: CH.acc, pts: last.map(w => ({ x: fmtDate(w.d), y: Math.round(workoutStats(w).ton) })) }], fmt: v => Math.round(v / 100) / 10 + ' t', area: true, ymin: 0, h: 180 });
  if (selEx) { const pts = last.map(w => { const e = (w.ex || []).find(x => x.name === selEx); const best = e ? Math.max(0, ...(e.sets || []).map(s => e1rm(s.w || 0, s.r || 0))) : null; return { x: fmtDate(w.d), y: best || null }; }).filter(p => p.y); lineChart(body.querySelector('[data-chart-ex]'), { series: [{ name: selEx, color: CH.violet, pts }], fmt: v => Math.round(v) + ' kg', h: 160 }); }
}
function workoutEntry() { const live = all('workout').find(w => w.status === 'live'); if (live) return liveWorkoutSheet(live); VIEW.tab = 'sport'; VIEW.sport = 'muscu'; render(); toast('Choisis ta séance'); }

function startWorkout(planId) {
  const p = get(planId); if (!p) return;
  const sh = openSheet(p.name + ' · exos prévus', `<div class="small muted">Coche ce que tu comptes faire. Tu pourras en ajouter pendant la séance.</div>
    ${chipsHtml('ex', p.ex.map(n => ({ v: n, l: n })), p.ex.slice(), true)}
    <div class="row mt"><input class="in grow" data-newex placeholder="Autre exercice…"><button class="btn" data-addex>＋</button></div>
    <div class="sheet-actions"><button class="btn p wide" data-go>▶ Démarrer la séance</button></div>`);
  wireSegs(sh);
  sh.querySelector('[data-addex]').addEventListener('click', () => { const n = val(sh, '[data-newex]'); if (!n) return; sh.querySelector('[data-seg="ex"]').insertAdjacentHTML('beforeend', `<button type="button" class="chip on" data-v="${esc(n)}">${esc(n)}</button>`); sh.querySelector('[data-newex]').value = ''; });
  sh.querySelector('[data-go]').addEventListener('click', () => {
    const names = segVal(sh, 'ex'); if (!names.length) return toast('Choisis au moins un exo');
    const w = put({ id: uid('workout'), t: 'workout', d: today(), plan: p.id, name: p.name, status: 'live', start: Date.now(), ex: names.map(n => ({ name: n, sets: [], done: false })) });
    sh.close(); liveWorkoutSheet(w);
  });
}
function liveWorkoutSheet(w) {
  w = get(w.id) || w;
  const s = workoutStats(w);
  const sh = openSheet(w.name, `
    <div class="row between"><span class="timer big" data-timer>0:00</span><span class="small muted">${Math.round(s.ton)} kg · ${s.sets} séries</span></div>
    ${w.ex.map((e, i) => {
      const prev = lastSetsOf(e.name, w.id); const best = bestE1rm(e.name);
      const lastSet = e.sets[e.sets.length - 1] || (prev && prev.sets[prev.sets.length - 1]) || { w: '', r: '' };
      return `<div class="ex ${e.done ? 'done' : ''}" data-ex="${i}">
        <div class="row between"><span class="n">${e.done ? '✅ ' : ''}${esc(e.name)}</span><button class="btn sm ${e.done ? '' : 'ghost'}" data-done>${e.done ? 'Rouvrir' : 'Exo fini'}</button></div>
        <div class="small muted">${prev ? 'Dernière fois (' + fmtDate(prev.d) + ') : ' + prev.sets.map(x => x.w + '×' + x.r).join(' · ') : 'Première fois'}${best.best ? ' · record 1RM ' + Math.round(best.best) + ' kg' : ''}</div>
        <div class="sets">${e.sets.map((x, k) => `<span class="set ${e1rm(x.w, x.r) >= best.best - 0.01 && best.best ? 'best' : ''}" data-set="${k}">${x.w} kg × ${x.r}</span>`).join('')}</div>
        ${e.done ? '' : `<div class="setform"><input class="in num" type="number" step="0.5" inputmode="decimal" placeholder="kg" value="${lastSet.w}" data-w><input class="in num" type="number" inputmode="numeric" placeholder="reps" value="${lastSet.r}" data-r><button class="btn p" data-add>＋ série</button></div>`}
      </div>`; }).join('')}
    <div class="row mt"><input class="in grow" data-newex placeholder="Ajouter un exercice…"><button class="btn" data-addex>＋</button></div>
    <div class="sheet-actions"><button class="btn danger" data-abort>Annuler</button><button class="btn p grow" data-finish>Terminer la séance</button></div>`);
  const tEl = sh.querySelector('[data-timer]'); const tick = () => { const sec = Math.floor((Date.now() - w.start) / 1000); tEl.textContent = Math.floor(sec / 60) + ':' + pad(sec % 60); }; tick(); const iv = setInterval(() => { if (!document.body.contains(tEl)) return clearInterval(iv); tick(); }, 1000);
  const refresh = () => { put(w); const y = sh.querySelector('.sheet').scrollTop; liveWorkoutSheet(w); const s2 = document.querySelector('.sheet'); if (s2) s2.scrollTop = y; };
  sh.querySelectorAll('[data-ex]').forEach(box => {
    const i = Number(box.dataset.ex), e = w.ex[i];
    box.querySelector('[data-done]').addEventListener('click', () => { e.done = !e.done; refresh(); });
    const add = box.querySelector('[data-add]'); if (add) add.addEventListener('click', () => { const wv = num(box.querySelector('[data-w]').value), rv = num(box.querySelector('[data-r]').value); if (rv == null) return toast('Reps ?'); e.sets.push({ w: wv || 0, r: rv }); refresh(); });
    box.querySelectorAll('[data-set]').forEach(sp => sp.addEventListener('click', () => { if (confirm('Supprimer cette série ?')) { e.sets.splice(Number(sp.dataset.set), 1); refresh(); } }));
  });
  sh.querySelector('[data-addex]').addEventListener('click', () => { const n = val(sh, '[data-newex]'); if (!n) return; w.ex.push({ name: n, sets: [], done: false }); refresh(); });
  sh.querySelector('[data-abort]').addEventListener('click', () => { if (confirm('Annuler la séance (rien ne sera gardé) ?')) { remove(w.id); sh.close(); render(); } });
  sh.querySelector('[data-finish]').addEventListener('click', () => {
    const st = workoutStats(w); if (!st.sets) return toast('Aucune série enregistrée');
    w.status = 'done'; w.end = Date.now(); w.dur = Math.round((w.end - w.start) / 60000); w.tonnage = st.ton; w.sets = st.sets; w.reps = st.reps; w.ex = w.ex.filter(e => e.sets.length);
    put(w); sh.close(); render(); recapSheet(w);
  });
}
function recapSheet(w, readOnly) {
  const s = workoutStats(w), prev = lastWorkoutOfPlan(w.plan, w.id) ; const ps = prev ? workoutStats(prev) : null;
  const delta = ps ? Math.round((s.ton - ps.ton) / ps.ton * 100) : null;
  const sh = openSheet('Récap · ' + w.name + ' · ' + fmtDate(w.d, true), `
    <div class="hero"><span class="v">${(Math.round(s.ton / 100) / 10).toLocaleString('fr-FR')}</span><span class="u">tonnes soulevées</span>${delta != null ? `<span class="delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} % vs dernière ${esc(w.name)}</span>` : ''}</div>
    <div class="kpis mt"><div class="kpi"><div class="v">${s.sets}</div><div class="l">séries</div></div><div class="kpi"><div class="v">${s.reps}</div><div class="l">répétitions</div></div><div class="kpi"><div class="v">${hm(w.dur)}</div><div class="l">durée</div></div><div class="kpi"><div class="v">${w.ex.length}</div><div class="l">exercices</div></div></div>
    <table class="tbl mt2"><tr><th>Exercice</th><th>Séries</th><th class="right">Meilleure</th><th class="right">vs record</th></tr>
    ${w.ex.map(e => { const bestSet = e.sets.reduce((b, x) => e1rm(x.w, x.r) > e1rm(b.w, b.r) ? x : b, e.sets[0]); const all_ = bestE1rm(e.name); const mine = e1rm(bestSet.w, bestSet.r); const rec = all_.best && mine >= all_.best - 0.01 && (all_.when === w.d); return `<tr><td><b>${esc(e.name)}</b><div class="small muted">${Math.round(sum(e.sets.map(x => x.w * x.r)))} kg</div></td><td class="small">${e.sets.map(x => x.w + '×' + x.r).join(' · ')}</td><td class="right">${bestSet.w} kg × ${bestSet.r}</td><td class="right">${rec ? '<span class="chip chip-amber">🏆 record</span>' : all_.best ? Math.round(mine / all_.best * 100) + ' %' : ''}</td></tr>`; }).join('')}</table>
    <label class="f">Note</label><input class="in" data-note value="${esc(w.note || '')}" placeholder="ressenti, douleur, énergie…">
    <div class="sheet-actions">${readOnly ? '<button class="btn danger" data-del>Supprimer</button>' : ''}<button class="btn p grow" data-ok>OK</button></div>`);
  sh.querySelector('[data-ok]').addEventListener('click', () => { w.note = val(sh, '[data-note]'); put(w); sh.close(); render(); });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { if (confirm('Supprimer cette séance ?')) { remove(w.id); sh.close(); render(); } });
}
function plansSheet() {
  const plans = all('plan');
  const sh = openSheet('Mes 3 séances', plans.map(p => `<div class="card flat" data-plan="${p.id}"><input class="in" data-name value="${esc(p.name)}" style="font-weight:800"><input class="in" data-sub value="${esc(p.sub || '')}" placeholder="sous-titre"><textarea class="in" data-ex rows="6" placeholder="un exercice par ligne">${esc(p.ex.join('\n'))}</textarea></div>`).join('') + `<div class="sheet-actions"><button class="btn p wide" data-save>Enregistrer</button></div>`);
  sh.querySelector('[data-save]').addEventListener('click', () => { sh.querySelectorAll('[data-plan]').forEach(box => { const p = get(box.dataset.plan); p.name = val(box, '[data-name]'); p.sub = val(box, '[data-sub]'); p.ex = val(box, '[data-ex]').split('\n').map(x => x.trim()).filter(Boolean); put(p); }); sh.close(); render(); });
}

// ================= RUN =================
const RUN_GOAL = 20; // minutes sur 5 km
function current5k() { const tests = all('run').filter(r => r.test && r.km >= 4.9 && r.min).sort((a, b) => b.d.localeCompare(a.d)); if (tests[0]) return { min: tests[0].min * 5 / tests[0].km, from: 'test du ' + fmtDate(tests[0].d) }; return { min: settings().run_5k || 30, from: 'point de départ' }; }
function riegel5k(r) { if (!r.km || r.km < 3 || !r.min) return null; return r.min * Math.pow(5 / r.km, 1.06); }
function runProgram() {
  const s = settings(), start = s.run_start || monday(); const cur = current5k().min; const curPace = cur / 5, goalPace = RUN_GOAL / 5;
  const weeks = [];
  const tpl = [
    ['Reprise en douceur', ['Facile 20 min + 4 lignes droites', '8 × (1 min vite / 1 min trot)', 'Endurance 30 min facile']],
    ['Reprise', ['Facile 25 min + 5 lignes droites', '10 × (1 min vite / 1 min trot)', 'Endurance 35 min facile']],
    ['Base', ['Facile 25 min + 6 lignes droites', '12 × (1 min vite / 1 min trot)', 'Endurance 40 min facile']],
    ['VMA', ['6 × 400 m (r 1 min)', 'Tempo 2 × 8 min (r 2 min)', 'Endurance 35 min facile']],
    ['VMA', ['8 × 400 m (r 1 min)', 'Tempo 2 × 10 min (r 2 min)', 'Endurance 40 min facile']],
    ['Test', ['10 × 400 m (r 1 min)', 'Facile 25 min + 4 lignes droites', '⏱️ TEST 5 km à fond']],
    ['Spécifique', ['5 × 800 m (r 1 min 30)', 'Tempo 3 × 10 min (r 2 min)', 'Endurance 40 min facile']],
    ['Spécifique', ['6 × 800 m (r 1 min 30)', 'Tempo 25 min continu', 'Endurance 40 min + lignes droites']],
    ['Spécifique', ['4 × 1000 m (r 2 min)', 'Tempo 2 × 12 min (r 2 min)', 'Endurance 40 min facile']],
    ['Affûtage', ['5 × 1000 m (r 2 min)', 'Tempo 20 min continu', 'Endurance 35 min facile']],
    ['Affûtage', ['3 × 1000 m (r 2 min) + 4 × 200 m', 'Tempo 15 min', 'Facile 30 min']],
    ['Objectif', ['4 × 400 m allure course', 'Facile 20 min + 4 lignes droites', '🏁 TEST 5 km : objectif 20 min']],
  ];
  for (let w = 0; w < 12; w++) {
    const p = curPace + (goalPace - curPace) * ((w + 1) / 12); // allure 5 km visée cette semaine
    const paces = { easy: p + 1.25, tempo: p + 0.35, fast: p - 0.1, race: p };
    const kinds = [['easy', 'fast', 'easy'], ['easy', 'fast', 'easy'], ['easy', 'fast', 'easy'], ['fast', 'tempo', 'easy'], ['fast', 'tempo', 'easy'], ['fast', 'easy', 'race'], ['race', 'tempo', 'easy'], ['race', 'tempo', 'easy'], ['race', 'tempo', 'easy'], ['race', 'tempo', 'easy'], ['race', 'tempo', 'easy'], ['race', 'easy', 'race']][w];
    weeks.push({ n: w + 1, start: addDays(start, 7 * w), title: tpl[w][0], sessions: tpl[w][1].map((desc, i) => ({ id: 'W' + (w + 1) + '-S' + (i + 1), desc, kind: kinds[i], pace: paces[kinds[i]], test: /TEST/.test(desc) })) });
  }
  return weeks;
}
function renderRun(body) {
  const prog = runProgram(), s = settings();
  const wk = VIEW.runWeek != null ? VIEW.runWeek : Math.max(0, Math.min(11, Math.floor((new Date(today() + 'T12:00:00') - new Date(s.run_start + 'T12:00:00')) / 6048e5)));
  const W = prog[wk]; const runs = all('run').sort((a, b) => b.d.localeCompare(a.d));
  const cur = current5k(); const best30 = runs.filter(r => r.d >= addDays(today(), -30)).map(riegel5k).filter(Boolean); const est = best30.length ? Math.min(...best30) : null;
  const mon = monday(); const wkRuns = inRange('run', mon, addDays(mon, 6));
  const weeksLab = weekLabels(12), kmW = weeksLab.map(w => r1(sum(inRange('run', w, addDays(w, 6)).map(r => r.km))));
  const last = runs.slice(0, 25).reverse();
  body.innerHTML = `
    <div class="card acc"><div class="row between"><div><div class="small muted">Objectif</div><div class="big">5 km en 20:00</div><div class="small muted">= 4:00 / km · ${fmtDate(addDays(s.run_start, 83))}</div></div><div class="right"><div class="small muted">Estimation actuelle</div><div class="big">${minStr(cur.min)}</div><div class="small muted">${esc(cur.from)}${est && est < cur.min - 0.2 ? ' · tes runs suggèrent ' + minStr(est) : ''}</div></div></div></div>
    <div class="sec"><h2>Programme · semaine ${W.n}/12</h2><span class="small muted">${wkRuns.length}/3 runs cette semaine</span></div>
    <div class="card">
      <div class="week-nav"><button class="btn sm" data-wk="${wk - 1}" ${wk <= 0 ? 'disabled' : ''}>←</button><div class="center"><b>${esc(W.title)}</b><div class="small muted">du ${fmtDate(W.start)} au ${fmtDate(addDays(W.start, 6))}</div></div><button class="btn sm" data-wk="${wk + 1}" ${wk >= 11 ? 'disabled' : ''}>→</button></div>
      ${W.sessions.map(se => { const done = runs.find(r => r.sess === se.id); return `<div class="run-sess row between"><div class="grow"><div class="k">${done ? '✅ ' : ''}${esc(se.desc)}</div><div class="small muted">allure ${se.kind === 'easy' ? 'facile' : se.kind === 'tempo' ? 'tempo' : se.kind === 'race' ? '5 km' : 'rapide'} ≈ ${paceStr(se.pace)} / km${done ? ' · fait : ' + done.km + ' km en ' + minStr(done.min) + (done.rpe ? ' · effort ' + done.rpe + '/10' : '') : ''}</div></div><button class="btn sm ${done ? '' : 'p'}" data-log="${se.id}">${done ? 'Voir' : 'Fait ✓'}</button></div>`; }).join('')}
    </div>
    <div class="small muted mt">Semaine type : 1 séance rapide, 1 tempo, 1 endurance. 25 à 45 min. Les allures se recalculent à chaque test 5 km.</div>
    <div class="sec"><h2>Évolution</h2></div>
    <div class="card"><div class="card-h"><h3>Allure par sortie</h3><span class="small muted">min / km</span></div><div data-chart-pace></div></div>
    <div class="card"><div class="card-h"><h3>Kilomètres par semaine</h3></div><div data-chart-km></div></div>
    <div class="card"><div class="card-h"><h3>Estimation 5 km</h3><span class="small muted">d'après chaque sortie ≥ 3 km</span></div><div data-chart-est></div></div>
    <div class="sec"><h2>Sorties</h2><button class="btn sm p" data-newrun>＋ Run libre</button></div>
    <div class="card">${runs.slice(0, 15).map(r => `<div class="task" data-run="${r.id}" style="cursor:pointer"><div class="grow"><div class="title">${r.km} km · ${minStr(r.min)} · ${paceStr(r.pace || (r.min / r.km))}/km ${r.test ? '⏱️' : ''}</div><div class="meta"><span>${fmtDate(r.d, true)}</span>${r.src === 'strava' ? '<span>Strava</span>' : ''}${r.sess ? '<span>' + r.sess + '</span>' : ''}${r.rpe ? '<span>effort ' + r.rpe + '/10</span>' : ''}${r.hr ? '<span>' + Math.round(r.hr) + ' bpm</span>' : ''}${r.note ? '<span>' + esc(r.note) + '</span>' : ''}</div></div></div>`).join('') || '<div class="empty">Aucune sortie. Connecte Strava dans ⚙︎ ou ajoute un run.</div>'}</div>`;
  body.querySelectorAll('[data-wk]').forEach(b => b.addEventListener('click', () => { VIEW.runWeek = Number(b.dataset.wk); render(); }));
  body.querySelectorAll('[data-log]').forEach(b => b.addEventListener('click', () => { const ex = runs.find(r => r.sess === b.dataset.log); runSheet(ex, b.dataset.log); }));
  body.querySelector('[data-newrun]').addEventListener('click', () => runSheet());
  body.querySelectorAll('[data-run]').forEach(b => b.addEventListener('click', () => runSheet(get(b.dataset.run))));
  lineChart(body.querySelector('[data-chart-pace]'), { series: [{ name: 'allure', color: CH.blue, pts: last.map(r => ({ x: fmtDate(r.d), y: r.pace || r.min / r.km })) }], fmt: paceStr, ref: { y: 4, label: 'objectif 4:00' }, h: 170 });
  barChart(body.querySelector('[data-chart-km]'), { labels: weeksLab.map(w => 'S' + weekKey(w).slice(-2)), series: [{ name: 'km', color: CH.blue, vals: kmW }], fmt: v => r1(v), showVals: true, h: 150 });
  const estPts = last.map(r => ({ x: fmtDate(r.d), y: riegel5k(r) })).filter(p => p.y);
  lineChart(body.querySelector('[data-chart-est]'), { series: [{ name: 'estimation', color: CH.teal, pts: estPts }], fmt: minStr, ref: { y: 20, label: 'objectif 20:00' }, h: 170 });
}
function runSheet(r, sessId) {
  const isNew = !r; const prog = runProgram(); const sess = prog.flatMap(w => w.sessions).find(x => x.id === (sessId || (r && r.sess)));
  r = r || { id: uid('run'), t: 'run', d: today(), km: null, min: null, sess: sessId || null, test: !!(sess && sess.test), rpe: null, note: '', src: 'manual' };
  const sh = openSheet(isNew ? 'Run fait ✓' : 'Sortie · ' + fmtDate(r.d, true), `
    ${sess ? `<div class="notice">Séance : ${esc(sess.desc)} · allure visée ${paceStr(sess.pace)} / km</div>` : ''}
    ${r.src === 'strava' ? `<div class="small muted">Importé de Strava : ${esc(r.title || '')}${r.hr ? ' · ' + Math.round(r.hr) + ' bpm' : ''}</div>` : ''}
    <div class="grid3"><div><label class="f">Date</label><input class="in" type="date" data-d value="${r.d}"></div><div><label class="f">Distance (km)</label><input class="in num" type="number" step="0.01" inputmode="decimal" data-km value="${r.km ?? ''}"></div><div><label class="f">Temps (min)</label><input class="in num" type="number" step="0.1" inputmode="decimal" data-min value="${r.min ?? ''}" placeholder="ex. 27.5"></div></div>
    <label class="f">Effort ressenti</label>${scaleHtml('rpe', 10, r.rpe)}
    <label class="f">Séance du programme</label><select class="in" data-sess><option value="">Run libre</option>${prog.flatMap(w => w.sessions.map(s => `<option value="${s.id}" ${s.id === r.sess ? 'selected' : ''}>${s.id} · ${esc(s.desc)}</option>`)).join('')}</select>
    <label class="row mt" style="gap:8px"><input type="checkbox" data-test ${r.test ? 'checked' : ''}> <span>C'était un test 5 km à fond (recalcule les allures)</span></label>
    <label class="f">Ressenti / note</label><div class="row"><input class="in grow" data-note value="${esc(r.note || '')}" placeholder="jambes, souffle, météo…"><button class="mic" data-mic>🎙️</button></div>
    <div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Supprimer</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh); micButton('[data-note]', sh);
  sh.querySelector('[data-save]').addEventListener('click', () => { r.d = val(sh, '[data-d]') || today(); r.km = nval(sh, '[data-km]'); r.min = nval(sh, '[data-min]'); if (!r.km || !r.min) return toast('Distance et temps ?'); r.pace = r1(r.min / r.km * 100) / 100; r.pace = Math.round(r.min / r.km * 100) / 100; r.rpe = segVal(sh, 'rpe'); r.sess = val(sh, '[data-sess]') || null; r.test = sh.querySelector('[data-test]').checked; r.note = val(sh, '[data-note]'); put(r); sh.close(); render(); toast(r.km + ' km à ' + paceStr(r.pace) + '/km' + (r.test ? ' · estimation 5 km mise à jour' : '')); });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(r.id); sh.close(); render(); });
}

// ================= BOXE =================
function renderBoxe(body) {
  const hist = all('boxe').sort((a, b) => b.d.localeCompare(a.d)); const weeks = weekLabels(10);
  const kinds = ['anglaise', 'mma', 'autre'];
  body.innerHTML = `<div class="sec"><h2>Boxe</h2><button class="btn sm p" data-new>＋ Séance</button></div>
    <div class="card"><div class="card-h"><h3>Minutes par semaine</h3></div><div data-chart></div></div>
    <div class="card">${hist.slice(0, 15).map(b => `<div class="task" data-b="${b.id}" style="cursor:pointer"><div class="grow"><div class="title">${esc(KIND_L[b.kind] || b.kind)} · ${hm(b.min)}</div><div class="meta"><span>${fmtDate(b.d, true)}</span>${b.rpe ? '<span>intensité ' + b.rpe + '/10</span>' : ''}${b.note ? '<span>' + esc(b.note) + '</span>' : ''}</div></div></div>`).join('') || '<div class="empty">Aucune séance enregistrée</div>'}</div>`;
  body.querySelector('[data-new]').addEventListener('click', () => boxeSheet());
  body.querySelectorAll('[data-b]').forEach(x => x.addEventListener('click', () => boxeSheet(get(x.dataset.b))));
  barChart(body.querySelector('[data-chart]'), { labels: weeks.map(w => 'S' + weekKey(w).slice(-2)), series: kinds.map((k, i) => ({ name: KIND_L[k], color: [CH.rose, CH.violet, CH.muted][i], vals: weeks.map(w => sum(inRange('boxe', w, addDays(w, 6)).filter(b => b.kind === k).map(b => b.min))) })), fmt: v => Math.round(v) + ' min', h: 160 });
}
const KIND_L = { anglaise: 'Anglaise', mma: 'MMA', autre: 'Autre' };
function boxeSheet(b) {
  const isNew = !b; b = b || { id: uid('boxe'), t: 'boxe', d: today(), kind: 'anglaise', min: 60, rpe: null, note: '' };
  const sh = openSheet(isNew ? 'Boxe faite ✓' : 'Séance de boxe', `
    <div class="grid2"><div><label class="f">Date</label><input class="in" type="date" data-d value="${b.d}"></div><div><label class="f">Durée (min)</label><input class="in num" type="number" inputmode="numeric" data-min value="${b.min}"></div></div>
    <label class="f">Type</label>${segHtml('kind', [{ v: 'anglaise', l: 'Anglaise' }, { v: 'mma', l: 'MMA' }, { v: 'autre', l: 'Autre' }], b.kind)}
    <label class="f">Intensité</label>${scaleHtml('rpe', 10, b.rpe)}
    <label class="f">Note</label><input class="in" data-note value="${esc(b.note || '')}" placeholder="sparring, technique, cardio…">
    <div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Supprimer</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh);
  sh.querySelector('[data-save]').addEventListener('click', () => { b.d = val(sh, '[data-d]'); b.min = nval(sh, '[data-min]') || 0; b.kind = segVal(sh, 'kind'); b.rpe = segVal(sh, 'rpe'); b.note = val(sh, '[data-note]'); put(b); sh.close(); render(); toast('Boxe enregistrée 🥊'); });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(b.id); sh.close(); render(); });
}

// ================= MÉDITATION =================
function renderMedit(body) {
  const days = dayLabels(28); const byD = {}; all('medit').forEach(m => { byD[m.d] = (byD[m.d] || 0) + (m.min || 0); });
  let streak = 0; for (let i = 0; i < 365; i++) { const d = addDays(today(), -i); if (byD[d]) streak++; else if (i === 0) continue; else break; }
  body.innerHTML = `<div class="sec"><h2>Méditation</h2><button class="btn sm p" data-new>＋ Séance</button></div>
    <div class="kpis"><div class="kpi card" style="margin:0"><div class="v">${streak} j</div><div class="l">jours d'affilée</div></div><div class="kpi card" style="margin:0"><div class="v">${days.filter(d => byD[d]).length}/28</div><div class="l">jours médités</div></div><div class="kpi card" style="margin:0"><div class="v">${sum(days.map(d => byD[d] || 0))} min</div><div class="l">sur 4 semaines</div></div></div>
    <div class="card"><div class="card-h"><h3>Minutes par jour</h3><span class="small muted">Petit Bambou via Apple Santé + saisies</span></div><div data-chart></div></div>`;
  body.querySelector('[data-new]').addEventListener('click', () => meditSheet());
  barChart(body.querySelector('[data-chart]'), { labels: days.map(shortDay), series: [{ name: 'min', color: CH.teal, vals: days.map(d => byD[d] || 0) }], fmt: v => Math.round(v), h: 150 });
}
function meditSheet() {
  const sh = openSheet('Méditation faite ✓', `<label class="f">Durée</label><div class="chips">${[5, 10, 15, 20, 30].map(m => `<button class="chip" data-m="${m}">${m} min</button>`).join('')}</div><div class="row mt"><input class="in grow num" type="number" inputmode="numeric" data-min placeholder="min"><button class="btn p" data-ok>OK</button></div>`);
  const save = m => { if (!m) return toast('Durée ?'); put({ id: uid('medit'), t: 'medit', d: today(), min: m, src: 'manual' }); sh.close(); render(); toast('Méditation enregistrée 🧘'); };
  sh.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => save(Number(b.dataset.m))));
  sh.querySelector('[data-ok]').addEventListener('click', () => save(nval(sh, '[data-min]')));
}
