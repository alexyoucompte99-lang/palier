/* Palier · noyau : stockage local + synchro Sheet (pont Apps Script), helpers UI, données de base. */
const BRIDGE = { url: 'https://script.google.com/macros/s/AKfycbzbiutY5E4Y3qoTtCPx08txUJ0zuGWSfGhn5r_jNYZ_qYPrcIIKOL8UtBGjwntZ0pB2NQ/exec', key: 'palier-7f3c9a2e5b1d4c8e' };
const APP_URL = 'https://alexyoucompte99-lang.github.io/palier/';

// ---------- dates ----------
const pad = n => (n < 10 ? '0' : '') + n;
const ymd = d => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const today = () => ymd(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const tomorrow = () => addDays(today(), 1);
const dow = s => (new Date(s + 'T12:00:00').getDay() + 6) % 7; // 0 = lundi
const monday = s => addDays(s || today(), -dow(s || today()));
const weekKey = s => { const d = new Date((s || today()) + 'T12:00:00'); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return t.getUTCFullYear() + '-W' + pad(Math.ceil(((t - y0) / 864e5 + 1) / 7)); };
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const fmtDate = (s, withDay) => { if (!s) return ''; const d = new Date(s + 'T12:00:00'); return (withDay ? DAYS[dow(s)] + ' ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const fmtLong = s => { const d = new Date(s + 'T12:00:00'); return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'][dow(s)] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const hm = min => { min = Math.round(min || 0); const h = Math.floor(min / 60), m = min % 60; return h ? h + 'h' + (m ? pad(m) : '') : m + ' min'; };
const paceStr = p => { if (!p || !isFinite(p)) return '–'; const m = Math.floor(p), s = Math.round((p - m) * 60); return m + ':' + pad(s === 60 ? 59 : s); };
const minStr = m => { if (m == null || !isFinite(m)) return '–'; const mm = Math.floor(m), s = Math.round((m - mm) * 60); return mm + ':' + pad(s === 60 ? 59 : s); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = t => t + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
const sum = a => a.reduce((s, x) => s + (Number(x) || 0), 0);
const avg = a => a.length ? sum(a) / a.length : null;
const r1 = n => Math.round(n * 10) / 10;

// ---------- stockage ----------
const DB = { items: {}, lastSync: 0, outbox: [] };
function loadDB() { try { const s = JSON.parse(localStorage.getItem('palier-db') || 'null'); if (s) Object.assign(DB, s); } catch (e) {} }
function saveDB() { try { localStorage.setItem('palier-db', JSON.stringify(DB)); } catch (e) {} }
function all(type) { const r = []; for (const k in DB.items) { const o = DB.items[k]; if (!o.del && (!type || o.t === type)) r.push(o); } return r; }
function get(id) { const o = DB.items[id]; return o && !o.del ? o : null; }
function put(o, silent) { o.u = Date.now(); DB.items[o.id] = o; if (!DB.outbox.includes(o.id)) DB.outbox.push(o.id); saveDB(); if (!silent) { flushSoon(); } return o; }
function remove(id) { const o = DB.items[id]; if (!o) return; o.del = true; put(o); }
function byDate(type, d) { return all(type).filter(o => o.d === d); }
function inRange(type, a, b) { return all(type).filter(o => o.d >= a && o.d <= b); }

// settings singleton
function settings() { return get('settings') || { id: 'settings', t: 'settings', kcal: 2400, prot: 160, hours_week: 30, run_start: '2026-09-07', run_5k: 30, ntfy: 'palier-alex-q7m2x9' }; }
function setSetting(k, v) { const s = settings(); s[k] = v; put(s); }

// ---------- synchro ----------
let flushTimer = null, syncing = false;
const syncEl = () => document.getElementById('sync');
function setSync(state) { const e = syncEl(); if (e) e.className = 'sync ' + state; }
function flushSoon() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 600); }
async function flush() {
  if (!DB.outbox.length || syncing || !navigator.onLine) return;
  syncing = true; setSync('busy');
  const ids = DB.outbox.slice(0, 40);
  const items = ids.map(id => DB.items[id]).filter(Boolean);
  try {
    const r = await post({ what: 'upsert', items });
    if (r && r.ok) { DB.outbox = DB.outbox.filter(id => !ids.includes(id)); saveDB(); setSync('ok'); }
    else setSync('err');
  } catch (e) { setSync('err'); }
  syncing = false;
  if (DB.outbox.length) flushSoon();
}
async function pull(full) {
  if (!navigator.onLine) return;
  setSync('busy');
  try {
    const r = await fetch(BRIDGE.url + '?key=' + encodeURIComponent(BRIDGE.key) + '&what=all&since=' + (full ? 0 : DB.lastSync), { cache: 'no-store' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'pull');
    let changed = 0;
    (j.items || []).forEach(o => {
      const loc = DB.items[o.id];
      if (!loc || (o.u || 0) > (loc.u || 0)) { if (!DB.outbox.includes(o.id)) { DB.items[o.id] = o; changed++; } }
    });
    DB.lastSync = j.now || Date.now(); saveDB(); setSync(DB.outbox.length ? 'busy' : 'ok');
    if (changed) render();
    if (DB.outbox.length) flush();
  } catch (e) { setSync('err'); }
}
async function post(payload) {
  const r = await fetch(BRIDGE.url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ key: BRIDGE.key }, payload)), keepalive: true });
  return r.json();
}

// ---------- clients (référentiel) ----------
const CLIENT_SEED = [
  { id: 'client-lucas', name: 'Lucas', role: 'Leads & Business', kind: 'client', horizon: 'court', color: 'var(--blue)', letter: 'Lu' },
  { id: 'client-lauric', name: 'Lauric', role: 'Prospection Insta', kind: 'client', horizon: 'court', color: 'var(--rose)', letter: 'La' },
  { id: 'client-thomas', name: 'Thomas', role: 'Investisseurs 3.0', kind: 'client', horizon: 'court', color: 'var(--violet)', letter: 'Th' },
  { id: 'client-anais', name: 'Anaïs', role: 'Selfty Academy', kind: 'client', horizon: 'court', color: 'var(--orange)', letter: 'An' },
  { id: 'client-tanguy', name: 'Tanguy', role: 'Associé 50/50', kind: 'client', horizon: 'court', color: 'var(--teal)', letter: 'Ta' },
  { id: 'client-eloi', name: 'Eloi', role: 'Client', kind: 'client', horizon: 'court', color: 'var(--olive)', letter: 'El' },
  { id: 'client-leo', name: 'Léo', role: 'Référencement dentistes', kind: 'client', horizon: 'court', color: '#5b8def', letter: 'Lé' },
  { id: 'client-autre-business', name: 'Autre business', role: 'Projets et opportunités hors clients actuels', kind: 'biz', horizon: 'court', color: '#3aa17e', letter: 'AB' },
  { id: 'client-modif-palier', name: 'Modif Palier', role: 'Améliorations de l\'appli Palier', kind: 'biz', horizon: 'court', color: '#6b7cff', letter: 'MP' },
  { id: 'client-relation-argent', name: 'Relation argent', role: 'Business passion · formation, acquisition, contenu, clients. Plus tard : livre, conférences, podcast', kind: 'biz', horizon: 'liberte', color: 'var(--amber)', letter: 'R€' },
  { id: 'client-cynthia', name: 'Cynthia', role: 'Assistante (presta)', kind: 'team', horizon: 'court', color: '#9c6b9e', letter: 'Cy' },
  { id: 'client-maximilien', name: 'Maximilien', role: 'Alternant (presta)', kind: 'team', horizon: 'court', color: '#4d8a8a', letter: 'Ma' },
  { id: 'client-perso', name: 'Perso', role: 'Vie perso, admin, santé', kind: 'perso', horizon: 'perso', color: '#8b8f96', letter: 'Pe' },
  { id: 'client-liberte', name: 'Liberté future', role: 'Formation, investissement, projets long terme', kind: 'biz', horizon: 'liberte', color: '#c98a2e', letter: 'LF' },
];
const TASK_SEED = [
  { title: 'Monter le questionnaire Audit Stabilité dans Tally + lien iClosed', client: 'client-lucas', imp: 3, urg: 2 },
  { title: 'Anaïs : vidéos 2 min + lien live dans les pages de fin du quiz', client: 'client-anais', imp: 2, urg: 2 },
  { title: 'Scan Patrimoine : brancher iClosed profil B + WhatsApp pages de fin', client: 'client-thomas', imp: 3, urg: 2 },
  { title: 'Scan Patrimoine : contenu profil A + mails auto', client: 'client-thomas', imp: 2, urg: 2 },
  { title: 'Console business I3 : passer sur la règle « date de vente = jour du cochage »', client: 'client-thomas', imp: 2, urg: 1 },
  { title: 'Relation argent : bloquer 2 créneaux formation cette semaine', client: 'client-relation-argent', imp: 3, urg: 1 },
];
function clients() { return all('client').sort((a, b) => (a.order || 0) - (b.order || 0)); }
function client(id) { return get(id) || CLIENT_SEED.find(c => c.id === id) || { name: '?', color: 'var(--soft)', letter: '?' }; }
function seedIfEmpty() {
  if (!all('client').length) CLIENT_SEED.forEach((c, i) => put(Object.assign({ t: 'client', order: i, bottlenecks: [], plan: '', notes: '', mrr: null, status: 'actif' }, c), true));
  else CLIENT_SEED.forEach((c, i) => { if (!DB.items[c.id]) put(Object.assign({ t: 'client', order: i, bottlenecks: [], plan: '', notes: '', mrr: null, status: 'actif' }, c), true); });
  if (!all('task').length && !localStorage.getItem('palier-seeded')) { TASK_SEED.forEach(t => put(Object.assign({ id: uid('task'), t: 'task', d: today(), today: null, done: false, src: 'seed' }, t), true)); }
  if (!all('plan').length) DEFAULT_PLANS.forEach(p => put(Object.assign({ t: 'plan' }, p), true));
  if (!all('goal').length && !localStorage.getItem('palier-seeded')) GOAL_SEED.forEach(g => put(Object.assign({ id: uid('goal'), t: 'goal', d: today(), status: 'actif' }, g), true));
  localStorage.setItem('palier-seeded', '1');
  flushSoon();
}
const DEFAULT_PLANS = [
  { id: 'plan-push', name: 'Push', sub: 'Pecs · épaules · triceps', ex: ['Développé couché', 'Développé incliné haltères', 'Développé militaire', 'Élévations latérales', 'Dips', 'Extension triceps poulie'] },
  { id: 'plan-pull', name: 'Pull', sub: 'Dos · biceps', ex: ['Tractions', 'Rowing barre', 'Tirage vertical', 'Rowing haltère', 'Face pull', 'Curl barre', 'Curl marteau'] },
  { id: 'plan-legs', name: 'Jambes', sub: 'Jambes · abdos', ex: ['Squat', 'Presse', 'Soulevé de terre roumain', 'Fentes', 'Leg curl', 'Mollets', 'Gainage'] },
];
const GOAL_CATS = ['Business', 'Relation argent', 'Liberté future', 'Sport', 'Nutrition', 'Sommeil & énergie', 'Perso'];
const GOAL_SEED = [
  { cat: 'Sport', title: 'Courir 5 km en 20 min', target: 'd\'ici le 6 décembre 2026', metric: null },
  { cat: 'Sport', title: '3 séances de muscu par semaine', metric: { of: 'workout', n: 3 } },
  { cat: 'Sport', title: '3 runs par semaine', metric: { of: 'run', n: 3 } },
  { cat: 'Sport', title: 'Méditer tous les jours', metric: { of: 'medit', n: 7 } },
  { cat: 'Business', title: 'Rester sous 30 h de travail par semaine', metric: { of: 'hours', n: 30, max: true } },
  { cat: 'Relation argent', title: 'Consacrer 5 h par semaine à Relation argent / liberté future', metric: { of: 'hours_liberte', n: 5 } },
];

// ---------- priorités ----------
function quadrant(t) { const i = t.imp || 2, u = t.urg || 2; if (i >= 2 && u >= 2) return 1; if (i >= 2) return 2; if (u >= 2) return 3; return 4; }
const QLABEL = { 1: 'Faire', 2: 'Planifier', 3: 'Déléguer', 4: 'Si le temps' };
function prioScore(t) { return (t.imp || 2) * 2 + (t.urg || 2) * 1.5 + (t.today && t.today < today() ? 3 : 0); }
function sortTasks(a) { return a.slice().sort((x, y) => prioScore(y) - prioScore(x) || (x.d || '').localeCompare(y.d || '')); }

// ---------- UI helpers ----------
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }
function h(html) { const d = document.createElement('div'); d.innerHTML = html; return d; }
function openSheet(title, bodyHtml, opts) {
  opts = opts || {};
  const root = document.getElementById('sheet-root');
  root.innerHTML = '';
  const bg = h(`<div class="sheet-bg"><div class="sheet"><div class="sheet-h"><h2>${esc(title)}</h2><button class="x" data-x>✕</button></div><div class="sheet-body">${bodyHtml}</div></div></div>`).firstChild;
  root.appendChild(bg);
  const close = () => { root.innerHTML = ''; if (opts.onClose) opts.onClose(); };
  bg.addEventListener('click', e => { if (e.target === bg || e.target.hasAttribute('data-x')) close(); });
  bg.close = close;
  document.body.style.overflow = 'hidden';
  const restore = () => { document.body.style.overflow = ''; };
  const obs = new MutationObserver(() => { if (!root.contains(bg)) { restore(); obs.disconnect(); } });
  obs.observe(root, { childList: true });
  return bg;
}
function closeSheet() { const r = document.getElementById('sheet-root'); r.innerHTML = ''; document.body.style.overflow = ''; }
function segHtml(name, opts, val) { return `<div class="seg" data-seg="${name}">${opts.map(o => `<button type="button" data-v="${esc(o.v)}" class="${o.v === val ? 'on' : ''}">${o.l}</button>`).join('')}</div>`; }
function scaleHtml(name, n, val, from) { from = from || 1; let s = `<div class="scale" data-seg="${name}">`; for (let i = from; i <= n; i++) s += `<button type="button" data-v="${i}" class="${val === i ? 'on' : ''}">${i}</button>`; return s + '</div>'; }
function chipsHtml(name, opts, val, multi) { return `<div class="chips" data-seg="${name}" ${multi ? 'data-multi' : ''}>${opts.map(o => `<button type="button" class="chip ${(multi ? (val || []).includes(o.v) : o.v === val) ? 'on' : ''}" data-v="${esc(o.v)}">${o.l}</button>`).join('')}</div>`; }
function wireSegs(root) {
  root.querySelectorAll('[data-seg]').forEach(seg => {
    seg.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      if (seg.hasAttribute('data-multi')) b.classList.toggle('on');
      else { seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); }
      seg.dispatchEvent(new CustomEvent('change', { bubbles: true }));
    });
  });
}
function segVal(root, name) { const seg = root.querySelector(`[data-seg="${name}"]`); if (!seg) return null; if (seg.hasAttribute('data-multi')) return [...seg.querySelectorAll('button.on')].map(b => b.dataset.v); const b = seg.querySelector('button.on'); return b ? (isNaN(b.dataset.v) ? b.dataset.v : Number(b.dataset.v)) : null; }
function val(root, sel) { const e = root.querySelector(sel); return e ? e.value.trim() : ''; }
function nval(root, sel) { return num(val(root, sel)); }
function clientChips(name, val, extra) { const cs = clients().filter(c => c.kind !== 'team' || extra); return chipsHtml(name, cs.map(c => ({ v: c.id, l: c.name })), val); }
function clientDot(id) { const c = client(id); return `<span class="dot" style="background:${c.color}"></span>${esc(c.name)}`; }

// ---------- dictée vocale ----------
function micButton(inputSel, root) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = root.querySelector('[data-mic]');
  if (!btn) return;
  if (!SR) { btn.title = 'Dictée : utilise le micro du clavier'; btn.addEventListener('click', () => { root.querySelector(inputSel).focus(); toast('Utilise le micro du clavier 🎙️'); }); return; }
  let rec = null;
  btn.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = true; rec.continuous = false;
    const inp = root.querySelector(inputSel); const base = inp.value ? inp.value + ' ' : '';
    btn.classList.add('rec');
    rec.onresult = e => { let s = ''; for (const r of e.results) s += r[0].transcript; inp.value = base + s.charAt(0).toUpperCase() + s.slice(1); };
    rec.onend = () => { btn.classList.remove('rec'); rec = null; inp.focus(); };
    rec.onerror = () => { btn.classList.remove('rec'); rec = null; toast('Micro indisponible : utilise celui du clavier'); };
    rec.start();
  });
}

// ---------- stats partagées ----------
function workMinutes(a, b, horizonFilter) {
  // temps de travail = chronos + temps saisi sur les tâches (hors tâches cochées pendant un chrono)
  let m = 0;
  inRange('work', a, b).forEach(w => { const c = client(w.client); if (c.horizon === 'perso') return; if (!horizonFilter || c.horizon === horizonFilter) m += w.min || 0; });
  all('task').forEach(t => { if (!t.done || !t.mins || t.in_chrono) return; const d = (t.done_at || '').slice(0, 10); if (d < a || d > b) return; const c = client(t.client); if (c.horizon === 'perso') return; if (!horizonFilter || c.horizon === horizonFilter) m += t.mins; });
  return m;
}
function weekStats(mon) {
  const sun = addDays(mon, 6);
  const tasks = all('task').filter(t => t.done && (t.done_at || '').slice(0, 10) >= mon && (t.done_at || '').slice(0, 10) <= sun);
  const runs = inRange('run', mon, sun), wos = inRange('workout', mon, sun).filter(w => w.status !== 'live'), box = inRange('boxe', mon, sun), med = inRange('medit', mon, sun);
  const morn = inRange('morning', mon, sun), meals = inRange('meal', mon, sun);
  const days = {}; meals.forEach(m => { days[m.d] = days[m.d] || { k: 0, p: 0 }; days[m.d].k += m.kcal || 0; days[m.d].p += m.prot || 0; });
  const dv = Object.values(days);
  return {
    tasks: tasks.length, runs: runs.length, km: r1(sum(runs.map(r => r.km))), workouts: wos.length, tonnage: sum(wos.map(w => w.tonnage)), boxe: box.length, boxeMin: sum(box.map(b => b.min)),
    medit: new Set(med.map(m => m.d)).size, meditMin: sum(med.map(m => m.min)),
    sleep: avg(morn.map(m => m.sleep_h ?? m.sleep_h_auto).filter(x => x != null)), energy: avg(inRange('evening', mon, sun).map(e => e.energy).filter(x => x != null)),
    kcal: avg(dv.map(x => x.k)), prot: avg(dv.map(x => x.p)), weight: avg(morn.map(m => m.weight).filter(x => x != null)),
    hours: workMinutes(mon, sun) / 60, hoursLib: workMinutes(mon, sun, 'liberte') / 60, hoursCourt: workMinutes(mon, sun, 'court') / 60,
    screen: avg(morn.map(m => m.screen_min).filter(x => x != null)),
  };
}
function sportDays(mon) { const sun = addDays(mon, 6); const s = new Set(); ['run', 'workout', 'boxe'].forEach(t => inRange(t, mon, sun).forEach(o => { if (o.status !== 'live') s.add(o.d); })); return s.size; }
function streakWeeks() { let n = 0, m = monday(); if (sportDays(m) >= 3) n++; else if (dow(today()) < 6) { /* semaine en cours pas finie : on ne casse pas */ } else return 0; for (let i = 1; i < 60; i++) { const w = addDays(m, -7 * i); if (sportDays(w) >= 3) n++; else break; } return n; }
function goalProgress(g) {
  if (!g.metric) return null;
  const mon = monday(), sun = addDays(mon, 6), m = g.metric;
  let cur = 0;
  if (m.of === 'hours') cur = r1(workMinutes(mon, sun) / 60);
  else if (m.of === 'hours_liberte') cur = r1(workMinutes(mon, sun, 'liberte') / 60);
  else if (m.of === 'medit') cur = new Set(inRange('medit', mon, sun).map(x => x.d)).size;
  else if (m.of === 'task') cur = all('task').filter(t => t.done && (t.done_at || '').slice(0, 10) >= mon).length;
  else cur = inRange(m.of, mon, sun).filter(x => x.status !== 'live').length;
  return { cur, n: m.n, max: !!m.max, pct: m.max ? Math.min(100, cur / m.n * 100) : Math.min(100, cur / m.n * 100), ok: m.max ? cur <= m.n : cur >= m.n };
}
