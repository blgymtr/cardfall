# Security policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private
[security advisory](https://github.com/blgymtr/cardfall/security/advisories/new) form instead.
Include steps to reproduce and the Cardfall version (Settings → Current session, or the installer file name).

## Threat model

Cardfall protects the Steam session of a single Windows user on their own computer.

**What it defends against**

- Someone who copies the files in `%APPDATA%\Cardfall`. The Steam key is encrypted (AES-256-GCM, key derived from your passphrase with scrypt N=2^17) and wrapped with Windows DPAPI, so it only opens for your Windows account *and* the right passphrase. Settings, statistics and history are DPAPI-encrypted too.
- Someone who sits down at an unlocked machine. The UI locks on idle, on Windows lock, on suspend, when hidden to the tray and optionally on minimize. While locked the encryption key is wiped from memory and the UI receives no account or game data.
- Brute-forcing the passphrase through the UI: back-off from the 2nd wrong attempt, the vault is deleted after 10. The counter is stored inside the vault file, not in a separate file that could be deleted.
- Weak passphrases: at least 10 characters, common passphrases and trivial patterns are rejected. Vaults written with older, weaker key-derivation settings are upgraded on the next successful unlock.
- A compromised page or script in the UI: no Node access, sandbox, strict CSP (`connect-src 'none'`, Trusted Types), no permissions, no webviews, a narrow validated IPC surface limited to 50 calls per second, and requests only to allow-listed Steam hosts with TLS verification forced on.
- Leftovers on disk: deleted data is overwritten with random bytes before the file is removed.
- Vulnerable dependencies: production dependencies are audited (`npm audit --omit=dev` reports none), vulnerable transitive packages are pinned to fixed versions, Dependabot watches for new advisories, and release builds carry a build-provenance attestation.

**What it does not defend against**

- Malware already running as your Windows user (it can read process memory, including the unlocked session).
- Offline brute-forcing of a weak passphrase by an attacker who also has your Windows account's DPAPI keys. Use a long passphrase.
- Recovery of old data from SSD blocks after deletion. Overwriting is best effort on flash storage; the Steam key is always stored encrypted anyway.
- Steam itself. Cardfall only does what the Steam client does when you "play" a game, but Valve's terms apply to your account.

## What Cardfall never does

- It never asks for or stores your Steam password.
- It has no telemetry, no analytics, no update pinging and opens no listening ports.
- It never sends your data anywhere except to Steam (`steamcommunity.com`, `store.steampowered.com`, `api.steampowered.com` and the Steam image CDN).
- The optional "Start with Windows" only launches the app hidden; it still waits for your passphrase before connecting to Steam.

## Verifying a download

Each release lists a SHA-256 checksum next to the installer. Compare it with
`Get-FileHash .\Cardfall-Setup-<version>.exe -Algorithm SHA256`. Releases built by the GitHub workflow also carry a
build-provenance attestation you can check with `gh attestation verify <file> --repo blgymtr/cardfall`.
The installer is not code-signed, so Windows SmartScreen will warn on first run.
