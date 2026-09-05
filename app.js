/* Palier · démarrage, navigation, réglages. */
const VIEW = { tab: 'today', clientId: null, sport: 'muscu', bilan: 'semaine', range: 30 };
function render() {
  const root = document.getElementById('view');
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === VIEW.tab));
  const fab = document.querySelector('.fab'); if (fab) fab.remove();
  ({ today: renderToday, clients: renderClients, sport: renderSport, suivi: renderSuivi, bilan: renderBilan })[VIEW.tab](root);
  const st = document.getElementById('streak'); if (st) st.textContent = '🔥 ' + streakWeeks();
}
function settingsSheet() {
  const s = settings();
  const sh = openSheet('Réglages', `
    <div class="grid3"><div><label class="f">Calories / jour</label><input class="in num" type="number" data-kcal value="${s.kcal}"></div><div><label class="f">Protéines (g)</label><input class="in num" type="number" data-prot value="${s.prot}"></div><div><label class="f">Travail max (h/sem)</label><input class="in num" type="number" data-hours value="${s.hours_week}"></div></div>
    <div class="grid2"><div><label class="f">Début du programme run</label><input class="in" type="date" data-runstart value="${s.run_start}"></div><div><label class="f">5 km actuel (min)</label><input class="in num" type="number" step="0.1" data-run5k value="${s.run_5k}"></div></div>
    <button class="btn p wide mt" data-save>Enregistrer</button>
    <div class="sec"><h2>🔔 Notifications (ntfy)</h2></div>
    <div class="small">1. Installe l'appli <b>ntfy</b> (App Store). 2. Abonne-toi au sujet <b>${esc(s.ntfy)}</b>. 3. Tu reçois : check-in 8h, bilan 21h30, bilan hebdo dimanche 18h, runs Strava importés.</div>
    <button class="btn sm mt" data-ntfy>Envoyer une notif de test</button>
    <div class="sec"><h2>🏃 Strava</h2></div>
    <div class="small">Crée une app sur <a href="https://www.strava.com/settings/api" target="_blank">strava.com/settings/api</a> (domaine de callback : <b>script.google.com</b>), puis colle l'ID et le secret ici.</div>
    <div class="grid2"><input class="in" data-sid placeholder="Client ID"><input class="in" data-ssec placeholder="Client Secret"></div>
    <button class="btn sm mt" data-strava>Connecter Strava</button> <button class="btn sm mt ghost" data-ssync>Synchroniser maintenant</button>
    <div class="sec"><h2>📱 Apple Santé (Raccourci iOS)</h2></div>
    <div class="small">Le Raccourci « Palier Santé » envoie chaque matin sommeil (Sleep Cycle → Santé), méditation (Petit Bambou → Santé) et poids. Mode d'emploi dans le README du projet. Adresse à utiliser dans le Raccourci :</div>
    <input class="in small" readonly value="${esc(BRIDGE.url)}" onclick="this.select()">
    <div class="sec"><h2>💾 Données</h2></div>
    <div class="row wrap"><button class="btn sm" data-pull>Resynchroniser tout</button><button class="btn sm" data-export>Exporter (JSON)</button><span class="small muted">${Object.keys(DB.items).length} éléments · ${DB.outbox.length} en attente</span></div>`);
  sh.querySelector('[data-save]').addEventListener('click', () => { const o = settings(); o.kcal = nval(sh, '[data-kcal]') || 2400; o.prot = nval(sh, '[data-prot]') || 160; o.hours_week = nval(sh, '[data-hours]') || 30; o.run_start = val(sh, '[data-runstart]') || o.run_start; o.run_5k = nval(sh, '[data-run5k]') || 30; put(o); sh.close(); render(); toast('Réglages enregistrés'); });
  sh.querySelector('[data-ntfy]').addEventListener('click', async () => { const r = await post({ what: 'ntfy_test' }); toast(r.ok ? 'Notif envoyée' : 'Échec : ' + (r.error || '')); });
  sh.querySelector('[data-strava]').addEventListener('click', async () => { const id = val(sh, '[data-sid]'), sec = val(sh, '[data-ssec]'); if (!id || !sec) return toast('ID et secret ?'); const r = await post({ what: 'strava_setup', client_id: id, client_secret: sec }); if (r.ok && r.url) window.open(r.url, '_blank'); else toast('Échec : ' + (r.error || '')); });
  sh.querySelector('[data-ssync]').addEventListener('click', async () => { const r = await post({ what: 'strava_sync' }); toast(r.ok ? r.n + ' run(s) importé(s)' : 'Échec : ' + (r.error || '')); pull(); });
  sh.querySelector('[data-pull]').addEventListener('click', () => { pull(true); toast('Synchro…'); });
  sh.querySelector('[data-export]').addEventListener('click', () => { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(all())); a.download = 'palier-' + today() + '.json'; a.click(); });
}
function init() {
  loadDB(); seedIfEmpty();
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { VIEW.tab = b.dataset.tab; VIEW.clientId = null; render(); window.scrollTo(0, 0); }));
  document.getElementById('btn-settings').addEventListener('click', settingsSheet);
  document.getElementById('btn-idea').addEventListener('click', () => ideaSheet());
  render();
  pull(!DB.lastSync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { pull(); render(); } });
  setInterval(pull, 120000);
  window.addEventListener('online', flush);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', init);
