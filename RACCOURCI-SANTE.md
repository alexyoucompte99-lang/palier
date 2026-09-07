# Sommeil, méditation et temps d'écran : comment ça remonte dans Palier

## Sommeil : les vrais chiffres Sleep Cycle, par screen (recommandé)
Sleep Cycle n'a pas d'API et ses chiffres ne sont pas ceux d'Apple Santé. Palier lit donc directement le screen de Sleep Cycle (OCR côté Google Drive) : qualité en %, temps endormi, temps au lit.

**Option A · dans Palier (2 taps)** : tuile ☀️ Matin → « Screen Sleep Cycle » → choisir le screen du matin → les champs Sommeil et Qualité se remplissent seuls, tu vérifies et tu enregistres.

**Option B · depuis la feuille de partage (Raccourci « Palier Sommeil », 3 actions)** : tu fais le screen dans Sleep Cycle, tu le partages vers le Raccourci, c'est envoyé et rangé dans le check-in du jour.
1. Raccourcis → + → nom « Palier Sommeil » → Détails → activer **Afficher dans la feuille de partage** (types : Images).
2. Action **Encoder en Base64** sur « Entrée du raccourci ».
3. Action **Obtenir le contenu de l'URL** :
   - URL `https://script.google.com/macros/s/AKfycbzbiutY5E4Y3qoTtCPx08txUJ0zuGWSfGhn5r_jNYZ_qYPrcIIKOL8UtBGjwntZ0pB2NQ/exec`
   - Méthode **POST**, corps **JSON**, champs texte : `key` = `palier-7f3c9a2e5b1d4c8e` · `what` = `sleep_shot` · `mime` = `image/jpeg` · `data` = (variable *Texte encodé en Base64*)
4. Action **Afficher une notification** avec le résultat (facultatif).
Usage : screen de Sleep Cycle → Photos → Partager → « Palier Sommeil ». Ou depuis le bouton Partager de Sleep Cycle si l'image est proposée.

Backup : saisie à la main dans la tuile Matin (2 chiffres).

## Méditation (Petit Bambou)
Petit Bambou n'a pas d'API. Deux choix :
- bouton « Médit. » sur l'accueil (1 tap + durée), ou
- Petit Bambou → Réglages → Apple Santé activé, puis un Raccourci « Palier Santé » (Trouver des échantillons de santé : Minutes de pleine conscience, aujourd'hui → Calculer des statistiques : Somme → Obtenir le contenu de l'URL POST JSON `key`, `what` = `health`, `date` = date du jour formatée `yyyy-MM-dd`, `mindful_min` = somme), automatisé à 21h.

## Temps d'écran de l'iPhone (automatique via le Mac)
Apple n'expose pas le Temps d'écran aux apps ni aux Raccourcis. Palier passe par le Mac, qui reçoit les données de l'iPhone quand le partage est activé. Seul le total iPhone est envoyé (le Mac n'est pas compté).
1. iPhone : Réglages → Temps d'écran → **Partager entre les appareils** activé. Mac : Réglages Système → Temps d'écran → idem.
2. Mac : Réglages Système → Confidentialité et sécurité → **Accès complet au disque** → **+** → Cmd+Maj+G → `/Users/alex/Applications` → « Palier Écran ».
3. Test : double-clic sur « Palier Écran » dans ~/Applications, puis lire `~/Library/Logs/palier-ecran.log`.
Ensuite tous les jours à 7h50, le total d'hier arrive dans le check-in du matin (champ « écran hier », modifiable).
