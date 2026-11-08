const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync(path.join(__dirname, 'uploads'))) fs.mkdirSync(path.join(__dirname, 'uploads'));
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

const db = new sqlite3.Database(path.join(__dirname, 'data', 'returns.db'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_name TEXT,
        platform TEXT,
        qr_data TEXT,
        qr_image_path TEXT,
        original_image_path TEXT,
        receipt_path TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, salt TEXT, role TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    db.all("PRAGMA table_info(returns)", (err, columns) => {
        if (err) return;
        const colNames = columns.map(c => c.name);
        if (!colNames.includes('user_id')) db.run("ALTER TABLE returns ADD COLUMN user_id INTEGER");
        if (!colNames.includes('is_private')) db.run("ALTER TABLE returns ADD COLUMN is_private INTEGER DEFAULT 0");
        db.run("UPDATE returns SET is_private = 0 WHERE is_private IS NULL");
    });
});

const upload = multer({ dest: 'uploads/' });

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    db.get(`SELECT user_id, role FROM sessions JOIN users ON sessions.user_id = users.id WHERE token = ?`, [token], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'Invalid token' });
        req.user = { id: row.user_id, role: row.role };
        next();
    });
}

app.get('/api/ping', (req, res) => {
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        res.json({ status: 'ok', requireSetup: row.count === 0 });
    });
});

app.post('/api/auth/setup', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        if (row.count > 0) return res.status(403).json({ error: 'Setup already complete' });
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(password, salt);
        db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'admin')`, [username, hash, salt], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const userId = this.lastID;
            const token = crypto.randomBytes(32).toString('hex');
            db.run(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`, [token, userId], () => {
                res.json({ success: true, token, username, role: 'admin' });
            });
        });
    });
});

// NEUER ENDPUNKT FÜR DIREKTE REGISTRIERUNG
app.post('/api/auth/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Bitte alles ausfüllen' });
    
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        if (row.count === 0) return res.status(403).json({ error: 'Admin setup required first' });
        
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(password, salt);
        db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'user')`, [username, hash, salt], function(err) {
            if (err) return res.status(400).json({ error: 'Benutzername existiert bereits' });
            
            const userId = this.lastID;
            const token = crypto.randomBytes(32).toString('hex');
            db.run(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`, [token, userId], () => {
                res.json({ success: true, token, username, role: 'user' });
            });
        });
    });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'Invalid credentials' });
        const hash = hashPassword(password, user.salt);
        if (hash !== user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });
        
        const token = crypto.randomBytes(32).toString('hex');
        db.run(`INSERT INTO sessions (token, user_id) VALUES (?, ?)`, [token, user.id], () => {
            res.json({ token, username: user.username, role: user.role });
        });
    });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    db.run(`DELETE FROM sessions WHERE token = ?`, [token], () => res.json({ success: true }));
});

app.post('/api/auth/users', requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Nur für Admins erlaubt' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Bitte alles ausfüllen' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    db.run(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'user')`, [username, hash, salt], function(err) {
        if (err) return res.status(400).json({ error: 'Benutzername existiert vermutlich bereits' });
        res.json({ success: true, username });
    });
});

app.get('/api/returns', requireAuth, (req, res) => {
    db.all(`SELECT * FROM returns WHERE is_private = 0 OR is_private IS NULL OR user_id = ? ORDER BY id DESC`, [req.user.id], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/api/returns', requireAuth, upload.fields([{ name: 'qr_image', maxCount: 1 }, { name: 'original_image', maxCount: 1 }]), (req, res) => {
    const { item_name, platform, qr_data, is_private } = req.body;
    const qrPath = req.files['qr_image'] ? req.files['qr_image'][0].path : null;
    const origPath = req.files['original_image'] ? req.files['original_image'][0].path : null;
    const isPriv = is_private === 'true' || is_private === '1' ? 1 : 0;

    const sql = `INSERT INTO returns (item_name, platform, qr_data, qr_image_path, original_image_path, user_id, is_private) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [item_name, platform, qr_data, qrPath, origPath, req.user.id, isPriv], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ id: this.lastID });
    });
});

app.put('/api/returns/:id/privacy', requireAuth, (req, res) => {
    const { is_private } = req.body;
    db.run(`UPDATE returns SET is_private = ? WHERE id = ? AND (user_id = ? OR user_id IS NULL)`, [is_private ? 1 : 0, req.params.id, req.user.id], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: this.changes > 0 });
    });
});

app.post('/api/returns/:id/receipt', requireAuth, upload.single('receipt'), (req, res) => {
    const receiptPath = req.file ? req.file.path : null;
    const qrData = req.body.qr_data || null;
    
    db.run(`UPDATE returns SET receipt_path = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND (is_private = 0 OR is_private IS NULL OR user_id = ?)`, 
    [receiptPath, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (qrData) {
            db.run(`UPDATE returns SET qr_data = ? WHERE id = ?`, [qrData, req.params.id], () => res.json({ success: true }));
        } else {
            res.json({ success: true });
        }
    });
});

app.put('/api/returns/:id/status', requireAuth, (req, res) => {
    const status = req.body.status;
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    db.run(`UPDATE returns SET status = ?, completed_at = ? WHERE id = ? AND (is_private = 0 OR is_private IS NULL OR user_id = ?)`, 
    [status, completedAt, req.params.id, req.user.id], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true });
    });
});

app.delete('/api/returns/:id', requireAuth, (req, res) => {
    db.run(`DELETE FROM returns WHERE id = ? AND (is_private = 0 OR is_private IS NULL OR user_id = ?)`, [req.params.id, req.user.id], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true });
    });
});

app.get('/api/settings', (req, res) => {
    db.all(`SELECT * FROM settings`, (err, rows) => {
        const settings = {};
        if (rows) rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.put('/api/settings', requireAuth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const keys = Object.keys(req.body);
    let completed = 0;
    keys.forEach(k => {
        db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`, [k, req.body[k], req.body[k]], () => {
            completed++;
            if (completed === keys.length) res.json({ success: true });
        });
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`ReTrack Server running on port ${PORT}`));