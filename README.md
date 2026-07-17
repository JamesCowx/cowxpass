# CowxPass

A zero-knowledge, AES-256-GCM encrypted password manager with cloud sync. Built with Express and vanilla JS.

## Features

- **AES-256-GCM encryption** — all vault data is encrypted client-side before touching the server
- **Zero-knowledge architecture** — the server stores encrypted blobs and cannot read your passwords
- **Cloud sync** — encrypted vaults sync across devices (Pro tier)
- **Password generator** — cryptographically random passwords with custom rules
- **Secure notes** — store sensitive text alongside your passwords
- **Free tier** — up to 10 accounts and 3 secure notes, local storage
- **Pro tier** — unlimited accounts/notes, cloud sync, import/export, priority support

## Quick Start

```bash
npm install
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" > .env
npm start
```

Open http://localhost:3000

## Deploy to Render

1. Create a new **Web Service** on [Render](https://dashboard.render.com)
2. Connect your GitHub repo
3. Language: **Node**
4. Build command: `npm install`
5. Start command: `node server.js`
6. Add environment variable: `JWT_SECRET` (64-char hex string)

A `Procfile` and `Dockerfile` are included for alternative deployment options.

## Tech Stack

- **Backend:** Node.js, Express, JWT authentication
- **Database:** JSON file storage (zero native dependencies)
- **Frontend:** Vanilla JS, AES-256-GCM via Web Crypto API
- **PBKDF2** key derivation with per-user salts

## License

MIT
