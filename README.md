# Palier

Appli perso de pilotage d'Alex : clients & to-do priorisée, sport (muscu, run 5 km en 20 min, boxe, méditation), nutrition, sommeil, poids, temps de travail (< 30 h/sem, part « liberté future »), bilan du soir, bilan hebdo, objectifs, idées.

- **Appli** : https://alexyoucompte99-lang.github.io/palier/ (PWA : sur iPhone, Safari → Partager → « Sur l'écran d'accueil »)
- **Données** : Google Sheet « Palier · données » (créé par le pont), onglet `Items` (une ligne par élément, JSON). Copie locale dans le navigateur, synchro à chaque changement, hors ligne OK.
- **Pont Apps Script** : dossier `pont/` (`clasp push -f` puis `clasp deploy -i AKfycbzbiutY5E4Y3qoTtCPx08txUJ0zuGWSfGhn5r_jNYZ_qYPrcIIKOL8UtBGjwntZ0pB2NQ -d "vN …"`, même URL). Script : https://script.google.com/d/1lT4Pk2mwGVqchHVxjSS_6uLUIPx89MRWERiBely6ejHc9eL8R9_BtW9e/edit

## Première mise en route (une fois)

1. **Autoriser le pont** : ouvrir le script (lien ci-dessus), choisir la fonction `autoriser` dans la barre du haut, cliquer **Exécuter**, accepter les accès (Sheets, Drive, réseau, déclencheurs). Ça crée le Sheet et installe les rappels. Tant que ce n'est pas fait, l'appli marche en local mais ne synchronise pas (point rouge en haut à droite).
2. **Notifs** : installer l'appli **ntfy** (App Store), s'abonner au sujet `palier-alex-q7m2x9`. Rappels : check-in 8h, bilan du soir 21h30, bilan hebdo dimanche 18h, runs Strava importés. Test : ⚙︎ → « Envoyer une notif de test ».
3. **Strava** : https://www.strava.com/settings/api → créer une app (nom Palier, site web = l'URL de l'appli, **Authorization Callback Domain = `script.google.com`**). Copier Client ID + Client Secret dans ⚙︎ → « Connecter Strava » → accepter sur Strava. Ensuite les courses arrivent seules (toutes les 15 min), il ne reste que le ressenti à ajouter.
4. **Apple Santé (sommeil + méditation)** : créer un Raccourci iOS « Palier Santé » :
   - « Trouver des échantillons de santé » : type *Sommeil*, hier soir → aujourd'hui → « Obtenir les détails » → Durée (heures) → variable `sommeil`.
   - « Trouver des échantillons de santé » : type *Minutes de pleine conscience*, aujourd'hui → « Calculer des statistiques » (somme) → `meditation`.
   - « Obtenir le contenu de l'URL » : URL = adresse du pont (⚙︎ → Apple Santé), méthode POST, corps JSON :
     `{"key":"palier-7f3c9a2e5b1d4c8e","what":"health","date":"<date du jour aaaa-mm-jj>","sleep_h":<sommeil>,"mindful_min":<meditation>}`
   - Automatisation : chaque jour à 7h30, « Exécuter immédiatement ».
   Activer l'export vers Apple Santé dans Sleep Cycle et dans Petit Bambou. Backup : le check-in du matin permet toujours de saisir à la main + screen Sleep Cycle.
5. **Temps d'écran** : pas d'API Apple. Champ « écran hier » dans le check-in du matin.

## Structure

`index.html` + `style.css` + `core.js` (stockage, synchro, référentiel clients, stats) + `charts.js` (SVG) + `today.js` / `clients.js` / `sport.js` / `suivi.js` / `bilan.js` (onglets) + `app.js` (navigation, réglages). `sw.js` + `manifest.webmanifest` = PWA. `make_icons.py` = logo.

Types d'éléments : task, meal, morning, evening, workout, plan, run, boxe, medit, work (chrono), chrono, client, deal, goal, weekly, idea, settings.

Règles : temps de travail = chronos + minutes saisies sur les tâches (sauf celles cochées pendant un chrono). Horizon par client : court terme / liberté future / perso (non compté). Streak = semaines d'affilée avec ≥ 3 jours de sport. Programme run : 12 semaines à partir de `run_start`, allures interpolées entre l'estimation 5 km actuelle (dernier run coché « test 5 km ») et 4:00/km.
