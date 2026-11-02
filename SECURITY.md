# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private
[security advisory](https://github.com/blgymtr/cardfall/security/advisories/new) form instead.
Include steps to reproduce and the Cardfall version (Settings, or the installer file name).

## Threat model

Cardfall protects the Steam session of a single Windows user on their own computer.

**What it defends against**

- Someone who copies the files in `%APPDATA%\Cardfall` (they are encrypted with a key derived from your passphrase and wrapped with Windows DPAPI, so they only open for your Windows account *and* the right passphrase).
- Someone who sits down at an unlocked machine (the UI locks on idle, on Windows lock, on suspend and when hidden to the tray).
- Brute-forcing the passphrase through the UI (exponential back-off, the vault is deleted after 10 wrong attempts).
- A compromised web page or script in the UI (no Node access, sandbox, strict CSP with `connect-src 'none'`, a narrow validated IPC surface, requests only to allow-listed Steam hosts).

**What it does not defend against**

- Malware already running as your Windows user (it can read process memory, including the unlocked session).
- Offline brute-forcing of a weak passphrase by an attacker who also has your Windows account's DPAPI keys. Use a long passphrase.
- Steam itself. Cardfall only does what the Steam client does when you "play" a game, but Valve's terms apply to your account.

## What Cardfall never does

- It never asks for or stores your Steam password.
- It has no telemetry, no analytics, no update pinging and opens no listening ports.
- It never sends your data anywhere except to Steam (`steamcommunity.com`, `api.steampowered.com` and the Steam CDN for game images).

## Verifying a download

Each release lists a SHA-256 checksum next to the installer. Compare it with
`Get-FileHash .\Cardfall-Setup-<version>.exe -Algorithm SHA256`. The installer is not code-signed, so
Windows SmartScreen will warn on first run.
