const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = '30d';
const DB_PATH = path.join(process.env.DATA_DIR || __dirname, 'cowxpass.json');

console.log('Starting CowxPass...');
console.log('DB path:', DB_PATH);

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── JSON File Database ────────────
function readDb() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { users: [], vaults: [] }; }
}
function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Init DB file
if (!fs.existsSync(DB_PATH)) writeDb({ users: [], vaults: [] });
console.log('Database ready');

// ── Rate limiter ──────────────────
const rateLimitMap = new Map();
function rateLimiter(max, ms) {
  return (req, res, next) => {
    const ip = req.ip || '::1';
    const now = Date.now();
    const r = rateLimitMap.get(ip) || { count: 0, reset: now + ms };
    if (now > r.reset) { r.count = 0; r.reset = now + ms; }
    r.count++; rateLimitMap.set(ip, r);
    if (r.count > max) return res.status(429).json({ error: 'Slow down' });
    next();
  };
}

// ── Auth middleware ───────────────
function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch (e) { res.status(401).json({ error: 'Invalid token' }); }
}

const authLimiter = rateLimiter(10, 60000);

// ── API Routes ────────────────────
app.post('/api/auth/register', authLimiter, (req, res) => {
  const { email, hash, salt } = req.body;
  if (!email || !hash || !salt) return res.status(400).json({ error: 'Missing fields' });
  const db = readDb();
  if (db.users.find(u => u.email === email)) return res.status(409).json({ error: 'Email exists' });
  const user = { id: db.users.length + 1, email, auth_hash: hash, salt, created_at: Math.floor(Date.now()/1000) };
  db.users.push(user); writeDb(db);
  const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ token, userId: user.id });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, hash } = req.body;
  if (!email || !hash) return res.status(400).json({ error: 'Missing fields' });
  const db = readDb();
  const user = db.users.find(u => u.email === email);
  if (!user || user.auth_hash !== hash) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  res.json({ token, userId: user.id });
});

app.get('/api/vault', auth, (req, res) => {
  const db = readDb();
  const v = db.vaults.find(v => v.user_id === req.user.id);
  if (!v) return res.json({ encrypted: null, updatedAt: null });
  res.json({ encrypted: JSON.parse(v.encrypted_data), updatedAt: v.updated_at });
});

app.put('/api/vault', auth, (req, res) => {
  const { encrypted, clientUpdatedAt } = req.body;
  if (!encrypted) return res.status(400).json({ error: 'Missing data' });
  const db = readDb();
  const existing = db.vaults.find(v => v.user_id === req.user.id);
  if (existing && clientUpdatedAt && clientUpdatedAt < existing.updated_at) {
    return res.status(409).json({ error: 'Conflict', serverUpdatedAt: existing.updated_at });
  }
  const now = Math.floor(Date.now() / 1000);
  if (existing) {
    existing.encrypted_data = JSON.stringify(encrypted);
    existing.updated_at = now;
  } else {
    db.vaults.push({ user_id: req.user.id, encrypted_data: JSON.stringify(encrypted), updated_at: now });
  }
  writeDb(db);
  res.json({ updatedAt: now });
});

app.post('/api/auth/salt', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const db = readDb();
  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ salt: user.salt });
});

app.get('/api/health', (req, res) => {
  const db = readDb();
  res.json({ ok: true, users: db.users.length });
});

// ── Static Pages ──────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'landing.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/test', (req, res) => res.send('OK'));
app.get('/*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, req.path), err => { if (err) res.status(404).send('Not found'); });
});

app.listen(PORT, () => console.log(`CowxPass running on port ${PORT}`));
