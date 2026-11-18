# SpellVault

A local-first personal password manager built with HTML, CSS and vanilla JavaScript.

## Run locally

The service worker and Web Crypto features require a secure context: HTTPS or `localhost`.

1. Extract the ZIP.
2. Open a terminal in the `SpellVault` folder.
3. Run one of these commands:

   **Python**
   ```bash
   python -m http.server 8000
   ```

   **Node.js (if installed)**
   ```bash
   npx serve .
   ```

4. Visit `http://localhost:8000`.

Do not open `index.html` directly with `file://`.

## Install on a phone

1. Host the folder using HTTPS (GitHub Pages is one option).
2. Open the HTTPS address in Chrome on Android.
3. Open the browser menu and choose **Install app** or **Add to Home screen**.
4. Launch SpellVault from the home screen.

For GitHub Pages, create a repository containing only the application source, push the files, then enable Pages in repository Settings. Never commit real vault data or backup files.

## Where data is stored

Vault records are stored in the browser's IndexedDB database named `spellvault-local`, object store `vault`. Data belongs to that browser profile and origin. Clearing site data, changing browser profiles, or uninstalling/clearing browser storage can remove it. Keep a secure backup.

## Encryption model

- Individual app lock encrypts that app's password using AES-GCM with a key derived from its PIN using PBKDF2 and a random salt/IV.
- Global App Lock encrypts the complete vault record using AES-GCM and PBKDF2.
- Passphrases and PINs are not intentionally persisted.
- Never forget your PIN or master passphrase. There is no recovery mechanism.

## Important security notes

This is a starter implementation, not a professionally audited password manager. Use it for experimentation with fake credentials until it has been independently reviewed and security-tested. Browser apps cannot protect against malware, malicious browser extensions, compromised devices, or someone accessing an already-unlocked browser profile.

Clipboard clearing depends on browser permissions and may not be supported in every browser. Background concealment hides revealed values when the page becomes hidden.

The current global App Lock flow uses browser prompts for passphrase setup and is a basic implementation. Do not rely on it for high-value credentials until the implementation has undergone a full security review.

## Backup

Use Settings → Export JSON to download a backup. Unencrypted JSON backups contain readable metadata and any unlocked passwords. Store them securely. Locked app passwords remain encrypted in the export. Import replaces the current vault after confirmation.

## Offline use

The service worker caches static application assets only. It does not cache vault records or passwords. Open the app online once on its HTTPS origin, then reload to establish the offline cache.
