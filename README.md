<div align="center">

<img src="build/icon.png" width="96" alt="Cardfall icon">

# Cardfall

**A calm, secure Steam trading card idler for Windows.**
Sign in with a QR code, let your games "play", watch the cards drop.

[![CI](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml/badge.svg)](https://github.com/blgymtr/cardfall/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/blgymtr/cardfall)](https://github.com/blgymtr/cardfall/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**English** · [Deutsch](README.de.md) · [Türkçe](README.tr.md) · [Italiano](README.it.md) · [Français](README.fr.md) · [Español](README.es.md)

<img src="docs/screenshots/app-dark.png" alt="Cardfall main window (demo data)" width="860">

<sub>Screenshots use built-in demo data.</sub>

</div>

## Download

Get the installer from the [latest release](https://github.com/blgymtr/cardfall/releases/latest)
(`Cardfall-Setup-<version>.exe`, Windows 10/11, 64-bit). The installer is **not code-signed**, so Windows SmartScreen
may warn you on first run (More info → Run anyway). Compare the SHA-256 checksum listed in the release if you like.

## Features

- **QR sign-in.** Your Steam password is never typed into or stored by Cardfall.
- **Smart idling.** Games under 2 hours run together (up to 32), then one at a time. Fixed 1 to 32 games is available too.
- **Stalled games are demoted.** A game past 2 hours that stops dropping cards moves to the end of the queue after a time you choose.
- **Full control.** Pause and resume, jump to the next game, run a specific game right now, hide games from the queue.
- **Game info that stays fresh.** Every game shows its artwork, with a fallback to the store's current image when the classic URL is missing. Click a game for its description, genres, developer and release date. Images and info are cached and refreshed in the background every 7 days.
- **Live numbers and statistics.** Running time (session and total), cards left, queue size, cards dropped, games run, games with and without drops, a 14-day chart, top games, recent drops and an estimated value from the Steam Market (net of Steam's fee).
- **Refresh button** and automatic refresh that re-reads your badges and counts new drops.
- **Plays nice with Steam.** If you start a game elsewhere on your account, Cardfall waits and resumes when it is free.
- **Start with Windows** (hidden, waits for your passphrase) and **tray mode**: closing the window while idling keeps running and locks the interface.
- **Six languages**: English, Deutsch, Türkçe, Italiano, Français, Español. Light and dark theme.
- **Data & privacy tools.** View the current session, clear the activity log, delete the drop history, clear the cache, reset statistics, sign out, sign out completely (deletes all account data) or delete everything. Deletions overwrite the files with random data first.

## Security

| Measure | Details |
|---|---|
| No password, QR instead | Your Steam password never enters the app |
| Encrypted vault | The Steam refresh key is encrypted with AES-256-GCM using a key derived from your passphrase (scrypt, N=2^17) and wrapped with Windows DPAPI. Older vaults are upgraded automatically |
| Passphrase policy | At least 10 characters, common and trivial passphrases are rejected |
| Attempt limit | Back-off from the 2nd wrong attempt, the vault is deleted after 10. The counter lives inside the vault file |
| Auto-lock | On idle, Windows lock, suspend, optionally on minimize and when hidden to the tray. Idling continues while locked |
| Keys leave memory when locked | The encryption key is wiped on lock and re-derived on unlock |
| Nothing leaks while locked | The locked UI receives no game list or account data |
| Sealed local data | Settings, statistics and history are encrypted with Windows DPAPI |
| Isolated UI | `contextIsolation`, sandbox, no Node, strict CSP with `connect-src 'none'` and Trusted Types, the UI cannot reach the internet |
| Narrow, rate-limited IPC | Only validated calls from the app's own page are accepted, at most 50 per second |
| Network allow-list | Only `steamcommunity.com`, `store.steampowered.com`, `api.steampowered.com` and the Steam image CDN over HTTPS, with TLS verification forced on |
| Hardened Electron | `RunAsNode` and `--inspect` off, load from asar only, asar integrity check, no permissions, no webviews |
| Optional screen-capture block | The window can be hidden from screenshots and screen sharing |
| Permanent deletion | Files are overwritten with random data before they are removed |
| Supply chain | Dependencies audited (0 known vulnerabilities in production), Dependabot, release builds with provenance attestation |
| Private | No telemetry, no ads, no update pings, no open ports |

Read the [security policy](SECURITY.md) for the threat model and how to report an issue.

## Getting started

1. Install and start Cardfall.
2. Choose a passphrase. It protects your saved Steam session on this computer.
3. In the Steam app on your phone open **Steam Guard** and scan the QR code shown by Cardfall, then approve.
4. Cardfall reads your badges and starts idling. That's it.

<details>
<summary>More screenshots</summary>

<img src="docs/screenshots/app-light.png" alt="Light theme" width="720">
<img src="docs/screenshots/stats.png" alt="Statistics" width="720">
<img src="docs/screenshots/gameinfo.png" alt="Game info" width="720">
<img src="docs/screenshots/login.png" alt="QR sign-in" width="720">
<img src="docs/screenshots/settings.png" alt="Settings" width="720">

</details>

## Good to know

- Steam gives no drops for a game before about **2 hours** of play time. New games therefore start dropping later.
- Drops are random and decided by Steam. Cardfall keeps your games "in game", it does not control when a card appears.
- If you launch a game on the same PC, Steam asks to stop the other session. Cardfall detects it and waits.
- Estimated values come from current Steam Market listings and are only a rough guide. Prices are fetched slowly because the Market rate-limits requests.
- Your data lives in `%APPDATA%\Cardfall`. **Settings → Data & privacy** manages and deletes it.
- Overwriting before deleting is a best effort: on SSDs, wear levelling can keep old blocks. The Steam key is always stored encrypted anyway.

## Disclaimer

Cardfall is an independent hobby project. It is not affiliated with, endorsed or sponsored by Valve Corporation.
Steam and the Steam logo are trademarks of Valve Corporation. Idling games to collect trading cards is a common practice,
but you use this software at your own risk and are responsible for following the Steam Subscriber Agreement.

## Development

```bash
npm install        # electron's postinstall may need: node node_modules/electron/install.js
npm run demo       # open the UI with fake data, no Steam connection
npm test           # unit tests
npm run dist       # build release/Cardfall-Setup-<version>.exe
```

Source layout: `src/main` (vault, Steam session, farming engine, security), `src/preload` (IPC bridge),
`src/renderer` (UI; translations live in `i18n.js` and `i18n-more.js`). Adding a language means adding a column there;
a test checks that every key exists in every language with the same placeholders.
Issues and pull requests are welcome.

## License

[MIT](LICENSE) © 2026 Ömer
