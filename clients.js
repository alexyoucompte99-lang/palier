/* Palier · onglet Clients : cartes, page client (goulots, plan hebdo, tâches), équipe, pipeline. */
function renderClients(root) {
  if (VIEW.clientId) return renderClientPage(root, VIEW.clientId);
  const mon = monday(), sun = addDays(mon, 6);
  const open = all('task').filter(t => !t.done);
  const card = c => {
    const ts = open.filter(t => t.client === c.id), hot = ts.filter(t => quadrant(t) === 1).length;
    const hrs = r1(workMinutesClient(c.id, mon, sun) / 60);
    const b = (c.bottlenecks || []).filter(Boolean)[0];
    return `<button class="client" data-client="${c.id}"><span class="avatar" style="background:${c.color}">${esc(c.letter || c.name.slice(0, 2))}</span><span class="grow"><div class="row between"><span class="n">${esc(c.name)}</span><span class="pill-count">${ts.length ? ts.length + ' tâche' + (ts.length > 1 ? 's' : '') : ''}${hot ? ' · <span style="color:var(--red)">' + hot + ' 🔥</span>' : ''}${hrs ? ' · ' + hrs + ' h' : ''}</span></div><div class="r">${esc(c.role)}</div>${b ? `<div class="b">🚧 ${esc(b)}</div>` : ''}</span></button>`;
  };
  const cs = clients();
  const deals = all('deal'), mrr = sum(deals.filter(d => d.stage === 'signe').map(d => d.amount)), pipe = sum(deals.filter(d => d.stage === 'prospect' || d.stage === 'propal').map(d => d.amount));
  root.innerHTML = `
    <div class="row between" style="margin-top:6px"><h1>Clients</h1><span class="small muted">${open.length} tâches ouvertes</span></div>
    ${cs.filter(c => c.kind === 'client').map(card).join('')}
    <div class="sec"><h2>Business à part entière</h2></div>
    ${cs.filter(c => c.kind === 'biz').map(card).join('')}
    <div class="sec"><h2>Équipe</h2><span class="small muted">à déléguer</span></div>
    ${cs.filter(c => c.kind === 'team').map(card).join('')}
    <div class="sec"><h2>Perso</h2></div>
    ${cs.filter(c => c.kind === 'perso').map(card).join('')}
    <div class="sec"><h2>Pipeline & CA</h2><button class="btn sm" data-newdeal>＋ Deal</button></div>
    <div class="card">
      <div class="kpis"><div class="kpi"><div class="v">${mrr.toLocaleString('fr-FR')} €</div><div class="l">CA mensuel signé</div></div><div class="kpi"><div class="v">${pipe.toLocaleString('fr-FR')} €</div><div class="l">en discussion</div></div><div class="kpi"><div class="v">${deals.filter(d => d.stage === 'signe').length}</div><div class="l">clients actifs</div></div></div>
      ${deals.length ? `<div class="tblwrap"><table class="tbl mt"><tr><th>Deal</th><th>Étape</th><th class="right">€/mois</th><th>Prochaine étape</th></tr>${deals.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)).map(d => `<tr data-deal="${d.id}" style="cursor:pointer"><td><b>${esc(d.name)}</b></td><td><span class="chip ${d.stage === 'signe' ? 'chip-acc' : d.stage === 'perdu' ? 'chip-red' : ''}" style="padding:2px 8px">${STAGE_L[d.stage]}</span></td><td class="right">${d.amount ? d.amount.toLocaleString('fr-FR') : '–'}</td><td class="small">${esc(d.next || '')}</td></tr>`).join('')}</table></div>` : '<div class="empty">Ajoute tes deals en cours et ton CA par client pour voir le pipeline.</div>'}
    </div>
    <button class="btn wide mt2" data-newclient>＋ Ajouter un client / projet</button><div style="height:20px"></div>`;
  root.querySelectorAll('[data-client]').forEach(b => b.addEventListener('click', () => { VIEW.clientId = b.dataset.client; render(); window.scrollTo(0, 0); }));
  root.querySelector('[data-newdeal]').addEventListener('click', () => dealSheet());
  root.querySelectorAll('[data-deal]').forEach(r => r.addEventListener('click', () => dealSheet(get(r.dataset.deal))));
  root.querySelector('[data-newclient]').addEventListener('click', () => clientSheet());
}
const STAGES = ['prospect', 'propal', 'signe', 'pause', 'perdu'];
const STAGE_L = { prospect: 'Prospect', propal: 'Proposition', signe: 'Signé', pause: 'Pause', perdu: 'Perdu' };
function workMinutesClient(id, a, b) { let m = 0; inRange('work', a, b).forEach(w => { if (w.client === id) m += w.min || 0; }); all('task').forEach(t => { if (t.client === id && t.done && t.mins && !t.in_chrono) { const d = (t.done_at || '').slice(0, 10); if (d >= a && d <= b) m += t.mins; } }); return m; }

function renderClientPage(root, id) {
  const c = get(id); if (!c) { VIEW.clientId = null; return render(); }
  const mon = monday(), sun = addDays(mon, 6);
  const ts = all('task').filter(t => t.client === id);
  const open = sortTasks(ts.filter(t => !t.done)), week = open.filter(t => t.src === 'weekly' && t.d >= mon), done = ts.filter(t => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 15);
  const weeks = weekLabels(8), hrs = weeks.map(w => r1(workMinutesClient(id, w, addDays(w, 6)) / 60));
  const wr = latestWeekly(); const wc = wr && wr.clients && wr.clients[id];
  root.innerHTML = `
    <div class="row" style="margin-top:6px"><button class="icon-btn" data-back>←</button><span class="avatar" style="background:${c.color}">${esc(c.letter || '')}</span><div class="grow"><h1 style="font-size:20px">${esc(c.name)}</h1><div class="small muted">${esc(c.role)}</div></div><button class="icon-btn" data-editclient>✎</button></div>
    <div class="card">
      <div class="card-h"><h2>🚧 Goulots d'étranglement</h2><span class="small muted">revus chaque semaine</span></div>
      ${[0, 1, 2].map(i => `<input class="in mb" data-bn="${i}" placeholder="${i + 1}. ${['ce qui bloque le plus', 'deuxième frein', 'troisième frein'][i]}" value="${esc((c.bottlenecks || [])[i] || '')}">`).join('')}
      <label class="f">Plan d'action de la semaine (texte libre)</label><textarea class="in" data-plan placeholder="3 actions max, concrètes">${esc(c.plan || '')}</textarea>
      <label class="f">Notes / contexte</label><textarea class="in" data-notes placeholder="accès, liens, décisions, infos à retenir">${esc(c.notes || '')}</textarea>
      <button class="btn p wide mt" data-savec>Enregistrer</button>
    </div>
    ${wc && wc.actions && wc.actions.length ? `<div class="notice">📅 Bilan hebdo ${esc(wr.week)} : ${wc.actions.map(esc).join(' · ')}</div>` : ''}
    <div class="sec"><h2>Tâches (${open.length})</h2><button class="btn sm p" data-addtask>＋ Tâche</button></div>
    <div class="card">${open.map(taskRow).join('') || '<div class="empty">Aucune tâche ouverte</div>'}</div>
    <div class="sec"><h2>Temps consacré</h2><span class="small muted">${r1(workMinutesClient(id, mon, sun) / 60)} h cette semaine</span></div>
    <div class="card"><div data-chart-hours></div></div>
    ${done.length ? `<details class="card"><summary style="cursor:pointer;font-weight:800">Faites récemment (${done.length})</summary>${done.map(taskRow).join('')}</details>` : ''}
    <div style="height:30px"></div>`;
  root.querySelector('[data-back]').addEventListener('click', () => { VIEW.clientId = null; render(); });
  root.querySelector('[data-editclient]').addEventListener('click', () => clientSheet(c));
  root.querySelector('[data-savec]').addEventListener('click', () => { c.bottlenecks = [0, 1, 2].map(i => val(root, `[data-bn="${i}"]`)); c.plan = val(root, '[data-plan]'); c.notes = val(root, '[data-notes]'); put(c); toast('Enregistré'); });
  root.querySelector('[data-addtask]').addEventListener('click', () => taskSheet(null, { client: id }));
  wireTasks(root);
  barChart(root.querySelector('[data-chart-hours]'), { labels: weeks.map(w => 'S' + weekKey(w).slice(-2)), series: [{ name: 'heures', color: c.color, vals: hrs }], fmt: v => r1(v) + ' h', showVals: true, h: 150 });
}
function clientSheet(c) {
  const isNew = !c; c = c || { id: uid('client'), t: 'client', name: '', role: '', kind: 'client', horizon: 'court', color: 'var(--blue)', letter: '', order: clients().length, bottlenecks: [], status: 'actif' };
  const sh = openSheet(isNew ? 'Nouveau client / projet' : 'Modifier', `
    <label class="f">Nom</label><input class="in" data-name value="${esc(c.name)}">
    <label class="f">Rôle / description</label><input class="in" data-role value="${esc(c.role)}">
    <label class="f">Type</label>${segHtml('kind', [{ v: 'client', l: 'Client' }, { v: 'biz', l: 'Business' }, { v: 'team', l: 'Équipe' }, { v: 'perso', l: 'Perso' }], c.kind)}
    <label class="f">Horizon (pour le suivi des 30 h)</label>${segHtml('horizon', [{ v: 'court', l: 'Court terme' }, { v: 'liberte', l: 'Liberté future' }, { v: 'perso', l: 'Perso (non compté)' }], c.horizon)}
    <label class="f">Couleur</label>${chipsHtml('color', ['var(--blue)', 'var(--rose)', 'var(--violet)', 'var(--orange)', 'var(--teal)', 'var(--olive)', 'var(--amber)', '#5b8def', '#9c6b9e', '#4d8a8a', '#8b8f96', '#c98a2e'].map(v => ({ v, l: `<span class="dot" style="background:${v};width:14px;height:14px"></span>` })), c.color)}
    <div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Archiver</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh);
  sh.querySelector('[data-save]').addEventListener('click', () => { c.name = val(sh, '[data-name]'); if (!c.name) return toast('Nom ?'); c.role = val(sh, '[data-role]'); c.kind = segVal(sh, 'kind'); c.horizon = segVal(sh, 'horizon'); c.color = segVal(sh, 'color') || c.color; c.letter = c.name.slice(0, 2); put(c); sh.close(); render(); });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(c.id); VIEW.clientId = null; sh.close(); render(); });
}
function dealSheet(d) {
  const isNew = !d; d = d || { id: uid('deal'), t: 'deal', d: today(), name: '', client: null, amount: null, stage: 'prospect', next: '' };
  const sh = openSheet(isNew ? 'Nouveau deal' : 'Deal', `
    <label class="f">Nom (client ou prospect)</label><input class="in" data-name value="${esc(d.name)}">
    <label class="f">Étape</label>${segHtml('stage', STAGES.map(s => ({ v: s, l: STAGE_L[s] })), d.stage)}
    <div class="grid2"><div><label class="f">€ / mois</label><input class="in num" type="number" inputmode="numeric" data-amount value="${d.amount ?? ''}"></div><div><label class="f">Rattaché à</label><select class="in" data-client><option value="">–</option>${clients().map(c => `<option value="${c.id}" ${d.client === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
    <label class="f">Prochaine étape</label><input class="in" data-next value="${esc(d.next || '')}">
    <div class="sheet-actions">${isNew ? '' : '<button class="btn danger" data-del>Supprimer</button>'}<button class="btn p grow" data-save>Enregistrer</button></div>`);
  wireSegs(sh);
  sh.querySelector('[data-save]').addEventListener('click', () => { d.name = val(sh, '[data-name]'); if (!d.name) return toast('Nom ?'); d.stage = segVal(sh, 'stage'); d.amount = nval(sh, '[data-amount]'); d.client = val(sh, '[data-client]') || null; d.next = val(sh, '[data-next]'); put(d); sh.close(); render(); });
  const del = sh.querySelector('[data-del]'); if (del) del.addEventListener('click', () => { remove(d.id); sh.close(); render(); });
}
function latestWeekly() { return all('weekly').sort((a, b) => b.week.localeCompare(a.week))[0]; }
