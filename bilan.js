/* Palier · onglet Bilan : bilan hebdo (objectifs + clients + stats), objectifs, journal du soir, idées. */
function renderBilan(root) {
  const sub = VIEW.bilan || 'semaine';
  root.innerHTML = `<div class="row between" style="margin-top:6px"><h1>Bilan</h1></div>
    <div class="seg mt" data-seg="sub">${[['semaine', '📅 Semaine'], ['objectifs', '🎯 Objectifs'], ['journal', '📓 Journal'], ['idees', '💡 Idées']].map(([v, l]) => `<button data-v="${v}" class="${sub === v ? 'on' : ''}">${l}</button>`).join('')}</div><div id="bilan-body"></div>`;
  wireSegs(root); root.querySelector('[data-seg="sub"]').addEventListener('change', () => { VIEW.bilan = segVal(root, 'sub'); render(); });
  const body = root.querySelector('#bilan-body');
  if (sub === 'semaine') renderWeekly(body); else if (sub === 'objectifs') renderGoals(body); else if (sub === 'journal') renderJournal(body); else renderIdeas(body);
}

// ---------- bilan hebdo ----------
function renderWeekly(body) {
  const mon = VIEW.weekMon || monday(); const sun = addDays(mon, 6); const wkey = weekKey(mon);
  const w = get('weekly-' + wkey) || { id: 'weekly-' + wkey, t: 'weekly', d: mon, week: wkey, clients: {}, wins: '', lessons: '', focus: '', goals: {} };
  const st = weekStats(mon), prev = weekStats(addDays(mon, -7));
  const tasksByClient = {}; all('task').forEach(t => { if (t.done && (t.done_at || '').slice(0, 10) >= mon && (t.done_at || '').slice(0, 10) <= sun) tasksByClient[t.client] = (tasksByClient[t.client] || 0) + 1; });
  const goals = all('goal').filter(g => g.status === 'actif');
  const d = (a, b, unit) => a != null && b != null && Math.abs(a - b) >= 0.05 ? ` <span class="delta ${a >= b ? 'up' : 'down'}">${a > b ? '+' : ''}${r1(a - b)}${unit}</span>` : '';
  body.innerHTML = `
    <div class="week-nav mt"><button class="btn sm" data-wk="${addDays(mon, -7)}">←</button><div class="center"><b>Semaine ${wkey.slice(-3)}</b><div class="small muted">${fmtDate(mon)} → ${fmtDate(sun)}${w.done_at ? ' · bilan fait ✓' : ''}</div></div><button class="btn sm" data-wk="${addDays(mon, 7)}" ${mon >= monday() ? 'disabled' : ''}>→</button></div>
    <div class="card">
      <div class="card-h"><h2>Chiffres de la semaine</h2></div>
      <div class="kpis">
        <div class="kpi"><div class="v">${st.tasks}</div><div class="l">tâches faites${d(st.tasks, prev.tasks, '')}</div></div>
        <div class="kpi"><div class="v">${r1(st.hours)} h</div><div class="l">travail (${r1(st.hoursLib)} h liberté)${d(st.hours, prev.hours, ' h')}</div></div>
        <div class="kpi"><div class="v">${st.workouts + st.runs + st.boxe}</div><div class="l">séances · ${st.workouts} muscu, ${st.runs} run, ${st.boxe} boxe</div></div>
        <div class="kpi"><div class="v">${Math.round(st.tonnage / 100) / 10} t</div><div class="l">tonnage${d(st.tonnage / 1000, prev.tonnage / 1000, ' t')}</div></div>
        <div class="kpi"><div class="v">${st.km} km</div><div class="l">course${d(st.km, prev.km, ' km')}</div></div>
        <div class="kpi"><div class="v">${st.medit}/7</div><div class="l">jours médités</div></div>
        <div class="kpi"><div class="v">${st.sleep != null ? hm(st.sleep * 60) : '–'}</div><div class="l">sommeil moyen</div></div>
        <div class="kpi"><div class="v">${st.energy != null ? r1(st.energy) : '–'}</div><div class="l">énergie /10${d(st.energy, prev.energy, '')}</div></div>
        <div class="kpi"><div class="v">${st.kcal != null ? Math.round(st.kcal) : '–'}</div><div class="l">kcal/j · ${st.prot != null ? Math.round(st.prot) + ' g prot' : ''}</div></div>
        <div class="kpi"><div class="v">${st.weight != null ? r1(st.weight) + ' kg' : '–'}</div><div class="l">poids moyen${d(st.weight, prev.weight, ' kg')}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-h"><h2>🎯 Objectifs</h2><button class="btn sm" data-goto="objectifs">Gérer</button></div>
      ${goals.map(g => { const p = goalProgress(g); const rev = (w.goals || {})[g.id] || ''; return `<div class="goal"><div class="row between"><div class="grow"><div class="cat">${esc(g.cat)}</div><b>${esc(g.title)}</b>${g.target ? ' <span class="small muted">' + esc(g.target) + '</span>' : ''}</div>${p ? `<span class="chip ${p.ok ? 'chip-acc' : 'chip-amber'}">${p.cur}/${p.n}${p.max ? ' max' : ''}</span>` : ''}</div>${p ? `<div class="bar mt" style="height:6px"><i style="width:${p.pct}%" class="${p.ok ? '' : 'amber'}"></i></div>` : ''}<div class="seg mt" data-seg="g-${g.id}">${[['keep', 'Je garde'], ['adjust', 'J\'ajuste'], ['done', 'Atteint ✓'], ['drop', 'J\'abandonne']].map(([v, l]) => `<button data-v="${v}" class="${rev === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`; }).join('') || '<div class="empty">Aucun objectif actif. Fixe-les dans l\'onglet Objectifs.</div>'}
    </div>
    <div class="sec"><h2>Clients : goulots & plan</h2><span class="small muted">une carte par client</span></div>
    ${clients().filter(c => c.kind !== 'perso').map(c => { const cw = (w.clients || {})[c.id] || {}; const bn = cw.bottlenecks || c.bottlenecks || []; const hrs = r1(workMinutesClient(c.id, mon, sun) / 60); const open = all('task').filter(t => !t.done && t.client === c.id).length; return `<div class="card" data-cw="${c.id}">
      <div class="row"><span class="avatar" style="background:${c.color};width:32px;height:32px;font-size:12px">${esc(c.letter || '')}</span><div class="grow"><b>${esc(c.name)}</b><div class="small muted">${tasksByClient[c.id] || 0} faites · ${open} ouvertes · ${hrs} h</div></div></div>
      <label class="f">Goulots (max 3)</label>${[0, 1, 2].map(i => `<input class="in mb" data-bn="${i}" placeholder="${i + 1}." value="${esc(bn[i] || '')}">`).join('')}
      <label class="f">Actions de la semaine prochaine (une par ligne → to-do)</label><textarea class="in" data-actions placeholder="action 1&#10;action 2&#10;action 3">${esc((cw.actions || []).join('\n'))}</textarea>
    </div>`; }).join('')}
    <div class="card">
      <div class="card-h"><h2>Et moi</h2></div>
      <label class="f">Victoires de la semaine</label><textarea class="in" data-wins>${esc(w.wins || '')}</textarea>
      <label class="f">Leçons</label><textarea class="in" data-lessons>${esc(w.lessons || '')}</textarea>
      <label class="f">Focus n°1 de la semaine prochaine</label><input class="in" data-focus value="${esc(w.focus || '')}">
      <label class="f">Temps pour ma liberté future : ${r1(st.hoursLib)} h sur ${r1(st.hours)} h. Je suis satisfait ?</label>${segHtml('libok', [{ v: 'oui', l: 'Oui' }, { v: 'moyen', l: 'Moyen' }, { v: 'non', l: 'Non' }], w.libok)}
    </div>
    <button class="btn p wide mt" data-save>Enregistrer le bilan${mon >= monday() ? ' + créer les to-do' : ''}</button><div style="height:30px"></div>`;
  wireSegs(body);
  body.querySelectorAll('[data-wk]').forEach(b => b.addEventListener('click', () => { VIEW.weekMon = b.dataset.wk; render(); }));
  body.querySelector('[data-goto]').addEventListener('click', () => { VIEW.bilan = 'objectifs'; render(); });
  body.querySelector('[data-save]').addEventListener('click', () => {
    w.clients = w.clients || {}; w.goals = {};
    goals.forEach(g => { const v = segVal(body, 'g-' + g.id); if (v) { w.goals[g.id] = v; if (v === 'done') { g.status = 'atteint'; g.done_at = today(); put(g); } if (v === 'drop') { g.status = 'abandonne'; put(g); } } });
    let created = 0;
    body.querySelectorAll('[data-cw]').forEach(box => {
      const id = box.dataset.cw, c = get(id); const bn = [0, 1, 2].map(i => val(box, `[data-bn="${i}"]`)); const actions = val(box, '[data-actions]').split('\n').map(x => x.trim()).filter(Boolean);
      const prevActions = (w.clients[id] && w.clients[id].actions) || [];
      w.clients[id] = { bottlenecks: bn, actions };
      if (c) { c.bottlenecks = bn; c.plan = actions.join('\n'); put(c); }
      actions.forEach(a => { if (!prevActions.includes(a) && !all('task').some(t => t.title === a && t.client === id && !t.done)) { put({ id: uid('task'), t: 'task', d: today(), title: a, client: id, imp: 3, urg: 2, today: null, due: addDays(monday(), mon >= monday() ? 13 : 6), done: false, src: 'weekly' }); created++; } });
    });
    w.wins = val(body, '[data-wins]'); w.lessons = val(body, '[data-lessons]'); w.focus = val(body, '[data-focus]'); w.libok = segVal(body, 'libok'); w.done_at = new Date().toISOString();
    put(w); render(); toast('Bilan enregistré' + (created ? ' · ' + created + ' action(s) ajoutée(s) aux to-do' : ''));
  });
}

// ---------- objectifs ----------
function renderGoals(body) {
  const goals = all('goal'); const active = goals.filter(g => g.status === 'actif'), done = goals.filter(g => g.status !== 'actif');
  body.innerHTML = `<div class="sec"><h2>Objectifs par catégorie</h2><button class="btn sm p" data-new>＋ Objectif</button></div>
    ${GOAL_CATS.map(cat => { const gs = active.filter(g => g.cat === cat); if (!gs.length) return ''; return `<div class="card"><div class="cat">${esc(cat)}</div>${gs.map(g => { const p = goalProgress(g); return `<div class="goal" data-g="${g.id}" style="cursor:pointer"><div class="row between"><div class="grow"><b>${esc(g.title)}</b>${g.target ? ' <span class="small muted">' + esc(g.target) + '</span>' : ''}${g.note ? '<div class="small muted">' + esc(g.note) + '</div>' : ''}</div>${p ? `<span class="chip ${p.ok ? 'chip-acc' : 'chip-amber'}">${p.cur}/${p.n}${p.max ? ' max' : ''}</span>` : ''}</div>${p ? `<div class="bar mt" style="height:6px"><i style="width:${p.pct}%" class="${p.ok ? '' : 'amber'}"></i></div>` : ''}</div>`; }).join('')}</div>`; }).join('') || '<div class="empty">Aucun objectif</div>'}
    ${done.length ? `<details class="card"><summary style="cursor:pointer;font-weight:800">Atteints / abandonnés (${done.length})</summary>${done.map(g => `<div class="goal" data-g="${g.id}"><span class="cat">${esc(g.cat)}</span> ${g.status === 'atteint' ? '✅' : '✖︎'} ${esc(g.title)}</div>`).join('')}</details>` : ''}`;
  body.querySelector('[data-new]').addEventListener('click', () => goalSheet());
  body.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => goalSheet(get(b.dataset.g))));
}
function goalSheet(g) {
  const isNew = !g; g = g || { id: uid('goal'), t: 'goal', d: today(), cat: 'Business', title: '', target: '', note: '', status: 'actif', metric: null };
  const m = g.metric || {};
  const sh = openSheet(isNew ? 'Nouvel objectif' : 'Objectif', `
    <label class="f">Catégorie</label>${chipsHtml('cat', GOAL_CATS.map(c => ({ v: c, l: c })), g.cat)}
    <label class="f">Objectif</label><div class="row"><input class="in grow" data-title value="${esc(g.title)}" placeholder="ex. Signer 2 clients Relation argent"><button class="mic" data-mic>🎙️</button></div>
    <label class="f">Cible / échéance (texte libre)</label><input class="in" data-target value="${esc(g.target || '')}" placeholder="ex. d'ici fin octobre">
    <label class="f">Suivi automatique hebdo (facultatif)</label>${segHtml('of', [{ v: '', l: 'Aucun' }, { v: 'workout', l: 'Muscu' }, { v: 'run', l: 'Runs' }, { v: 'boxe', l: 'Boxe' }, { v: 'medit', l: 'Médit.' }], m.of && ['workout', 'run', 'boxe', 'medit'].includes(m.of) ? m.of : (m.of ? 'x' : ''))}
    ${segHtml('of2', [{ v: 'task', l: 'Tâches faites' }, { v: 'hours', l: 'Heures max' }, { v: 'hours_liberte', l: 'Heures liberté' }], ['task', 'hours', 'hours_liberte'].includes(m.of) ? m.of : null)}
    <label class="f">Nombre par semaine</label><input class="in num" type="number" inputmode="numeric" data-n value="${m.n ?? ''}">
    <label class="f">Note</label><textarea class="in" data-note>${esc(g.note || '')}</textarea>
    <label class="f">Statut</label>${segHtml('status', [{ v: 'actif', l: 'Actif' }, { v: 'atteint', l: 'Atteint' }, { v: 'abandonne', l: 'Abandonné' }], g.status)}
    <div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Supprimer</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh); micButton('[data-title]', sh);
  sh.querySelector('[data-seg="of"]').addEventListener('change', () => { sh.querySelectorAll('[data-seg="of2"] button').forEach(b => b.classList.remove('on')); });
  sh.querySelector('[data-seg="of2"]').addEventListener('change', () => { sh.querySelectorAll('[data-seg="of"] button').forEach(b => b.classList.remove('on')); });
  sh.querySelector('[data-save]').addEventListener('click', () => {
    g.cat = segVal(sh, 'cat') || 'Business'; g.title = val(sh, '[data-title]'); if (!g.title) return toast('Titre ?'); g.target = val(sh, '[data-target]'); g.note = val(sh, '[data-note]'); g.status = segVal(sh, 'status');
    const of = segVal(sh, 'of2') || segVal(sh, 'of'); const n = nval(sh, '[data-n]');
    g.metric = of && of !== 'x' && n ? { of, n, max: of === 'hours' } : null;
    put(g); sh.close(); render();
  });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(g.id); sh.close(); render(); });
}

// ---------- journal ----------
function renderJournal(body) {
  const eves = all('evening').sort((a, b) => b.d.localeCompare(a.d)).slice(0, 30);
  body.innerHTML = `<div class="sec"><h2>Journal du soir</h2><button class="btn sm p" data-new>Bilan de ce soir</button></div>
    ${eves.map(e => `<div class="card" data-e="${e.d}" style="cursor:pointer"><div class="row between"><b>${esc(fmtLong(e.d))}</b><span class="small muted">énergie ${e.energy ?? '–'}/10 ${['', '😞', '😐', '🙂', '😄', '🔥'][e.mood] || ''}</span></div>
      ${e.win ? `<div class="mt small">🏆 ${esc(e.win)}</div>` : ''}${e.learn ? `<div class="small">📚 ${esc(e.learn)}</div>` : ''}${e.gratitude ? `<div class="small muted">🙏 ${esc(e.gratitude).replace(/\n/g, ' · ')}</div>` : ''}${e.reflect ? `<div class="small muted">💭 ${esc(e.reflect)}</div>` : ''}${e.tomorrow ? `<div class="small">➡️ ${esc(e.tomorrow)}</div>` : ''}</div>`).join('') || '<div class="empty">Aucun bilan pour le moment. Le premier se fait ce soir 🌙</div>'}`;
  body.querySelector('[data-new]').addEventListener('click', () => eveningSheet());
  body.querySelectorAll('[data-e]').forEach(b => b.addEventListener('click', () => eveningSheet(b.dataset.e)));
}

// ---------- idées ----------
function renderIdeas(body) {
  const ideas = all('idea').sort((a, b) => (b.u || 0) - (a.u || 0));
  body.innerHTML = `<div class="sec"><h2>Boîte à idées</h2><button class="btn sm p" data-new>＋ Idée</button></div>
    <div class="card">${ideas.map(i => `<div class="task" data-i="${i.id}"><div class="grow" style="cursor:pointer" data-edit><div class="title">${esc(i.text)}</div><div class="meta"><span>${clientDot(i.client || 'client-perso')}</span><span>${fmtDate(i.d)}</span></div></div><button class="btn sm" data-totask title="Transformer en tâche">→ tâche</button></div>`).join('') || '<div class="empty">Vide. Note tout ce qui te passe par la tête, tu tries au bilan hebdo.</div>'}</div>`;
  body.querySelector('[data-new]').addEventListener('click', () => ideaSheet());
  body.querySelectorAll('[data-i]').forEach(row => { const i = get(row.dataset.i); row.querySelector('[data-edit]').addEventListener('click', () => ideaSheet(i)); row.querySelector('[data-totask]').addEventListener('click', () => { taskSheet(null, { title: i.text, client: i.client || 'client-perso', today: null }); remove(i.id); }); });
}
function ideaSheet(i) {
  const isNew = !i; i = i || { id: uid('idea'), t: 'idea', d: today(), text: '', client: 'client-perso' };
  const sh = openSheet(isNew ? '💡 Nouvelle idée' : 'Idée', `<div class="row"><textarea class="in grow" data-text placeholder="L'idée…">${esc(i.text)}</textarea><button class="mic" data-mic>🎙️</button></div><label class="f">Pour</label>${clientChips('client', i.client, true)}<div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Supprimer</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh); micButton('[data-text]', sh);
  sh.querySelector('[data-save]').addEventListener('click', () => { i.text = val(sh, '[data-text]'); if (!i.text) return toast('Vide'); i.client = segVal(sh, 'client'); put(i); sh.close(); render(); toast('Idée notée 💡'); });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(i.id); sh.close(); render(); });
  setTimeout(() => sh.querySelector('[data-text]').focus(), 150);
}
