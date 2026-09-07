# Raccourci iOS « Palier Santé » (sommeil Sleep Cycle + méditation Petit Bambou)

Ni Sleep Cycle ni Petit Bambou n'ont d'API. Les deux savent écrire dans Apple Santé, et un Raccourci iOS peut lire Santé et l'envoyer à Palier chaque matin. 5 minutes, une seule fois, sur l'iPhone.

## 0. Activer les exports vers Santé
- **Sleep Cycle** → Profil → Réglages → *Apple Health* → activer « Analyse du sommeil » (écriture).
- **Petit Bambou** → Profil → Réglages → *Apple Santé* → activer « Minutes de pleine conscience ».
- Santé → Profil → Apps → vérifier que les deux ont l'autorisation d'écrire.

## 1. Créer le Raccourci
Ouvrir **Raccourcis** → **+** → nommer « Palier Santé ». Ajouter les actions dans cet ordre (chercher chaque action par son nom) :

1. **Date** → « Date actuelle ».
2. **Formater la date** : format *Personnalisé*, chaîne `yyyy-MM-dd`. Renommer le résultat `jour` (appui long sur la variable → Renommer).
3. **Trouver des échantillons de santé** :
   - Type : **Analyse du sommeil**
   - Filtres : *Date de début* est **dans les dernières 18 heures** ; *Valeur* est **Endormi** (ou « Asleep »)
   - Trier par : Date de début, Croissant, sans limite.
4. **Calculer des statistiques** sur les échantillons trouvés : **Somme** → résultat = durée totale (en minutes ou heures selon l'unité affichée). Renommer `sommeil`.
   - Si le résultat est en minutes : ajouter **Calculer** `sommeil ÷ 60`.
5. **Trouver des échantillons de santé** : Type **Minutes de pleine conscience**, filtre *Date de début* est **aujourd'hui** (ou dernières 18 h).
6. **Calculer des statistiques** : Somme → renommer `meditation` (0 si rien).
7. **Obtenir le contenu de l'URL** :
   - URL : `https://script.google.com/macros/s/AKfycbzbiutY5E4Y3qoTtCPx08txUJ0zuGWSfGhn5r_jNYZ_qYPrcIIKOL8UtBGjwntZ0pB2NQ/exec`
   - Méthode : **POST** · Corps de la requête : **JSON**
   - Champs (texte) : `key` = `palier-7f3c9a2e5b1d4c8e` · `what` = `health` · `date` = variable `jour` · `sleep_h` = variable `sommeil` · `mindful_min` = variable `meditation`
8. (Facultatif) **Afficher une notification** avec le résultat pour vérifier la première fois.

Lancer une fois à la main : Palier → tuile Matin doit afficher le sommeil en bandeau « Apple Santé ».

## 2. Automatiser
Raccourcis → onglet **Automatisation** → **+** → **Heure de la journée** : 7h30, tous les jours → « Exécuter immédiatement » (désactiver « Demander avant d'exécuter ») → choisir « Palier Santé ».

## Si les chiffres Santé ≠ Sleep Cycle
C'est que Sleep Cycle n'écrit pas (étape 0) et que Santé prend le sommeil estimé par l'iPhone. Dans ce cas, le check-in du matin permet de corriger la valeur à la main et de joindre le screen Sleep Cycle.

## Temps d'écran (côté Mac, automatique)
Apple n'expose pas le Temps d'écran aux apps ni aux Raccourcis. Palier passe par le Mac :
1. iPhone : Réglages → Temps d'écran → **Partager entre les appareils** : activé. Idem sur le Mac (Réglages Système → Temps d'écran).
2. Mac : Réglages Système → Confidentialité et sécurité → **Accès complet au disque** → **+** → ajouter `~/Applications/Palier Écran.app` (Cmd+Maj+G puis coller `/Users/alex/Applications`).
3. Test : double-clic sur « Palier Écran » dans ~/Applications, puis vérifier `~/Library/Logs/palier-ecran.log`.
Ensuite, chaque jour à 7h50 (Mac allumé ou en veille avec Power Nap), le total d'hier arrive dans le check-in du matin.
