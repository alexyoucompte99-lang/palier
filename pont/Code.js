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
//   photo        { name, data(base64), mime } -> { url } (dossier Drive « Palier »)
//   health       { date, sleep_h, sleep_start, sleep_end, sleep_q, mindful_min, weight }  (Raccourci iOS)
//   ntfy_test    {}
//   strava_setup { client_id, client_secret }
//   strava_sync  {}

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
    if (p.what === 'ntfy_test') return out({ ok: ntfy_('Palier : notification de test 👌', 'Test') });
    if (p.what === 'strava_setup') { P.setProperty('STRAVA_ID', String(p.client_id)); P.setProperty('STRAVA_SECRET', String(p.client_secret)); return out({ ok: true, url: stravaAuthUrl_() }); }
    if (p.what === 'strava_sync') return out(stravaSync_());
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
  return { ok: true, url: 'https://drive.google.com/uc?export=view&id=' + f.getId(), id: f.getId() };
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
  cur.u = Date.now();
  const items = [cur];
  if (p.mindful_min != null && p.mindful_min !== '' && Number(p.mindful_min) > 0) {
    items.push({ id: 'medit-auto-' + date, t: 'medit', d: date, min: Number(p.mindful_min), src: 'health', u: Date.now() });
  }
  return upsert_(items);
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
