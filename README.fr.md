<div align="center">

<img src="build/icon.png" width="96" alt="Icône de Cardfall">

# Cardfall

**Un idler de cartes à collectionner Steam, calme et sécurisé, pour Windows.**
Connecte-toi avec un code QR, laisse tes jeux « tourner » et regarde les cartes tomber.

[![CI](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml/badge.svg)](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/blgymtr/cardfall)](https://github.com/blgymtr/cardfall/releases/latest)
[![Licence : MIT](https://img.shields.io/badge/licence-MIT-green.svg)](LICENSE)

[English](README.md) · [Deutsch](README.de.md) · [Türkçe](README.tr.md) · [Italiano](README.it.md) · **Français** · [Español](README.es.md)

<img src="docs/screenshots/app-dark.png" alt="Fenêtre principale de Cardfall (données de démo)" width="860">

</div>

## Téléchargement

Télécharge l'installateur depuis la [dernière version](https://github.com/blgymtr/cardfall/releases/latest) (`Cardfall-Setup-<version>.exe`, Windows 10/11, 64 bits).
L'installateur **n'est pas signé** : Windows SmartScreen peut afficher un avertissement au premier lancement (Informations complémentaires → Exécuter quand même). La somme SHA-256 figure dans la release.

## Fonctions

- **Connexion par QR.** Ton mot de passe Steam n'est jamais saisi ni stocké.
- **Exécution intelligente.** Les jeux sous 2 heures ensemble (jusqu'à 32), puis un par un. Ou de 1 à 32 jeux fixes.
- **Jeux bloqués rétrogradés.** Un jeu au-delà de 2 heures qui ne donne plus de cartes passe en fin de file après la durée choisie.
- **Contrôle total.** Pause et reprise, jeu suivant, lancement immédiat d'un jeu, jeux masqués.
- **Infos de jeu toujours à jour.** Visuel de chaque jeu (avec repli sur l'image actuelle de la boutique), description, genres, développeur et date de sortie au clic. Images et infos sont actualisées en arrière-plan tous les 7 jours.
- **Chiffres et statistiques en direct :** temps d'exécution, cartes restantes, file, cartes obtenues, jeux lancés, jeux avec et sans drops, graphique sur 14 jours, valeur estimée d'après le Marché Steam.
- **Démarrage avec Windows** (masqué, attend la phrase secrète) et **mode zone de notification**.
- **Six langues** (English, Deutsch, Türkçe, Italiano, Français, Español), thème clair et sombre.
- **Données et confidentialité :** session actuelle, effacement du journal, de l'historique et du cache, réinitialisation des statistiques, déconnexion complète du compte et suppression définitive (les fichiers sont d'abord écrasés par des données aléatoires).

## Sécurité

Coffre chiffré (AES-256-GCM, scrypt N=2^17 + Windows DPAPI), phrase secrète d'au moins 10 caractères, tentatives limitées (coffre supprimé après 10 échecs), verrouillage automatique avec effacement de la clé en mémoire, données locales chiffrées, interface isolée sans accès à Internet (CSP stricte, sandbox, IPC limitée), réseau uniquement vers des adresses Steam autorisées, Electron durci, aucune télémétrie. Détails dans la [politique de sécurité](SECURITY.md) et le [README anglais](README.md#security).

## Pour commencer

1. Installe et lance Cardfall.
2. Choisis une phrase secrète : elle protège la session Steam enregistrée sur cet ordinateur.
3. Dans l'application Steam de ton téléphone, ouvre **Steam Guard**, scanne le code QR affiché par Cardfall et valide.

## À savoir

Steam ne distribue pas de cartes avant environ **2 heures** de jeu. Les drops sont aléatoires et décidés par Steam. Si tu lances un jeu ailleurs avec le même compte, Cardfall attend. Les valeurs estimées sont indicatives. Tes données sont dans `%APPDATA%\Cardfall` et se gèrent dans **Paramètres → Données et confidentialité**.

## Avertissement

Cardfall est un projet de loisir indépendant, non affilié à Valve Corporation. Tu l'utilises à tes risques et tu es responsable du respect de l'Accord de souscription Steam.

## Licence

[MIT](LICENSE) © 2026 Ömer
