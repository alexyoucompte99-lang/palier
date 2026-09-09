/* Palier · onglet Aujourd'hui : ce qu'il reste à remplir + to-do du jour + chrono. */
function renderToday(root) {
  const d = today(), s = settings();
  const morning = get('morning-' + d), evening = get('evening-' + d);
  const meals = byDate('meal', d), kcal = sum(meals.map(m => m.kcal)), prot = sum(meals.map(m => m.prot));
  const slots = [['pdj', 'Petit-déj'], ['dej', 'Déjeuner'], ['din', 'Dîner'], ['snack', 'Snack']];
  const mealBy = {}; meals.forEach(m => { mealBy[m.slot] = (mealBy[m.slot] || 0) + (m.kcal || 0); });
  const wo = byDate('workout', d).filter(w => w.status !== 'live'), live = all('workout').find(w => w.status === 'live');
  const runs = byDate('run', d), box = byDate('boxe', d), med = byDate('medit', d);
  const hour = new Date().getHours();
  const tasks = all('task').filter(t => !t.done && t.today && t.today <= d);
  const doneToday = all('task').filter(t => t.done && (t.done_at || '').slice(0, 10) === d);
  const late = tasks.filter(t => t.today < d), todays = sortTasks(tasks.filter(t => t.today === d));
  const tmr = all('task').filter(t => !t.done && t.today === tomorrow()).length;
  const backlog = sortTasks(all('task').filter(t => !t.done && !t.today));
  const chrono = get('chrono') ;
  const mon = monday(), wk = weekStats(mon);
  const sleepTxt = morning ? ((morning.sleep_h ?? morning.sleep_h_auto) != null ? hm((morning.sleep_h ?? morning.sleep_h_auto) * 60) + (morning.sleep_q != null ? ' · ' + morning.sleep_q + ' %' : '') : 'saisi') : '';
  const sportTxt = [wo.length ? 'Muscu ' + Math.round(wo[0].tonnage / 1000 * 10) / 10 + ' t' : null, runs.length ? 'Run ' + r1(sum(runs.map(r => r.km))) + ' km' : null, box.length ? 'Boxe ' + hm(sum(box.map(b => b.min))) : null, med.length ? 'Médit ' + sum(med.map(m => m.min)) + ' min' : null].filter(Boolean).join(' · ');

  root.innerHTML = `
  <div class="row between" style="margin-top:6px">
    <div><h1>${esc(fmtLong(d))}</h1><div class="muted small">Semaine ${esc(weekKey(d).slice(-3))} · ${r1(wk.hours)} h travaillées / ${s.hours_week} h · ${wk.hoursLib ? r1(wk.hoursLib) + ' h liberté' : 'liberté 0 h'}</div></div>
  </div>

  <div class="sec"><h2>À remplir</h2><span class="muted small">${esc(sportTxt)}</span></div>
  <div class="grid2">
    <button class="tile ${morning ? 'done' : (hour < 12 ? 'hot' : '')}" data-open="morning"><span class="t">☀️ Matin</span><span class="s">${morning ? esc(sleepTxt) + (morning.weight ? ' · ' + morning.weight + ' kg' : '') : 'Sommeil, poids, écran, ressenti'}</span></button>
    <button class="tile ${evening ? 'done' : (hour >= 19 ? 'hot' : '')}" data-open="evening"><span class="t">🌙 Bilan du soir</span><span class="s">${evening ? 'Énergie ' + evening.energy + '/10 · action de demain posée' : 'Gratitude, énergie, action de demain'}</span></button>
  </div>
  <div class="card" style="padding:12px 14px">
    <div class="row between"><h3>🍽️ Repas</h3><span class="small muted">${kcal} / ${s.kcal} kcal · ${prot} / ${s.prot} g prot</span></div>
    <div class="bar mt" style="height:8px"><i style="width:${Math.min(100, kcal / s.kcal * 100)}%" class="${kcal > s.kcal * 1.1 ? 'amber' : ''}"></i></div>
    <div class="bar" style="height:8px;margin-top:4px"><i class="blue" style="width:${Math.min(100, prot / s.prot * 100)}%"></i></div>
    <div class="grid4 mt">${slots.map(([k, l]) => `<button class="tile ${mealBy[k] ? 'done' : ''}" style="min-height:58px;padding:9px 8px" data-meal="${k}"><span class="t" style="font-size:12.5px">${l}</span><span class="s">${mealBy[k] ? mealBy[k] + ' kcal' : '+'}</span></button>`).join('')}</div>
  </div>
  <div class="card" style="padding:12px 14px">
    <div class="row between"><h3>🏋️ Sport</h3><span class="small muted">${sportDays(mon)}/3 jours cette semaine</span></div>
    <div class="grid4 mt">
      <button class="tile ${wo.length ? 'done' : ''} ${live ? 'hot' : ''}" style="min-height:58px;padding:9px 8px" data-open="workout"><span class="t" style="font-size:12.5px">Muscu</span><span class="s">${live ? 'En cours…' : wo.length ? Math.round(wo[0].tonnage / 100) / 10 + ' t' : '+'}</span></button>
      <button class="tile ${runs.length ? 'done' : ''}" style="min-height:58px;padding:9px 8px" data-open="run"><span class="t" style="font-size:12.5px">Run</span><span class="s">${runs.length ? r1(sum(runs.map(r => r.km))) + ' km' : '+'}</span></button>
      <button class="tile ${box.length ? 'done' : ''}" style="min-height:58px;padding:9px 8px" data-open="boxe"><span class="t" style="font-size:12.5px">Boxe</span><span class="s">${box.length ? hm(sum(box.map(b => b.min))) : '+'}</span></button>
      <button class="tile ${med.length ? 'done' : ''}" style="min-height:58px;padding:9px 8px" data-open="medit"><span class="t" style="font-size:12.5px">Médit.</span><span class="s">${med.length ? sum(med.map(m => m.min)) + ' min' : '+'}</span></button>
    </div>
  </div>

  <div class="card ${chrono ? 'acc' : ''}" style="padding:12px 14px" id="chrono-card">
    ${chrono ? `<div class="row between"><div><div class="small muted">Chrono · ${esc(client(chrono.client).name)}</div><div class="big timer" id="chrono-t">0:00</div></div><button class="btn" style="background:#fff;color:var(--acc);border-color:#fff" data-chrono-stop>■ Stop</button></div>`
      : `<div class="row between"><div><h3>⏱️ Chrono de travail</h3><div class="small muted">Lance-le quand tu bosses pour un client, ça alimente les 30 h.</div></div><button class="btn sm" data-chrono-start>▶ Démarrer</button></div>`}
  </div>

  <div class="sec"><h2>To-do du jour</h2><span class="muted small">${doneToday.length} faite${doneToday.length > 1 ? 's' : ''}${tmr ? ' · demain : ' + tmr : ''}</span></div>
  <div class="card" id="todo">
    ${late.length ? `<div class="notice">⏰ ${late.length} tâche${late.length > 1 ? 's' : ''} en retard : elle${late.length > 1 ? 's' : ''} reste${late.length > 1 ? 'nt' : ''} ici jusqu'à ce que tu la coches ou la replanifies.</div>` : ''}
    ${(late.concat(todays)).map(taskRow).join('') || '<div class="empty">Rien de prévu. Ajoute une tâche ou pioche dans les clients.</div>'}
    ${doneToday.length ? `<details class="mt"><summary class="small muted" style="cursor:pointer">Faites aujourd'hui (${doneToday.length})</summary>${doneToday.map(taskRow).join('')}</details>` : ''}
  </div>
  ${backlog.length ? `<div class="sec"><h2>À planifier</h2><span class="muted small">${backlog.length} en attente · par priorité</span></div>
  <div class="card">${backlog.slice(0, 5).map(t => `<div class="task" data-task="${t.id}"><button class="btn sm p" data-plan title="Mettre dans la to-do du jour">→ Auj.</button><div class="grow" data-edit><div class="title">${esc(t.title)}</div><div class="meta"><span>${clientDot(t.client)}</span><span class="prio q${quadrant(t)}">${QLABEL[quadrant(t)]}</span>${t.due ? `<span>échéance ${fmtDate(t.due)}</span>` : ''}</div></div></div>`).join('')}</div>` : ''}
  <button class="fab" data-newtask>＋ Nouvelle tâche</button>
  <div style="height:40px"></div>`;

  root.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.open)));
  root.querySelectorAll('[data-meal]').forEach(b => b.addEventListener('click', () => mealSheet(b.dataset.meal)));
  root.querySelector('[data-newtask]').addEventListener('click', () => taskSheet());
  wireTasks(root);
  const cs = root.querySelector('[data-chrono-start]'); if (cs) cs.addEventListener('click', chronoStart);
  const ce = root.querySelector('[data-chrono-stop]'); if (ce) ce.addEventListener('click', chronoStop);
  tickChrono();
}

function openForm(kind) {
  if (kind === 'morning') return morningSheet();
  if (kind === 'evening') return eveningSheet();
  if (kind === 'workout') return workoutEntry();
  if (kind === 'run') return runSheet();
  if (kind === 'boxe') return boxeSheet();
  if (kind === 'medit') return meditSheet();
}

// ---------- tâches ----------
function taskRow(t) {
  const c = client(t.client), q = quadrant(t);
  return `<div class="task ${t.done ? 'done' : ''}" data-task="${t.id}">
    <button class="cb" data-check>${t.done ? '✓' : ''}</button>
    <div class="grow" data-edit>
      <div class="title">${esc(t.title)}</div>
      <div class="meta"><span>${clientDot(t.client)}</span><span class="prio q${q}">${'★'.repeat(t.imp || 2)} ${'🔥'.repeat(t.urg || 2)}</span>${t.today && t.today < today() && !t.done ? `<span class="chip-red" style="padding:0 6px;border-radius:6px">${fmtDate(t.today)}</span>` : ''}${t.est ? `<span>~${t.est} min</span>` : ''}${t.done && t.mins ? `<span>${t.mins} min</span>` : ''}${t.src === 'eve' ? '<span>🌙 action du bilan</span>' : ''}${t.src === 'weekly' ? '<span>📅 plan hebdo</span>' : ''}${t.src === 'selfty' ? (t.prep ? ((t.prep_sent || '') === t.prep ? '<span class="chip-green" style="padding:0 6px;border-radius:6px">✓ infos envoyées à la console</span>' : '<span class="chip-red" style="padding:0 6px;border-radius:6px">infos en attente d\'envoi</span>') : '<span class="chip-red" style="padding:0 6px;border-radius:6px">✍️ infos du call à remplir</span>') : ''}</div>
    </div>
  </div>`;
}
function wireTasks(root) {
  root.querySelectorAll('[data-task]').forEach(row => {
    const t = get(row.dataset.task); if (!t) return;
    const pl = row.querySelector('[data-plan]'); if (pl) pl.addEventListener('click', () => { t.today = today(); put(t); render(); toast('Ajoutée à aujourd\'hui'); });
    const cb = row.querySelector('[data-check]'); if (cb) cb.addEventListener('click', () => toggleTask(t));
    row.querySelector('[data-edit]').addEventListener('click', () => taskSheet(t));
  });
}
function toggleTask(t) {
  if (t.done) { t.done = false; t.done_at = null; t.mins = null; put(t); render(); return; }
  t.done = true; t.done_at = new Date().toISOString(); t.in_chrono = !!get('chrono');
  put(t); render();
  // temps passé (facultatif)
  const sh = openSheet('Bravo ✓ combien de temps ?', `<div class="muted small">${esc(t.title)}</div><div class="chips mt" data-mins>${[5, 15, 30, 45, 60, 90, 120].map(m => `<button class="chip" data-m="${m}">${m} min</button>`).join('')}</div><div class="row mt"><input class="in grow" type="number" inputmode="numeric" placeholder="autre (min)" data-other><button class="btn p" data-ok>OK</button></div><button class="btn ghost wide mt" data-skip>Passer</button>`);
  const save = m => { if (m) { t.mins = m; put(t); } sh.close(); render(); };
  sh.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => save(Number(b.dataset.m))));
  sh.querySelector('[data-ok]').addEventListener('click', () => save(nval(sh, '[data-other]')));
  sh.querySelector('[data-skip]').addEventListener('click', () => save(null));
}
function taskSheet(t, preset) {
  const isNew = !t; t = t || Object.assign({ id: uid('task'), t: 'task', d: today(), title: '', client: 'client-perso', imp: 2, urg: 2, today: today(), done: false, src: 'manual' }, preset || {});
  const when = t.today === today() ? 'today' : t.today === tomorrow() ? 'tmr' : t.today ? 'date' : 'backlog';
  const sh = openSheet(isNew ? 'Nouvelle tâche' : (t.src === 'selfty' ? 'Call Anaïs · appeler le lead' : 'Tâche'), `
    ${t.call ? leadCard(t) : ''}
    <div class="row"><input class="in grow" data-title placeholder="Quoi ?" value="${esc(t.title)}" autofocus><button class="mic" data-mic title="Dicter">🎙️</button></div>
    <label class="f">Pour qui</label>${clientChips('client', t.client, true)}
    <div class="grid2">
      <div><label class="f">Importance</label>${segHtml('imp', [{ v: 1, l: '★' }, { v: 2, l: '★★' }, { v: 3, l: '★★★' }], t.imp)}</div>
      <div><label class="f">Urgence</label>${segHtml('urg', [{ v: 1, l: '🔥' }, { v: 2, l: '🔥🔥' }, { v: 3, l: '🔥🔥🔥' }], t.urg)}</div>
    </div>
    <div class="small muted mt" data-quad></div>
    <label class="f">Quand</label>${segHtml('when', [{ v: 'today', l: "Aujourd'hui" }, { v: 'tmr', l: 'Demain' }, { v: 'date', l: 'Date' }, { v: 'backlog', l: 'Plus tard' }], when)}
    <input class="in mt" type="date" data-date value="${esc(t.today && when === 'date' ? t.today : '')}" style="display:${when === 'date' ? 'block' : 'none'}">
    <div class="grid2"><div><label class="f">Estimation (min, facultatif)</label><input class="in" type="number" inputmode="numeric" data-est value="${t.est || ''}"></div><div><label class="f">Échéance (facultatif)</label><input class="in" type="date" data-due value="${esc(t.due || '')}"></div></div>
    <label class="f">Note</label><textarea class="in" data-note>${esc(t.note || '')}</textarea>
    <div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Supprimer</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh); micButton('[data-title]', sh); if (t.call) micButton('[data-prep]', sh, '[data-mic-prep]');
  const quad = () => { const q = quadrant({ imp: segVal(sh, 'imp'), urg: segVal(sh, 'urg') }); sh.querySelector('[data-quad]').innerHTML = `<span class="prio q${q}">${QLABEL[q]}</span> ${q === 3 ? '→ pense à Cynthia ou Maximilien' : q === 4 ? '→ vraiment nécessaire ?' : q === 2 ? '→ bloque un créneau' : ''}`; };
  quad(); sh.addEventListener('change', e => { quad(); const w = segVal(sh, 'when'); sh.querySelector('[data-date]').style.display = w === 'date' ? 'block' : 'none'; });
  sh.querySelector('[data-save]').addEventListener('click', () => {
    const title = val(sh, '[data-title]'); if (!title) { toast('Il manque le titre'); return; }
    t.title = title; t.client = segVal(sh, 'client') || 'client-perso'; t.imp = segVal(sh, 'imp'); t.urg = segVal(sh, 'urg');
    const w = segVal(sh, 'when'); t.today = w === 'today' ? today() : w === 'tmr' ? tomorrow() : w === 'date' ? (val(sh, '[data-date]') || null) : null;
    t.est = nval(sh, '[data-est]'); t.due = val(sh, '[data-due]') || null; t.note = val(sh, '[data-note]');
    const prepEl = sh.querySelector('[data-prep]'); if (prepEl) t.prep = prepEl.value.trim();
    put(t); sh.close(); render(); toast(isNew ? 'Tâche ajoutée' : (prepEl && t.prep && t.prep !== t.prep_sent ? 'Infos envoyées à la console Selfty 📤' : 'Tâche mise à jour'));
  });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(t.id); sh.close(); render(); });
  setTimeout(() => { const i = sh.querySelector('[data-title]'); if (isNew && i) i.focus(); }, 150);
}

// ---------- lead d'un call Anaïs (Selfty · iClosed) ----------
function leadCard(t) {
  const c = t.call || {}, d = c.utc ? new Date(c.utc) : null;
  const quand = d ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).replace(':', 'h') : '?';
  const sent = t.prep && (t.prep_sent || '') === t.prep;
  return `<div class="card" style="margin-top:0;background:var(--amber-soft)">
    <div class="row between"><div><div class="title" style="font-weight:700;font-size:17px">${esc(c.n || '?')}</div><div class="small muted">Call avec Anaïs · ${esc(quand)}${c.closer ? ' · closer ' + esc(c.closer) : ''}</div></div><span class="small muted">${esc(c.event || 'iClosed')}</span></div>
    <div class="row wrap mt" style="gap:8px">
      ${c.tel ? `<a class="btn sm p" href="tel:+${esc(c.tel)}">📞 +${esc(c.tel)}</a><a class="btn sm" href="https://wa.me/${esc(c.tel)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : '<span class="small muted">Pas de numéro dans iClosed</span>'}
      ${c.mail ? `<a class="btn sm ghost" href="mailto:${esc(c.mail)}">✉️ ${esc(c.mail)}</a>` : ''}
      ${c.link ? `<a class="btn sm ghost" href="${esc(c.link)}" target="_blank" rel="noopener">🎥 Lien visio</a>` : ''}
    </div>
    ${(c.quest || []).length || c.notes ? `<details class="mt"><summary class="small" style="cursor:pointer;font-weight:600">Ses réponses au questionnaire iClosed (${(c.quest || []).length})</summary>${(c.quest || []).map(([q, a]) => `<div class="small mt"><b>${esc(q)}</b><br>${esc(a)}</div>`).join('')}${c.notes ? `<div class="small mt"><b>Notes iClosed</b><br>${esc(c.notes)}</div>` : ''}</details>` : '<div class="small muted mt">Pas de réponses au questionnaire.</div>'}
    <label class="f">Mes infos pour le call d'Anaïs (envoyées dans la console Selfty à l'enregistrement)</label>
    <div class="row"><textarea class="in grow" data-prep rows="4" placeholder="Situation, motivation, objections, budget, ce qu'il faut savoir avant le call…">${esc(t.prep || '')}</textarea><button class="mic" data-mic-prep title="Dicter">🎙️</button></div>
    <div class="small ${sent ? '' : 'muted'}" style="margin-top:4px">${t.prep ? (sent ? '✓ Envoyées à la console Selfty' + (t.prep_sent_at ? ' le ' + new Date(t.prep_sent_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') : '⏳ En attente d\'envoi (synchro)') : 'Rien d\'envoyé pour l\'instant.'}</div>
  </div>`;
}

// ---------- chrono ----------
function chronoStart() {
  const sh = openSheet('Chrono : pour qui ?', `${clientChips('client', 'client-relation-argent', true)}<div class="sheet-actions"><button class="btn p wide" data-go>▶ Démarrer</button></div>`);
  wireSegs(sh);
  sh.querySelector('[data-go]').addEventListener('click', () => { put({ id: 'chrono', t: 'chrono', client: segVal(sh, 'client'), start: Date.now() }); sh.close(); render(); });
}
function chronoStop() {
  const c = get('chrono'); if (!c) return;
  const min = Math.round((Date.now() - c.start) / 60000);
  remove('chrono');
  if (min >= 1) { put({ id: uid('work'), t: 'work', d: today(), client: c.client, start: c.start, end: Date.now(), min }); toast(hm(min) + ' pour ' + client(c.client).name); }
  render();
}
let chronoTimer = null;
function tickChrono() {
  clearInterval(chronoTimer);
  const c = get('chrono'), el = document.getElementById('chrono-t'); if (!c || !el) return;
  const f = () => { const s = Math.floor((Date.now() - c.start) / 1000); el.textContent = Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60) : Math.floor(s / 60) + ':' + pad(s % 60); };
  f(); chronoTimer = setInterval(f, 1000);
}

// ---------- repas ----------
function mealSheet(slot, m) {
  const isNew = !m; m = m || { id: uid('meal'), t: 'meal', d: today(), slot: slot || 'dej', label: '', kcal: null, prot: null };
  const favs = []; const seen = {}; all('meal').sort((a, b) => (b.u || 0) - (a.u || 0)).forEach(x => { const k = (x.label || '').toLowerCase(); if (!k || seen[k]) return; seen[k] = 1; favs.push(x); }); favs.length = Math.min(favs.length, 10);
  const todays = byDate('meal', m.d).filter(x => x.id !== m.id);
  const sh = openSheet(isNew ? 'Ajouter un repas' : 'Repas', `
    ${segHtml('slot', [{ v: 'pdj', l: 'Petit-déj' }, { v: 'dej', l: 'Déj' }, { v: 'din', l: 'Dîner' }, { v: 'snack', l: 'Snack' }], m.slot)}
    ${favs.length ? `<label class="f">Habituels (tap = pré-rempli)</label><div class="chips scroll">${favs.map(f => `<button class="chip" data-fav="${esc(f.label)}" data-k="${f.kcal || ''}" data-p="${f.prot || ''}">${esc(f.label)} · ${f.kcal || '?'} kcal</button>`).join('')}</div>` : ''}
    <label class="f">Quoi</label><div class="row"><input class="in grow" data-label placeholder="ex. Poulet riz brocolis" value="${esc(m.label)}"><button class="mic" data-mic>🎙️</button></div>
    <div class="grid2"><div><label class="f">Calories</label><input class="in num" type="number" inputmode="numeric" data-kcal value="${m.kcal ?? ''}" placeholder="kcal"></div><div><label class="f">Protéines (g)</label><input class="in num" type="number" inputmode="numeric" data-prot value="${m.prot ?? ''}" placeholder="g"></div></div>
    ${todays.length ? `<div class="mt small muted">Déjà aujourd'hui : ${todays.map(x => `<span data-editmeal="${x.id}" style="text-decoration:underline;cursor:pointer">${esc(x.label || x.slot)} ${x.kcal || 0} kcal</span>`).join(' · ')}</div>` : ''}
    <div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Supprimer</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh); micButton('[data-label]', sh);
  sh.querySelectorAll('[data-fav]').forEach(b => b.addEventListener('click', () => { sh.querySelector('[data-label]').value = b.dataset.fav; sh.querySelector('[data-kcal]').value = b.dataset.k; sh.querySelector('[data-prot]').value = b.dataset.p; }));
  sh.querySelectorAll('[data-editmeal]').forEach(b => b.addEventListener('click', () => { sh.close(); mealSheet(null, get(b.dataset.editmeal)); }));
  sh.querySelector('[data-save]').addEventListener('click', () => {
    m.slot = segVal(sh, 'slot'); m.label = val(sh, '[data-label]'); m.kcal = nval(sh, '[data-kcal]') || 0; m.prot = nval(sh, '[data-prot]') || 0;
    if (!m.kcal && !m.prot && !m.label) { toast('Repas vide'); return; }
    put(m); sh.close(); render(); toast('Repas ajouté · ' + sum(byDate('meal', m.d).map(x => x.kcal)) + ' kcal aujourd\'hui');
  });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(m.id); sh.close(); render(); });
  setTimeout(() => { if (isNew) sh.querySelector('[data-kcal]').focus(); }, 150);
}

// ---------- matin ----------
function morningSheet(date) {
  const d = date || today(); const m = get('morning-' + d) || { id: 'morning-' + d, t: 'morning', d };
  const prevW = all('morning').filter(x => x.weight != null && x.d < d).sort((a, b) => b.d.localeCompare(a.d))[0];
  const sh = openSheet('Check-in du matin · ' + fmtDate(d, true), `
    ${m.sleep_h_auto != null ? `<div class="notice">Apple Santé : ${hm(m.sleep_h_auto * 60)} de sommeil${m.sleep_start ? ' (' + esc(m.sleep_start) + ' → ' + esc(m.sleep_end || '') + ')' : ''}. Corrige avec les chiffres Sleep Cycle si différent.</div>` : ''}
    <div class="grid3">
      <div><label class="f">Sommeil (h)</label><input class="in num" type="number" step="0.1" inputmode="decimal" data-sh value="${m.sleep_h ?? m.sleep_h_auto ?? ''}" placeholder="7.5"></div>
      <div><label class="f">Qualité (%)</label><input class="in num" type="number" inputmode="numeric" data-sq value="${m.sleep_q ?? ''}" placeholder="80"></div>
      <div><label class="f">Poids (kg)</label><input class="in num" type="number" step="0.1" inputmode="decimal" data-w value="${m.weight ?? ''}" placeholder="${prevW ? prevW.weight : '75'}"></div>
    </div>
    <label class="f">Comment je me sens au réveil</label>${scaleHtml('feel', 10, m.feel)}
    <label class="f">Temps d'écran d'hier (Réglages → Temps d'écran)</label><div class="row"><input class="in num grow" type="number" inputmode="numeric" data-scrh value="${m.screen_min != null ? Math.floor(m.screen_min / 60) : ''}" placeholder="h"><span class="muted">h</span><input class="in num grow" type="number" inputmode="numeric" data-scrm value="${m.screen_min != null ? m.screen_min % 60 : ''}" placeholder="min"><span class="muted">min</span></div>
    <label class="f">Screen Sleep Cycle → lecture automatique des chiffres</label><input type="file" accept="image/*" data-photo class="in" style="font-size:14px"><div class="small muted" data-ocr-status>${m.photo ? `<a href="${esc(m.photo)}" target="_blank">Screen enregistré</a>` : 'Choisis le screen : sommeil et qualité se remplissent seuls.'}</div>
    <label class="f">Note</label><input class="in" data-note value="${esc(m.note || '')}" placeholder="réveil nocturne, rêve, intention du jour…">
    <div class="sheet-actions"><button class="btn p wide" data-save>Enregistrer</button></div>`);
  wireSegs(sh);
  sh.querySelector('[data-photo]').addEventListener('change', async () => {
    const f = sh.querySelector('[data-photo]').files[0]; if (!f) return;
    const st = sh.querySelector('[data-ocr-status]'); st.textContent = 'Lecture du screen…';
    try {
      const data = await shrinkImage(f); const r = await post({ what: 'photo', name: 'sleep-' + d + '.jpg', mime: 'image/jpeg', data, ocr: true });
      if (!r.ok) throw new Error(r.error || 'photo');
      m.photo = r.url; m.sleep_src = 'sleepcycle-ocr';
      if (r.sleep_h != null) sh.querySelector('[data-sh]').value = r.sleep_h;
      if (r.sleep_q != null) sh.querySelector('[data-sq]').value = r.sleep_q;
      st.textContent = (r.sleep_h != null || r.sleep_q != null) ? 'Lu : ' + (r.sleep_h != null ? hm(r.sleep_h * 60) : '?') + ' · ' + (r.sleep_q != null ? r.sleep_q + ' %' : '?') + ' (corrige si besoin)' : 'Screen enregistré mais chiffres non reconnus : saisis-les à la main.';
    } catch (e) { st.textContent = 'Screen non envoyé (' + (e.message || e) + ')'; }
  });
  sh.querySelector('[data-save]').addEventListener('click', async () => {
    m.sleep_h = nval(sh, '[data-sh]'); m.sleep_q = nval(sh, '[data-sq]'); m.weight = nval(sh, '[data-w]'); m.feel = segVal(sh, 'feel');
    const sh_ = nval(sh, '[data-scrh]'), sm = nval(sh, '[data-scrm]'); m.screen_min = (sh_ != null || sm != null) ? (sh_ || 0) * 60 + (sm || 0) : null; m.note = val(sh, '[data-note]');
    put(m); sh.close(); render(); toast('Check-in enregistré ☀️');
  });
}
function shrinkImage(file) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1200 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82).split(',')[1]); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
}

// ---------- soir ----------
function eveningSheet(date) {
  const d = date || today(); const e = get('evening-' + d) || { id: 'evening-' + d, t: 'evening', d };
  const tasksDone = all('task').filter(t => t.done && (t.done_at || '').slice(0, 10) === d);
  const sh = openSheet('Bilan du soir · ' + fmtDate(d, true), `
    <div class="small muted">${tasksDone.length} tâche${tasksDone.length > 1 ? 's' : ''} faite${tasksDone.length > 1 ? 's' : ''} · ${hm(workMinutes(d, d))} de travail</div>
    <label class="f">Énergie de la journée</label>${scaleHtml('energy', 10, e.energy)}
    <label class="f">Humeur</label>${segHtml('mood', [{ v: 1, l: '😞' }, { v: 2, l: '😐' }, { v: 3, l: '🙂' }, { v: 4, l: '😄' }, { v: 5, l: '🔥' }], e.mood)}
    <label class="f">3 gratitudes</label><textarea class="in" data-grat placeholder="1.&#10;2.&#10;3.">${esc(e.gratitude || '')}</textarea>
    <label class="f">Victoire du jour</label><input class="in" data-win value="${esc(e.win || '')}" placeholder="ce dont je suis fier">
    <label class="f">Apprentissage</label><input class="in" data-learn value="${esc(e.learn || '')}" placeholder="ce que j'ai appris">
    <label class="f">Réflexion</label><textarea class="in" data-reflect placeholder="ce qui tourne dans ma tête, ce que je ferais autrement">${esc(e.reflect || '')}</textarea>
    <label class="f">L'action de demain (ajoutée à la to-do)</label><div class="row"><input class="in grow" data-tmr value="${esc(e.tomorrow || '')}" placeholder="la seule chose qui compte demain"><button class="mic" data-mic>🎙️</button></div>
    ${clientChips('tclient', e.tclient || 'client-perso', true)}
    <div class="sheet-actions"><button class="btn p wide" data-save>Enregistrer</button></div>`);
  wireSegs(sh); micButton('[data-tmr]', sh);
  sh.querySelector('[data-save]').addEventListener('click', () => {
    e.energy = segVal(sh, 'energy'); e.mood = segVal(sh, 'mood'); e.gratitude = val(sh, '[data-grat]'); e.win = val(sh, '[data-win]'); e.learn = val(sh, '[data-learn]'); e.reflect = val(sh, '[data-reflect]');
    const tm = val(sh, '[data-tmr]'); e.tclient = segVal(sh, 'tclient');
    if (tm && tm !== e.tomorrow) {
      if (e.task_id) { const old = get(e.task_id); if (old && !old.done) { old.title = tm; old.client = e.tclient; put(old); } }
      else { const t = put({ id: uid('task'), t: 'task', d, title: tm, client: e.tclient || 'client-perso', imp: 3, urg: 2, today: addDays(d, 1), done: false, src: 'eve' }); e.task_id = t.id; }
    }
    e.tomorrow = tm; put(e); sh.close(); render(); toast('Bilan enregistré 🌙' + (tm ? ' · action posée pour demain' : ''));
  });
}
