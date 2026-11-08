const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-User");
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
        completed_at DATETIME,
        device_user TEXT DEFAULT 'Standard',
        is_private INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);

    db.all("PRAGMA table_info(returns)", (err, columns) => {
        if (err) return;
        const colNames = columns.map(c => c.name);
        if (!colNames.includes('device_user')) db.run("ALTER TABLE returns ADD COLUMN device_user TEXT DEFAULT 'Standard'");
        if (!colNames.includes('is_private')) db.run("ALTER TABLE returns ADD COLUMN is_private INTEGER DEFAULT 0");
    });
});

const upload = multer({ dest: 'uploads/' });

function getDeviceUser(req) {
    return req.headers['x-device-user'] || 'Standard';
}

app.get('/api/ping', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/returns', (req, res) => {
    const user = getDeviceUser(req);
    db.all(`SELECT * FROM returns WHERE is_private = 0 OR is_private IS NULL OR device_user = ? ORDER BY id DESC`, [user], (err, rows) => {
        if (err) res.status(500).json({ error: err.message });
        else res.json(rows);
    });
});

app.post('/api/returns', upload.fields([{ name: 'qr_image', maxCount: 1 }, { name: 'original_image', maxCount: 1 }]), (req, res) => {
    const user = getDeviceUser(req);
    const { item_name, platform, qr_data, is_private } = req.body;
    const qrPath = req.files['qr_image'] ? req.files['qr_image'][0].path : null;
    const origPath = req.files['original_image'] ? req.files['original_image'][0].path : null;
    const isPriv = is_private === 'true' || is_private === '1' ? 1 : 0;

    const sql = `INSERT INTO returns (item_name, platform, qr_data, qr_image_path, original_image_path, device_user, is_private) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [item_name, platform, qr_data, qrPath, origPath, user, isPriv], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ id: this.lastID });
    });
});

app.put('/api/returns/:id/privacy', (req, res) => {
    const user = getDeviceUser(req);
    const { is_private } = req.body;
    db.run(`UPDATE returns SET is_private = ? WHERE id = ? AND (device_user = ? OR device_user IS NULL)`, [is_private ? 1 : 0, req.params.id, user], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: this.changes > 0 });
    });
});

app.post('/api/returns/:id/receipt', upload.single('receipt'), (req, res) => {
    const user = getDeviceUser(req);
    const receiptPath = req.file ? req.file.path : null;
    const qrData = req.body.qr_data || null;
    
    db.run(`UPDATE returns SET receipt_path = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND (is_private = 0 OR is_private IS NULL OR device_user = ?)`, 
    [receiptPath, req.params.id, user], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (qrData) {
            db.run(`UPDATE returns SET qr_data = ? WHERE id = ?`, [qrData, req.params.id], () => res.json({ success: true }));
        } else {
            res.json({ success: true });
        }
    });
});

app.put('/api/returns/:id/status', (req, res) => {
    const user = getDeviceUser(req);
    const status = req.body.status;
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    db.run(`UPDATE returns SET status = ?, completed_at = ? WHERE id = ? AND (device_user = ? OR device_user IS NULL)`, 
    [status, completedAt, req.params.id, user], function(err) {
        if (err) res.status(500).json({ error: err.message });
        else res.json({ success: true });
    });
});

app.delete('/api/returns/:id', (req, res) => {
    const user = getDeviceUser(req);
    db.run(`DELETE FROM returns WHERE id = ? AND (device_user = ? OR device_user IS NULL)`, [req.params.id, user], function(err) {
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

app.put('/api/settings', (req, res) => {
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