# 🎬 MovieZ - Votre Plateforme Personnelle de Films & Séries

Application web moderne, rapide et autonome pour visionner des films et des séries en streaming sans pub intrusive, avec suivi de progression, liste d'envies, notifications et diffusion TV.

---

## 🌟 Nouvelles fonctionnalités installées

1. **🕒 Reprendre la lecture (Historique intelligent)** :
   - Sauvegarde automatique dès qu'un film ou épisode est lancé.
   - Pour les séries, mémorise exactement la **dernière saison et le dernier épisode regardé** (ex. `S2 E4`) avec reprise directe.
   - Possibilité de marquer un titre comme « Vu » ou de le supprimer de l'historique en un clic.
   - Onglet dédié **Reprendre** avec compteur dynamique.

2. **⭐ Ma Liste (Wishlist) & Alertes de sorties** :
   - Bouton étoile `★` sur chaque affiche ou dans le lecteur pour ajouter/retirer des titres.
   - Onglet dédié **Ma Liste**.
   - Cloche de notification 🔔 prévenant automatiquement dès qu'un film ou une série de votre liste atteint sa date de sortie officielle.
   - Support des notifications de bureau du navigateur.

3. **🛡️ Protection Anti Pop-ups & Pubs** :
   - Le lecteur utilise un bac à sable sécurisé HTML5 (`sandbox`) interdisant physiquement aux lecteurs hébergés d'ouvrir de nouveaux onglets publicitaires.

4. **📺 Cast TV & Réseau Local** :
   - **Smart TV / Box Android / Téléphone** : accessible sur n'importe quel appareil connecté au même Wi-Fi via l'adresse locale : `http://192.168.1.8:3000`.
   - **Google Cast / Chromecast** : clic-droit > « Caster... » depuis Google Chrome ou Brave.
   - Fenêtre d'aide et de copie d'URL accessible via l'icône TV dans la barre du haut.

5. **⚡ Démarrage automatique au démarrage du PC & Raccourci Bureau** :
   - Service d'arrière-plan Linux (`moviez.service`) activé via `systemd` : le serveur démarre tout seul dès l'allumage de votre ordinateur, sans terminal !
   - Raccourci **MovieZ** disponible sur votre **Bureau** (`~/Bureau/MovieZ.desktop`) et dans votre menu d'applications.
