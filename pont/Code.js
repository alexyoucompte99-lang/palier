// Pont « Palier » : stockage des données de l'appli dans un Google Sheet + notifs ntfy + Strava + Apple Santé.
// KEY est aussi dans l'appli (page publique) : elle évite juste les appels accidentels.
// Secrets (ntfy topic, Strava, id du Sheet) = ScriptProperties, jamais dans ce code.
//
// doGet  ?key=…&what=all&since=<ms>     -> { ok, items:[…], now }
//        ?key=…&what=strava_auth        -> { url } (lien d'autorisation Strava)
//        ?code=… (retour OAuth Strava)  -> page « Strava connecté »
//        ?key=…&what=strava_sync        -> synchronisation immédiate
// doPost { key, what, … } :
//   setup        { ntfy_topic?, app_url? }   crée le Sheet, pose les secrets, installe les rappels
//   upsert       { items:[…] }               écrit/écrase par id (dernier `updated` gagne)
//   all          { since }                   comme doGet what=all
//   photo        { name, data(base64), mime, ocr? } -> { url, sleep_h?, sleep_q?, ocr_text? } (dossier Drive « Palier »)
//   sleep_shot   { data(base64), mime, date? }      screen Sleep Cycle -> OCR -> morning-<date> (Raccourci partage)
//   health       { date, sleep_h, sleep_start, sleep_end, sleep_q, mindful_min, weight, screen_min }  (Raccourci iOS / script Mac)
//   ntfy_test    {}
//   strava_setup { client_id, client_secret }
//   strava_sync  {}
//   selfty_setup { iclosed_key, selfty_url, selfty_key }  clé API iClosed + pont console Selfty (ScriptProperties), installe le trigger
//   selfty_sync  {}                          synchro immédiate : 1 tâche « appeler le lead » par call d'Anaïs (aujourd'hui/demain)
//
// Calls d'Anaïs (Selfty) : selftySync_() toutes les 30 min lit iClosed, crée/actualise une tâche par call à venir
// d'aujourd'hui ou de demain (id task-selfty-<callId>, src 'selfty', infos du lead dans `call`), la supprime si le call
// est annulé, et pousse `prep` (infos saisies par Alex dans la tâche) vers le pont Selfty (what=call_prep) dès qu'il change
// (à l'upsert depuis l'appli, + rattrapage au trigger). Une tâche supprimée à la main n'est pas recréée.

const KEY = 'palier-7f3c9a2e5b1d4c8e';
const P = PropertiesService.getScriptProperties();
const TAB = 'Items';
const HDR = ['id', 'type', 'date', 'updated', 'deleted', 'json'];
const TZ = 'Europe/Paris';

function doGet(e) {
  const q = (e && e.parameter) || {};
  if (q.code && q.scope) return stravaCallback_(q);
  if (q.key !== KEY) return out({ ok: true, pong: true, v: 1 });
  if (q.what === 'all') return out(all_(Number(q.since || 0)));
  if (q.what === 'strava_auth') return out({ ok: true, url: stravaAuthUrl_() });
  if (q.what === 'strava_sync') return out(stravaSync_());
  if (q.what === 'selfty_sync') return out(selftySync_());
  if (q.what === 'ntfy_test') return out({ ok: ntfy_('Palier : notification de test 👌', 'Test') });
  return out({ ok: true, pong: true, v: 1 });
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  if (p.key !== KEY) return out({ ok: false, error: 'bad key' });
  try {
    if (p.what === 'setup') return out(setup_(p));
    if (p.what === 'upsert') return out(upsert_(p.items || []));
    if (p.what === 'all') return out(all_(Number(p.since || 0)));
    if (p.what === 'photo') return out(photo_(p));
    if (p.what === 'health') return out(health_(p));
    if (p.what === 'sleep_shot') return out(sleepShot_(p));
    if (p.what === 'ntfy_test') return out({ ok: ntfy_('Palier : notification de test 👌', 'Test') });
    if (p.what === 'strava_setup') { P.setProperty('STRAVA_ID', String(p.client_id)); P.setProperty('STRAVA_SECRET', String(p.client_secret)); return out({ ok: true, url: stravaAuthUrl_() }); }
    if (p.what === 'strava_sync') return out(stravaSync_());
    if (p.what === 'selfty_setup') return out(selftySetup_(p));
    if (p.what === 'selfty_sync') return out(selftySync_());
    return out({ ok: false, error: 'unknown what' });
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

// ---------- setup ----------
function setup_(p) {
  if (p.ntfy_topic) P.setProperty('NTFY_TOPIC', p.ntfy_topic);
  if (p.app_url) P.setProperty('APP_URL', p.app_url);
  const ss = book_();
  sheet_(ss);
  const def = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  installTriggers_();
  return { ok: true, sheet_url: ss.getUrl(), sheet_id: ss.getId(), ntfy: P.getProperty('NTFY_TOPIC') || null, app_url: P.getProperty('APP_URL') || null };
}

function book_() {
  const id = P.getProperty('SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) {} }
  const ss = SpreadsheetApp.create('Palier · données');
  P.setProperty('SHEET_ID', ss.getId());
  return ss;
}

function sheet_(ss) {
  ss = ss || book_();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.getRange(1, 1, 1, HDR.length).setValues([HDR]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('notifMorning').timeBased().atHour(8).nearMinute(0).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('notifEvening').timeBased().atHour(21).nearMinute(30).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('notifWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(18).nearMinute(0).inTimezone(TZ).create();
  ScriptApp.newTrigger('stravaSync_').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('selftySync_').timeBased().everyMinutes(30).create();
}

// ---------- stockage ----------
function readAll_() {
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last < 2) return { rows: [], index: {} };
  const vals = sh.getRange(2, 1, last - 1, HDR.length).getValues();
  const index = {};
  vals.forEach((r, i) => { if (r[0]) index[String(r[0])] = { row: i + 2, updated: Number(r[3]) || 0 }; });
  return { rows: vals, index };
}

function all_(since) {
  const { rows } = readAll_();
  const items = [];
  rows.forEach(r => {
    if (!r[0]) return;
    if (since && Number(r[3]) <= since) return;
    try { const o = JSON.parse(r[5]); if (r[4] === true || r[4] === 'TRUE') o.del = true; items.push(o); } catch (e) {}
  });
  return { ok: true, items, now: Date.now() };
}

function upsert_(items) {
  const r = upsertRows_(items);
  // tâches « call Anaïs » : infos saisies par Alex -> console Selfty, tout de suite
  const pending = (items || []).filter(o => o && o.t === 'task' && o.src === 'selfty' && !o.del && (o.prep || '') !== (o.prep_sent || ''));
  if (pending.length) {
    const upd = [];
    pending.forEach(t => { if (pushPrep_(t)) upd.push(t); });
    if (upd.length) { upsertRows_(upd); r.updated = upd; }
  }
  return r;
}

function upsertRows_(items) {
  if (!items.length) return { ok: true, n: 0 };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const { index } = readAll_();
    let n = 0;
    const appends = [];
    items.forEach(o => {
      if (!o || !o.id) return;
      const row = [o.id, o.t || '', o.d || '', Number(o.u) || Date.now(), !!o.del, JSON.stringify(o)];
      const ex = index[o.id];
      if (ex) {
        if (ex.updated > row[3]) return; // une version plus récente existe déjà
        sh.getRange(ex.row, 1, 1, HDR.length).setValues([row]);
      } else appends.push(row);
      n++;
    });
    if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, HDR.length).setValues(appends);
    return { ok: true, n, now: Date.now() };
  } finally { lock.releaseLock(); }
}

function getItem_(id) {
  const { rows, index } = readAll_();
  const ex = index[id];
  if (!ex) return null;
  try { return JSON.parse(rows[ex.row - 2][5]); } catch (e) { return null; }
}

function itemsOf_(type, date) {
  const { rows } = readAll_();
  const res = [];
  rows.forEach(r => {
    if (r[1] !== type || (r[4] === true || r[4] === 'TRUE')) return;
    if (date && r[2] !== date) return;
    try { res.push(JSON.parse(r[5])); } catch (e) {}
  });
  return res;
}

// ---------- photo (screen Sleep Cycle) ----------
function photo_(p) {
  const folders = DriveApp.getFoldersByName('Palier');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Palier');
  const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime || 'image/jpeg', p.name || ('photo-' + Date.now() + '.jpg'));
  const f = folder.createFile(blob);
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const res = { ok: true, url: 'https://drive.google.com/uc?export=view&id=' + f.getId(), id: f.getId() };
  if (p.ocr) Object.assign(res, ocrSleep_(blob));
  return res;
}

// OCR d'un screen Sleep Cycle via Drive (conversion image -> Google Doc), puis extraction durée + qualité.
function ocrSleep_(blob) {
  let text = '';
  try {
    let doc;
    try { doc = Drive.Files.insert({ title: 'ocr-tmp-' + Date.now() }, blob, { convert: true, ocr: true, ocrLanguage: 'fr' }); }
    catch (e1) { const img = DriveApp.createFile(blob); doc = Drive.Files.copy({ title: 'ocr-tmp-' + Date.now(), mimeType: 'application/vnd.google-apps.document' }, img.getId(), { ocr: true, ocrLanguage: 'fr' }); img.setTrashed(true); }
    text = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + doc.id + '/export?mimeType=text/plain', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }).getContentText();
    Drive.Files.remove(doc.id);
  } catch (e) { return { ocr_error: String(e && e.message || e) }; }
  const t = text.replace(/\s+/g, ' ');
  const out = { ocr_text: t.slice(0, 600) };
  // qualité : « Qualité du sommeil 82 % » (ou « 82% »)
  let m = t.match(/qualit[ée][^0-9]{0,30}(\d{1,3})\s*%/i) || t.match(/(\d{1,3})\s*%/);
  if (m) out.sleep_q = Number(m[1]);
  // durée : « 7 h 24 min », « 7h24 », « 7:24 », « 7 h 24 » ; on prend la première après « sommeil »/« dormi »/« au lit », sinon la première.
  const re = /(\d{1,2})\s*(?:h|:)\s*(\d{2})\s*(?:min)?/g;
  const cands = []; let r; while ((r = re.exec(t))) cands.push({ h: Number(r[1]), m: Number(r[2]), i: r.index });
  const valid = cands.filter(c => c.h >= 3 && c.h <= 14 && c.m < 60);
  if (valid.length) {
    // priorité au temps réellement dormi (« Endormi » / « Asleep »), sinon « Temps au lit », sinon la première durée
    const a1 = t.search(/(endormi|asleep|dormi)/i), a2 = t.search(/(au lit|in bed|sommeil|time)/i);
    const pick = (a1 >= 0 && valid.find(c => c.i > a1)) || (a2 >= 0 && valid.find(c => c.i > a2)) || valid[0];
    out.sleep_h = Math.round((pick.h + pick.m / 60) * 100) / 100;
    const bed = a2 >= 0 && valid.find(c => c.i > a2); if (bed && bed !== pick) out.bed_h = Math.round((bed.h + bed.m / 60) * 100) / 100;
  }
  return out;
}

// Raccourci partage : screen Sleep Cycle -> OCR -> check-in du matin.
function sleepShot_(p) {
  const r = photo_(Object.assign({ ocr: true, name: 'sleep-' + today_() + '.jpg' }, p));
  const date = p.date || today_();
  const id = 'morning-' + date;
  const cur = getItem_(id) || { id, t: 'morning', d: date };
  cur.photo = r.url;
  if (r.sleep_h != null) cur.sleep_h = r.sleep_h;
  if (r.sleep_q != null) cur.sleep_q = r.sleep_q;
  cur.sleep_src = 'sleepcycle-ocr'; cur.u = Date.now();
  upsert_([cur]);
  return Object.assign({ saved: true, date }, r);
}

// ---------- Apple Santé (Raccourci iOS) ----------
function health_(p) {
  const date = p.date || today_();
  const id = 'morning-' + date;
  const cur = getItem_(id) || { id, t: 'morning', d: date };
  if (p.sleep_h != null && p.sleep_h !== '') cur.sleep_h_auto = Number(p.sleep_h);
  if (p.sleep_start) cur.sleep_start = p.sleep_start;
  if (p.sleep_end) cur.sleep_end = p.sleep_end;
  if (p.sleep_q != null && p.sleep_q !== '') cur.sleep_q_auto = Number(p.sleep_q);
  if (p.weight != null && p.weight !== '') cur.weight = Number(p.weight);
  if (p.screen_min != null && p.screen_min !== '') { cur.screen_min = Math.round(Number(p.screen_min)); cur.screen_auto = true; }
  cur.u = Date.now();
  const items = [cur];
  if (p.mindful_min != null && p.mindful_min !== '' && Number(p.mindful_min) > 0) {
    items.push({ id: 'medit-auto-' + date, t: 'medit', d: date, min: Number(p.mindful_min), src: 'health', u: Date.now() });
  }
  return upsert_(items);
}

// ---------- Calls d'Anaïs (Selfty · iClosed) ----------
function selftySetup_(p) {
  if (p.iclosed_key) P.setProperty('ICLOSED_KEY', String(p.iclosed_key).trim());
  if (p.selfty_url) P.setProperty('SELFTY_URL', String(p.selfty_url).trim());
  if (p.selfty_key) P.setProperty('SELFTY_KEY', String(p.selfty_key).trim());
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'selftySync_'))
    ScriptApp.newTrigger('selftySync_').timeBased().everyMinutes(30).create();
  return Object.assign({ ok: true, iclosed: !!P.getProperty('ICLOSED_KEY'), selfty: !!P.getProperty('SELFTY_URL') }, selftySync_());
}

function phone_(v) {
  let s = String(v == null ? '' : v).trim();
  if (!s || s[0] === '#') return '';
  const plus = s[0] === '+';
  const d = s.replace(/\D/g, '');
  if (!d) return '';
  if (plus) return d;
  if (d.indexOf('00') === 0) return d.slice(2);
  if (d[0] === '0' && d.length === 10) return '33' + d.slice(1);
  if (d.length === 9 && '67'.indexOf(d[0]) >= 0) return '33' + d;
  return d;
}

function selftyCalls_() {
  const key = P.getProperty('ICLOSED_KEY');
  if (!key) return null;
  const raw = [];
  for (let page = 0; page < 20; page++) {
    const res = UrlFetchApp.fetch('https://public.api.iclosed.io/v1/eventCalls?limit=100&page=' + page, { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('iClosed ' + res.getResponseCode());
    const batch = ((JSON.parse(res.getContentText()).data || {}).eventCalls) || [];
    batch.forEach(c => raw.push(c));
    if (batch.length < 100) break;
  }
  const seen = {}, calls = [];
  raw.forEach(c => {
    if (!c || !c.id || seen[c.id]) return;
    seen[c.id] = 1;
    const quest = [];
    (c.secondaryAnswers || []).forEach(q => {
      const ans = (q.answer || []).map(a => String(a.answer || '')).filter(Boolean).join(' / ');
      if (ans) quest.push([String(q.statement || '?').trim(), ans]);
    });
    const task = (c.task || [{}])[0] || {};
    calls.push({
      id: c.id, n: String(c.inviteeName || '?').trim(), mail: String(c.inviteeEmail || '').trim().toLowerCase(), tel: phone_(c.phoneNumber),
      utc: c.dateTimeUTC || '', link: c.locationLinkInvitee || '', event: String((c.event || {}).name || '').trim(), closer: String((c.user || {}).firstName || '').trim(),
      cancel: !!c.cancelReason || c.eventType === 'CANCELLED', cancelWhy: String(c.cancelReason || '').trim(),
      notes: String(task.notes || c.notes || '').trim(), quest
    });
  });
  return calls;
}

function addDays_(s, n) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }
function quandCall_(utc, today) {
  const d = new Date(utc), day = Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), h = Utilities.formatDate(d, TZ, 'H\'h\'mm');
  if (day === today) return 'aujourd\'hui ' + h;
  if (day === addDays_(today, 1)) return 'demain ' + h;
  return Utilities.formatDate(d, TZ, 'EEE d MMM') + ' ' + h;
}

function selftySync_() {
  const calls = selftyCalls_();
  if (!calls) return { ok: false, error: 'iClosed non configuré (selfty_setup)' };
  const today = today_(), tmr = addDays_(today, 1), now = Date.now();
  const { rows, index } = readAll_();
  const raw = id => { const ex = index[id]; if (!ex) return null; try { return JSON.parse(rows[ex.row - 2][5]); } catch (e) { return null; } };
  const items = [], created = [], removed = [];
  calls.forEach(c => {
    const id = 'task-selfty-' + c.id;
    const cur = raw(id);
    if (!c.utc) return;
    const day = Utilities.formatDate(new Date(c.utc), TZ, 'yyyy-MM-dd');
    if (c.cancel) {
      if (cur && !cur.del && !cur.done) { cur.del = true; cur.u = now; items.push(cur); removed.push(c.n); }
      return;
    }
    if (new Date(c.utc).getTime() < now) return;           // call déjà passé : on ne touche plus à la tâche
    if (day > tmr && !cur) return;                          // pas encore la veille : rien à créer
    if (cur && (cur.del || cur.done)) return;               // supprimée à la main ou déjà faite
    const info = { id: c.id, n: c.n, mail: c.mail, tel: c.tel, utc: c.utc, link: c.link, event: c.event, closer: c.closer, notes: c.notes, quest: c.quest };
    const title = '📞 Appeler ' + c.n + ' · call Anaïs ' + quandCall_(c.utc, today);
    if (!cur) {
      items.push({ id, t: 'task', d: today, title, client: 'client-anais', imp: 3, urg: 3, est: 15, today, done: false, src: 'selfty', call_id: String(c.id), call: info, prep: '', prep_sent: '', u: now });
      created.push(c.n + ' (' + quandCall_(c.utc, today) + ')');
    } else {
      const want = day <= tmr ? (cur.today && cur.today <= today ? cur.today : today) : addDays_(day, -1);
      if (cur.title !== title || cur.today !== want || JSON.stringify(cur.call) !== JSON.stringify(info)) { cur.title = title; cur.today = want; cur.call = info; cur.u = now; items.push(cur); }
    }
  });
  // infos saisies par Alex pas encore parties vers la console (rattrapage)
  const pushed = [];
  itemsOf_('task').forEach(t => { if (t.src === 'selfty' && (t.prep || '') !== (t.prep_sent || '') && pushPrep_(t)) { pushed.push(t); items.push(t); } });
  if (items.length) upsertRows_(items);
  if (created.length) ntfy_('À appeler aujourd\'hui avant les calls d\'Anaïs :\n' + created.map(x => '• ' + x).join('\n') + '\n\nInfos du lead dans la tâche, note tes infos pour le call : elles partent dans la console Selfty.', 'Calls Anaïs 📞', 'telephone_receiver', 4);
  return { ok: true, calls: calls.length, created: created.length, updated: items.length - created.length - pushed.length, removed: removed.length, pushed: pushed.length };
}

function pushPrep_(t) {
  const url = P.getProperty('SELFTY_URL'), key = P.getProperty('SELFTY_KEY');
  if (!url || !key || !t.call_id) return false;
  const c = t.call || {};
  try {
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain', followRedirects: true, muteHttpExceptions: true,
      payload: JSON.stringify({ key, what: 'call_prep', id: t.call_id, nom: c.n, email: c.mail, tel: c.tel, utc: c.utc, prep: t.prep || '' }) });
    const j = JSON.parse(res.getContentText());
    if (!j.ok) return false;
    t.prep_sent = t.prep || ''; t.prep_sent_at = new Date().toISOString(); t.u = Date.now();
    return true;
  } catch (e) { return false; }
}

// ---------- ntfy ----------
function ntfy_(msg, title, tags, prio) {
  const topic = P.getProperty('NTFY_TOPIC');
  if (!topic) return false;
  const headers = { 'Title': title || 'Palier', 'Priority': String(prio || 3) };
  if (tags) headers['Tags'] = tags;
  const app = P.getProperty('APP_URL');
  if (app) headers['Click'] = app;
  try {
    UrlFetchApp.fetch('https://ntfy.sh/' + topic, { method: 'post', payload: msg, headers, muteHttpExceptions: true });
    return true;
  } catch (e) { return false; }
}

function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function notifMorning() {
  const d = today_();
  const tasks = itemsOf_('task').filter(t => !t.done && t.today === d);
  tasks.sort((a, b) => ((b.imp || 2) * (b.urg || 2)) - ((a.imp || 2) * (a.urg || 2)));
  const list = tasks.slice(0, 4).map(t => '• ' + t.title).join('\n');
  const msg = 'Check-in du matin : sommeil, poids, écran.' + (tasks.length ? '\n\n' + tasks.length + ' tâche(s) aujourd\'hui :\n' + list : '\n\nAucune tâche prévue : choisis ta priorité du jour.');
  ntfy_(msg, 'Bonjour ☀️', 'sunrise');
}

function notifEvening() {
  const d = today_();
  const tasks = itemsOf_('task').filter(t => t.today === d);
  const done = tasks.filter(t => t.done).length;
  const eve = itemsOf_('evening', d);
  if (eve.length) return;
  const sport = ['workout', 'run', 'boxe'].reduce((n, t) => n + itemsOf_(t, d).length, 0);
  const msg = 'Bilan du soir : gratitude, énergie, apprentissage, action de demain.\n' + done + '/' + tasks.length + ' tâche(s) faite(s)' + (sport ? ' · sport ✔' : '');
  ntfy_(msg, 'Bilan du soir 🌙', 'crescent_moon');
}

function notifWeekly() {
  ntfy_('Bilan hebdo : objectifs par catégorie, goulots par client, plan d\'action de la semaine.', 'Bilan de la semaine 📈', 'chart_with_upwards_trend', 4);
}

// ---------- Strava ----------
function webAppUrl_() { return ScriptApp.getService().getUrl(); }

function stravaAuthUrl_() {
  const id = P.getProperty('STRAVA_ID');
  if (!id) return null;
  return 'https://www.strava.com/oauth/authorize?client_id=' + id + '&response_type=code&redirect_uri=' + encodeURIComponent(webAppUrl_()) + '&approval_prompt=force&scope=activity:read_all';
}

function stravaCallback_(q) {
  const res = UrlFetchApp.fetch('https://www.strava.com/oauth/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { client_id: P.getProperty('STRAVA_ID'), client_secret: P.getProperty('STRAVA_SECRET'), code: q.code, grant_type: 'authorization_code' }
  });
  const j = JSON.parse(res.getContentText());
  if (!j.refresh_token) return HtmlService.createHtmlOutput('<p style="font-family:sans-serif">Erreur Strava : ' + res.getContentText() + '</p>');
  P.setProperty('STRAVA_REFRESH', j.refresh_token);
  P.setProperty('STRAVA_ACCESS', j.access_token);
  P.setProperty('STRAVA_EXP', String(j.expires_at));
  const r = stravaSync_();
  return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;font-size:18px">✅ Strava connecté à Palier. ' + (r.n || 0) + ' course(s) importée(s). Tu peux fermer cette page.</p>');
}

function stravaToken_() {
  const exp = Number(P.getProperty('STRAVA_EXP') || 0);
  if (exp > Date.now() / 1000 + 120) return P.getProperty('STRAVA_ACCESS');
  const rt = P.getProperty('STRAVA_REFRESH');
  if (!rt) return null;
  const res = UrlFetchApp.fetch('https://www.strava.com/oauth/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { client_id: P.getProperty('STRAVA_ID'), client_secret: P.getProperty('STRAVA_SECRET'), refresh_token: rt, grant_type: 'refresh_token' }
  });
  const j = JSON.parse(res.getContentText());
  if (!j.access_token) return null;
  P.setProperty('STRAVA_ACCESS', j.access_token);
  P.setProperty('STRAVA_EXP', String(j.expires_at));
  if (j.refresh_token) P.setProperty('STRAVA_REFRESH', j.refresh_token);
  return j.access_token;
}

function stravaSync_() {
  const tok = stravaToken_();
  if (!tok) return { ok: false, error: 'strava non connecté' };
  const after = Math.floor((Date.now() - 45 * 86400000) / 1000);
  const res = UrlFetchApp.fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50&after=' + after, { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, error: 'strava ' + res.getResponseCode() };
  const acts = JSON.parse(res.getContentText());
  const { index } = readAll_();
  const items = [];
  acts.forEach(a => {
    const type = (a.sport_type || a.type || '');
    if (!/run/i.test(type)) return;
    const id = 'run-strava-' + a.id;
    if (index[id]) return; // déjà importée (le ressenti ajouté par Alex reste intact)
    const d = Utilities.formatDate(new Date(a.start_date), TZ, 'yyyy-MM-dd');
    const km = Math.round(a.distance / 10) / 100;
    const min = Math.round(a.moving_time / 6) / 10;
    items.push({ id, t: 'run', d, km, min, pace: km ? Math.round(min / km * 100) / 100 : null, title: a.name, hr: a.average_heartrate || null, src: 'strava', strava_id: a.id, u: Date.now() });
  });
  if (items.length) { upsert_(items); ntfy_(items.map(i => '🏃 ' + i.km + ' km en ' + i.min + ' min (' + pace_(i.pace) + '/km)').join('\n') + '\n\nAjoute ton ressenti dans Palier.', 'Run importé depuis Strava', 'running_shoe'); }
  return { ok: true, n: items.length };
}

function pace_(p) { if (!p) return '–'; const m = Math.floor(p), s = Math.round((p - m) * 60); return m + ':' + (s < 10 ? '0' : '') + s; }

function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// À lancer UNE fois dans l'éditeur (bouton Exécuter) pour accorder les accès Sheets / Drive / réseau / triggers.
function autoriser() {
  const ss = book_(); sheet_(ss);
  DriveApp.getRootFolder().getName();
  UrlFetchApp.fetch('https://ntfy.sh', { muteHttpExceptions: true });
  installTriggers_();
  Logger.log('OK · Sheet : ' + ss.getUrl());
}
