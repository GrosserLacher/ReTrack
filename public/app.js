if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}

let SERVER_URL = localStorage.getItem('retrack_server_url') || '';
let DEVICE_USER = localStorage.getItem('retrack_device_user') || 'Standard';
let IS_LOCAL_MODE = !Boolean(SERVER_URL);

let currentLang = localStorage.getItem('retrack_lang') || 'de';
let deferredPrompt, selectedQrFile = null, originalUploadFile = null, fullScreenshotUrl = null, currentCroppedQrDataUrl = null;
let html5QrScanner = null, allReturns = [], currentFilter = 'pending';
let batchItems = [], batchIndex = 0, showingOriginalInModal = false, currentModalItem = null, wakeLockObj = null;

const I18N = {
    de: {
        appSubtitle: 'Retouren & Belege', installApp: 'App installieren', shopModeBtn: 'Paketshop-Modus ({n})', shopModeStartBtn: 'Paketshop-Modus starten ({n})',
        newReturnTitle: 'Neue Retoure erfassen', qrOcrBadge: 'QR, 1D-Barcode & OCR', chooseScreenshot: 'Screenshot / Etikett wählen', chooseScreenshotSub: 'Per Strg+V einfügen oder aus App teilen',
        startCamera: 'Kamera-Scanner starten', startCameraSub: 'QR-Code oder Strichcode abfilmen', closeCamera: 'Kamera schließen', isolatedCodeLabel: 'Isolierter Code',
        searchingCode: 'Wird gesucht...', noCodeDetected: 'Kein Code erkannt', tapToMaximize: 'Antippen zum Maximieren', originalScreenshotBtn: 'Original-Screenshot',
        trackingLabel: 'Sendungsnummer / Code-Inhalt', trackingPlaceholder: 'Wird aus Code oder Beleg ausgelesen...', itemDescLabel: 'Artikelbeschreibung *',
        itemDescPlaceholder: 'Wird per OCR gesucht oder manuell eingeben...', ocrDetectedLines: 'Erkannte Textzeilen (Antippen zum Übernehmen)', platformLabel: 'Plattform / Versanddienstleister *',
        platformPlaceholder: 'Wird automatisch erkannt oder manuell eingeben...', saveReturnBtn: 'Retoure speichern', cancelBtn: 'Abbrechen', savedReturnsTitle: 'Gespeicherte Retouren',
        entriesCount: '{n} Einträge', noReturnsInView: 'Keine Retouren in dieser Ansicht vorhanden.', statusPending: 'Offen', statusCompleted: 'Abgeschlossen',
        trackShipment: 'Sendung verfolgen', deleteBtn: 'Löschen', returnCodeLabel: 'Retouren-Code', maximizeBtn: 'Maximieren', receiptLabel: 'Einlieferungsbeleg',
        viewReceiptBtn: 'Beleg ansehen', saveReceiptBtn: 'Beleg speichern (inkl. Sendungs-OCR)', checkingReceiptOcr: 'Prüfe Beleg auf Sendungsnummer...',
        markPendingBtn: 'Wieder als offen markieren', markCompletedBtn: 'Als abgeschlossen markieren', trackingPrefix: 'Sendung / Code: ', codePrefix: 'Code: ',
        noTextCode: 'Kein Text-Code hinterlegt', noImageStored: 'Kein Bild hinterlegt.', pkgCounter: 'Paket {cur} von {total}', showIsolatedQr: 'Isolierten QR-Code anzeigen',
        showOrigScreenshot: 'Original-Screenshot einblenden', prevPkgBtn: 'Vorheriges Paket', nextPkgBtn: 'Nächstes Paket', closeBtn: 'Schließen',
        tabPending: 'Offen', tabCompleted: 'Abgeschlossen', tabSettings: 'Einstellungen', cleanupTitle: 'Speicher-Hygiene (Auto-Cleanup)', cleanupSub: 'Bereinigt alte, bereits abgeschlossene Retouren',
        cleanupActive: 'Aktiv ({n} Tage)', cleanupInactive: 'Inaktiv', cleanupEnableLabel: 'Automatische Bereinigung aktivieren', retentionLabel: 'Aufbewahrungsdauer nach Abschluss',
        days30: '30 Tage', days60: '60 Tage', days90: '90 Tage (Empfohlen)', days180: '180 Tage', days365: '365 Tage', cleanupModeLabel: 'Bereinigungs-Modus',
        modeFilesOnly: 'Nur Bilddateien löschen', modeDeleteAll: 'Kompletten Datensatz löschen', manualCleanupBtn: 'Jetzt manuell bereinigen',
        saveSettingsBtn: 'Einstellungen speichern', webhookTitle: 'Fristen-Erinnerung & Webhooks', webhookSub: 'Sendet eine Push-Nachricht bei zu langen offenen Retouren',
        webhookEnableLabel: 'Push-Erinnerung aktivieren', webhookUrlLabel: 'Webhook-URL / ntfy-Topic', webhookDaysLabel: 'Warnung nach (Tagen)',
        testWebhookBtn: 'Test-Nachricht senden', backupTitle: 'Datensicherung (Backup)', backupSub: 'Exportiert oder importiert die komplette Datenbank inklusive Bilder',
        exportTitle: 'Komplettes Backup exportieren', downloadBackupBtn: 'Backup herunterladen', restoreTitle: 'Backup wiederherstellen', restoreBackupBtn: 'Backup-Datei wählen & einspielen',
        isolatingCode: 'Isoliere Code...', analyzingItem: 'Analysiere Artikel...', codeIsolated: 'Code isoliert', codeDetected: 'Code erkannt', screenshotReady: 'Screenshot bereit',
        itemDetected: 'Artikel erkannt', noTextDetected: 'Kein Text erkannt', ocrSkipped: 'OCR übersprungen', cameraCaptured: 'Code per Kamera erfasst', previewBadge: 'Vorschau',
        originalFileBadge: 'Originaldatei', alertFillFields: 'Bitte Artikel und Plattform prüfen.', alertCameraHttps: 'Kamerazugriff erfordert Berechtigung oder HTTPS.',
        confirmDelete: 'Retoure wirklich löschen?', alertSettingsSaved: 'Einstellungen wurden gespeichert.', alertNoCleanupItems: 'Keine abgeschlossenen Retouren gefunden, die älter als {days} Tage sind.',
        confirmCleanup: 'Es wurden {count} abgeschlossene Retouren (älter als {days} Tage) gefunden. Jetzt bereinigen?', alertCleanedUp: '{count} Einträge wurden bereinigt.',
        alertEnterWebhook: 'Bitte zuerst eine Webhook- oder ntfy-URL eintragen.', alertTestSent: 'Test-Benachrichtigung erfolgreich gesendet.', alertTestFailed: 'Fehler beim Senden.',
        confirmRestore: 'Achtung: Das Einspielen eines Backups überschreibt den aktuellen Stand. Fortfahren?', alertRestoreSuccess: 'Backup erfolgreich eingespielt ({count} Retouren wiederhergestellt).',
        alertInvalidBackup: 'Ungültige JSON-Backup-Datei.', privateReturnLabel: 'Retoure privat halten (nur für mich sichtbar)', serverTitle: 'Speicherort & Server-Verbindung',
        serverUrlLabel: 'Server-URL (leer lassen für lokalen Offline-Modus)', connectBtn: 'Verbinden', privateBadge: '🔒 Privat', sharedBadge: '👥 Geteilt'
    },
    en: {
        appSubtitle: 'Returns & Receipts', installApp: 'Install App', shopModeBtn: 'Parcel Shop Mode ({n})', shopModeStartBtn: 'Start Parcel Shop Mode ({n})',
        newReturnTitle: 'Add New Return', qrOcrBadge: 'QR, 1D-Barcode & OCR', chooseScreenshot: 'Select Screenshot / Label', chooseScreenshotSub: 'Paste via Ctrl+V or share from app',
        startCamera: 'Start Camera Scanner', startCameraSub: 'Scan QR code or barcode live', closeCamera: 'Close Camera', isolatedCodeLabel: 'Isolated Code',
        searchingCode: 'Searching...', noCodeDetected: 'No code detected', tapToMaximize: 'Tap to maximize', originalScreenshotBtn: 'Original Screenshot',
        trackingLabel: 'Tracking Number / Code Data', trackingPlaceholder: 'Extracted from code or receipt...', itemDescLabel: 'Item Description *',
        itemDescPlaceholder: 'Detected via OCR or enter manually...', ocrDetectedLines: 'Detected Text Lines (Tap to apply)', platformLabel: 'Platform / Carrier *',
        platformPlaceholder: 'Auto-detected or enter manually...', saveReturnBtn: 'Save Return', cancelBtn: 'Cancel', savedReturnsTitle: 'Saved Returns',
        entriesCount: '{n} Entries', noReturnsInView: 'No returns found in this view.', statusPending: 'Pending', statusCompleted: 'Completed',
        trackShipment: 'Track Shipment', deleteBtn: 'Delete', returnCodeLabel: 'Return Code', maximizeBtn: 'Maximize', receiptLabel: 'Drop-Off Receipt',
        viewReceiptBtn: 'View Receipt', saveReceiptBtn: 'Save Receipt (incl. Tracking OCR)', checkingReceiptOcr: 'Scanning receipt for tracking ID...',
        markPendingBtn: 'Mark as pending again', markCompletedBtn: 'Mark as completed', trackingPrefix: 'Tracking / Code: ', codePrefix: 'Code: ',
        noTextCode: 'No text code stored', noImageStored: 'No image stored.', pkgCounter: 'Package {cur} of {total}', showIsolatedQr: 'Show Isolated QR Code',
        showOrigScreenshot: 'Show Original Screenshot', prevPkgBtn: 'Previous Package', nextPkgBtn: 'Next Package', closeBtn: 'Close',
        tabPending: 'Pending', tabCompleted: 'Completed', tabSettings: 'Settings', cleanupTitle: 'Storage Hygiene (Auto-Cleanup)', cleanupSub: 'Cleans up old completed returns',
        cleanupActive: 'Active ({n} Days)', cleanupInactive: 'Inactive', cleanupEnableLabel: 'Enable automatic cleanup', retentionLabel: 'Retention Period After Completion',
        days30: '30 Days', days60: '60 Days', days90: '90 Days (Recommended)', days180: '180 Days', days365: '365 Days', cleanupModeLabel: 'Cleanup Mode',
        modeFilesOnly: 'Delete image files only', modeDeleteAll: 'Delete entire record', manualCleanupBtn: 'Run manual cleanup now',
        saveSettingsBtn: 'Save Settings', webhookTitle: 'Deadline Reminders & Webhooks', webhookSub: 'Sends a push notification for old pending returns',
        webhookEnableLabel: 'Enable push reminders', webhookUrlLabel: 'Webhook URL / ntfy Topic', webhookDaysLabel: 'Warn after (Days)',
        testWebhookBtn: 'Send Test Notification', backupTitle: 'Data Backup', backupSub: 'Exports or imports the complete database including all uploaded images',
        exportTitle: 'Export Complete Backup', downloadBackupBtn: 'Download Backup', restoreTitle: 'Restore Backup', restoreBackupBtn: 'Select & Restore Backup File',
        isolatingCode: 'Isolating code...', analyzingItem: 'Analyzing item...', codeIsolated: 'Code isolated', codeDetected: 'Code detected', screenshotReady: 'Screenshot ready',
        itemDetected: 'Item detected', noTextDetected: 'No text detected', ocrSkipped: 'OCR skipped', cameraCaptured: 'Code captured via camera', previewBadge: 'Preview',
        originalFileBadge: 'Original File', alertFillFields: 'Please enter both item description and platform.', alertCameraHttps: 'Camera access requires permission or HTTPS.',
        confirmDelete: 'Really delete this return?', alertSettingsSaved: 'Settings have been saved.', alertNoCleanupItems: 'No completed returns found older than {days} days.',
        confirmCleanup: 'Found {count} completed returns older than {days} days. Clean up now?', alertCleanedUp: '{count} entries cleaned up.',
        alertEnterWebhook: 'Please enter a webhook or ntfy URL first.', alertTestSent: 'Test notification sent successfully.', alertTestFailed: 'Failed to send notification.',
        confirmRestore: 'Warning: Restoring a backup will overwrite current data. Continue?', alertRestoreSuccess: 'Backup restored successfully ({count} returns imported).',
        alertInvalidBackup: 'Invalid JSON backup file.', privateReturnLabel: 'Keep return private (visible only to me)', serverTitle: 'Storage & Server Connection',
        serverUrlLabel: 'Server URL (leave empty for local offline mode)', connectBtn: 'Connect', privateBadge: '🔒 Private', sharedBadge: '👥 Shared'
    }
};

function t(key, vars = {}) {
    let str = (I18N[currentLang] && I18N[currentLang][key]) || I18N.de[key] || key;
    Object.entries(vars).forEach(([k, v]) => { str = str.replace('{' + k + '}', v); });
    return str;
}

function applyLanguage() {
    document.documentElement.lang = currentLang;
    const toggleBtn = document.getElementById('langToggleBtn');
    if (toggleBtn) toggleBtn.textContent = currentLang === 'de' ? 'EN' : 'DE';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    updateShopModeButtons();
    if (currentFilter === 'settings') loadSettings(); else renderReturns();
}

function toggleLanguage() {
    currentLang = currentLang === 'de' ? 'en' : 'de';
    localStorage.setItem('retrack_lang', currentLang);
    applyLanguage();
}

function openLocalDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('ReTrackLocalDB', 2);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('returns')) db.createObjectStore('returns', { keyPath: 'id', autoIncrement: true });
            if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getApiUrl(path) {
    if (SERVER_URL) return SERVER_URL.replace(/\/$/, '') + path;
    return path;
}

function getAuthHeaders() {
    const headers = { 'X-Device-User': DEVICE_USER };
    return headers;
}

function saveDeviceUser() {
    const val = document.getElementById('setDeviceUser').value.trim();
    if (!val) return alert('Bitte einen Namen eingeben.');
    DEVICE_USER = val;
    localStorage.setItem('retrack_device_user', DEVICE_USER);
    alert('Geräte-Profil gespeichert: ' + DEVICE_USER);
    loadReturns();
}

async function pingServer() {
    const urlInput = document.getElementById('setServerUrl');
    const inputUrl = urlInput ? urlInput.value.trim() : '';
    const statusEl = document.getElementById('serverStatusText');

    if (!inputUrl) {
        SERVER_URL = '';
        localStorage.removeItem('retrack_server_url');
        IS_LOCAL_MODE = true;
        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.textContent = 'Lokaler Offline-Modus aktiv.';
            statusEl.className = 'text-xs font-medium text-emerald-400 mt-1';
        }
        loadReturns();
        return;
    }

    if (statusEl) {
        statusEl.classList.remove('hidden');
        statusEl.textContent = 'Prüfe Verbindung...';
        statusEl.className = 'text-xs font-medium text-amber-400 mt-1';
    }

    try {
        const cleanUrl = inputUrl.replace(/\/$/, '');
        const res = await fetch(cleanUrl + '/api/ping');
        if (!res.ok) throw new Error();
        
        SERVER_URL = cleanUrl;
        localStorage.setItem('retrack_server_url', SERVER_URL);
        IS_LOCAL_MODE = false;
        
        if (statusEl) {
            statusEl.textContent = 'Server verbunden!';
            statusEl.className = 'text-xs font-medium text-emerald-400 mt-1';
        }
        await loadReturns();
    } catch (e) {
        if (statusEl) {
            statusEl.textContent = 'Fehler: Server nicht erreichbar oder falsche URL.';
            statusEl.className = 'text-xs font-medium text-red-400 mt-1';
        }
    }
}

async function apiGetReturns() {
    if (!IS_LOCAL_MODE) {
        try {
            const res = await fetch(getApiUrl('/api/returns'), { headers: getAuthHeaders() });
            if (res.ok) return await res.json();
        } catch (e) {}
        return [];
    }
    
    const db = await openLocalDb();
    return new Promise((resolve) => {
        const tx = db.transaction('returns', 'readonly');
        const req = tx.objectStore('returns').getAll();
        req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.id - a.id));
        req.onerror = () => resolve([]);
    });
}

async function apiGetSettings() {
    if (!IS_LOCAL_MODE) {
        try {
            const res = await fetch(getApiUrl('/api/settings'), { headers: getAuthHeaders() });
            if (res.ok) return await res.json();
        } catch (e) {}
    }
    const db = await openLocalDb();
    return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').getAll();
        req.onsuccess = () => {
            const s = { cleanup_enabled: 'false', cleanup_days: '90', cleanup_mode: 'files_only', webhook_enabled: 'false', webhook_url: '', webhook_days: '10' };
            (req.result || []).forEach(r => s[r.key] = r.value);
            resolve(s);
        };
        req.onerror = () => resolve({});
    });
}

function fileToDataUrl(file) {
    return new Promise((resolve) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

async function saveReturn() {
    const itemName = document.getElementById('itemName').value.trim();
    const platform = document.getElementById('platform').value.trim();
    const qrData = document.getElementById('qrData').value.trim();
    const isPrivate = document.getElementById('isPrivate').checked;
    
    if (!itemName || !platform) return alert(t('alertFillFields'));

    if (!IS_LOCAL_MODE) {
        const fd = new FormData();
        fd.append('item_name', itemName); fd.append('platform', platform); fd.append('qr_data', qrData); fd.append('is_private', isPrivate);
        if (selectedQrFile) fd.append('qr_image', selectedQrFile);
        if (originalUploadFile) fd.append('original_image', originalUploadFile);
        await fetch(getApiUrl('/api/returns'), { method: 'POST', headers: getAuthHeaders(), body: fd });
    } else {
        const qrDataUrl = await fileToDataUrl(selectedQrFile);
        const origDataUrl = originalUploadFile ? await fileToDataUrl(originalUploadFile) : qrDataUrl;
        const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const db = await openLocalDb();
        await new Promise((resolve) => {
            const tx = db.transaction('returns', 'readwrite');
            tx.objectStore('returns').add({
                item_name: itemName, platform: platform, qr_data: qrData || '',
                qr_image_path: qrDataUrl, original_image_path: origDataUrl, receipt_path: null,
                status: 'pending', created_at: nowStr, completed_at: null, is_private: isPrivate ? 1 : 0
            });
            tx.oncomplete = () => resolve();
        });
    }
    
    resetForm(); loadReturns();
}

async function togglePrivacy(id, currentPrivacy) {
    const newPrivacy = !currentPrivacy;
    if (!IS_LOCAL_MODE) {
        await fetch(getApiUrl(`/api/returns/${id}/privacy`), {
            method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_private: newPrivacy })
        });
    } else {
        const db = await openLocalDb();
        await new Promise((resolve) => {
            const tx = db.transaction('returns', 'readwrite');
            const store = tx.objectStore('returns');
            const g = store.get(Number(id));
            g.onsuccess = () => { if (g.result) { g.result.is_private = newPrivacy ? 1 : 0; store.put(g.result); } resolve(); };
        });
    }
    loadReturns();
}

function setPlatform(name) { document.getElementById('platform').value = name; }
function setItemName(name) { document.getElementById('itemName').value = name; }
document.getElementById('qrInputFile').addEventListener('change', (e) => { if (e.target.files.length > 0) handleImageFile(e.target.files[0]); });
window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) { if (item.type.startsWith('image/')) { handleImageFile(item.getAsFile()); break; } }
});

function detectPlatformFromText(text) {
    const tStr = text.toLowerCase();
    const shops = [['amazon', 'Amazon'], ['zalando', 'Zalando'], ['otto', 'Otto'], ['ebay', 'eBay'], ['mindfactory', 'Mindfactory'], ['alternate', 'Alternate'], ['galaxus', 'Galaxus'], ['mediamarkt', 'MediaMarkt'], ['saturn', 'Saturn'], ['thomann', 'Thomann'], ['kaufland', 'Kaufland'], ['about you', 'About You'], ['hermes', 'Hermes'], ['dhl', 'DHL Retoure'], ['dpd', 'DPD'], ['gls', 'GLS'], ['ups', 'UPS']];
    for (const [key, label] of shops) { if (tStr.includes(key)) return label; }
    if (/^jjd|^0034|^ret/i.test(text.trim())) return 'DHL Retoure';
    return '';
}

function extractTrackingNumberFromText(rawText) {
    const cleaned = rawText.replace(/\s+/g, ' ');
    const patterns = [/\b(JJD[\d\s]{10,24})\b/i, /\b(0034[\d\s]{12,20})\b/, /\b(1Z[A-Z0-9]{14,18})\b/i, /(?:sendungsnummer|sendungs-nr|paketnummer|quittungsnummer|tracking|parcel)[^0-9A-Z]{0,15}([A-Z0-9]{10,22})/i, /\b(\d{12,20})\b/];
    for (const reg of patterns) { const m = cleaned.match(reg); if (m && m[1]) return m[1].replace(/\s+/g, ''); }
    return '';
}

function buildTrackingUrl(platform, code) {
    if (!code) return null;
    const clean = code.trim(); const p = (platform || '').toLowerCase();
    if (/^https?:\/\//i.test(clean)) return clean;
    if (clean.length < 8) return null;
    const encoded = encodeURIComponent(clean);
    if (p.includes('dhl') || /^jjd|^0034/i.test(clean)) return 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=' + encoded;
    if (p.includes('hermes')) return 'https://www.myhermes.de/empfangen/sendungsverfolgung/suchen/?suche=' + encoded;
    if (p.includes('dpd')) return 'https://tracking.dpd.de/status/de_DE/parcel/' + encoded;
    if (p.includes('gls')) return 'https://www.gls-pakete.de/reach-sendungsverfolgung?match=' + encoded;
    if (p.includes('ups') || /^1Z/i.test(clean)) return 'https://www.ups.com/track?loc=de_DE&tracknum=' + encoded;
    return 'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=' + encoded;
}

function smartExtractArticle(rawText) {
    const lines = rawText.split('\n').map(l => l.replace(/[^a-zA-Z0-9äöüÄÖÜß\-\s.,()/&+]/g, '').trim()).filter(l => l.length > 3);
    for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if ((lower.includes('artikel') || lower.includes('produkt') || lower.includes('item') || lower.includes('product')) && lines[i+1]) return lines[i+1];
    }
    const blacklist = /(ruecksend|rcksend|rücksend|retoure|return|qr-code|qrcode|paketshop|etikett|label|print|drucken|bestellung|order|summe|total|eur|konto|hilfe|http|www|empfaenger|absender|kundennummer|sendungsnummer|dhl|hermes|amazon|zalando|grund|status|datum|menge|preis|stueck|stk)/i;
    const candidates = lines.filter(l => !blacklist.test(l) && l.length >= 5 && l.length <= 70);
    if (candidates.length > 0) { candidates.sort((a, b) => b.length - a.length); return candidates[0]; }
    return '';
}

function detectAndCropQrFromImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            canvas.width = img.width; canvas.height = img.height; ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (typeof jsQR === 'function') {
                let code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
                if (!code && canvas.width > 1200) {
                    const scale = 800 / canvas.width;
                    const smCanvas = document.createElement('canvas'); smCanvas.width = 800; smCanvas.height = Math.round(canvas.height * scale);
                    const smCtx = smCanvas.getContext('2d'); smCtx.drawImage(canvas, 0, 0, smCanvas.width, smCanvas.height);
                    const smData = smCtx.getImageData(0, 0, smCanvas.width, smCanvas.height);
                    code = jsQR(smData.data, smData.width, smData.height, { inversionAttempts: 'attemptBoth' });
                    if (code && code.location) {
                        const inv = 1 / scale;
                        code.location.topLeftCorner.x *= inv; code.location.topLeftCorner.y *= inv;
                        code.location.bottomRightCorner.x *= inv; code.location.bottomRightCorner.y *= inv;
                    }
                }
                if (code && code.location) {
                    const loc = code.location;
                    const xs = [loc.topLeftCorner.x, loc.topRightCorner.x, loc.bottomLeftCorner.x, loc.bottomRightCorner.x];
                    const ys = [loc.topLeftCorner.y, loc.topRightCorner.y, loc.bottomLeftCorner.y, loc.bottomRightCorner.y];
                    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
                    const w = maxX - minX, h = maxY - minY, pad = Math.max(30, Math.round(Math.max(w, h) * 0.2));
                    const sx = Math.max(0, Math.floor(minX - pad)), sy = Math.max(0, Math.floor(minY - pad));
                    const sw = Math.min(canvas.width - sx, Math.ceil(w + pad * 2)), sh = Math.min(canvas.height - sy, Math.ceil(h + pad * 2));
                    const cropCanvas = document.createElement('canvas'); cropCanvas.width = sw; cropCanvas.height = sh;
                    const cropCtx = cropCanvas.getContext('2d'); cropCtx.fillStyle = '#ffffff'; cropCtx.fillRect(0, 0, sw, sh);
                    cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
                    const dataUrl = cropCanvas.toDataURL('image/png');
                    cropCanvas.toBlob((blob) => { resolve({ qrText: code.data, croppedDataUrl: dataUrl, croppedFile: blob ? new File([blob], 'code-cropped.png', { type: 'image/png' }) : null }); }, 'image/png');
                    return;
                }
            }
            resolve(null);
        };
        img.onerror = () => resolve(null); img.src = URL.createObjectURL(file);
    });
}

function updateDedicatedQrPreview(croppedUrl, qrText, fallbackUrl) {
    const imgEl = document.getElementById('extractedQrImg'); const fbEl = document.getElementById('extractedQrFallback'); const phEl = document.getElementById('extractedQrPlaceholder');
    imgEl.classList.add('hidden'); fbEl.classList.add('hidden'); fbEl.innerHTML = ''; phEl.classList.add('hidden');
    if (croppedUrl) { currentCroppedQrDataUrl = croppedUrl; imgEl.src = croppedUrl; imgEl.classList.remove('hidden'); } 
    else if (qrText) { currentCroppedQrDataUrl = null; fbEl.classList.remove('hidden'); new QRCode(fbEl, { text: qrText, width: 96, height: 96 }); } 
    else if (fallbackUrl) { currentCroppedQrDataUrl = fallbackUrl; imgEl.src = fallbackUrl; imgEl.classList.remove('hidden'); } 
    else { phEl.textContent = t('noCodeDetected'); phEl.classList.remove('hidden'); }
}

async function handleImageFile(file) {
    originalUploadFile = file; selectedQrFile = null; fullScreenshotUrl = URL.createObjectURL(file);
    document.getElementById('returnForm').classList.remove('hidden'); document.getElementById('previewFullImgBtn').classList.remove('hidden');
    const scanBadge = document.getElementById('scanStatusBadge'); const ocrBadge = document.getElementById('ocrStatusBadge');
    scanBadge.textContent = t('isolatingCode'); ocrBadge.textContent = t('analyzingItem');
    ocrBadge.className = 'bg-amber-950 text-amber-300 border border-amber-800/60 rounded-md px-2 py-0.5 text-xs';

    const cropResult = await detectAndCropQrFromImage(file);
    if (cropResult && cropResult.croppedDataUrl) {
        if (cropResult.croppedFile) selectedQrFile = cropResult.croppedFile;
        if (cropResult.qrText) {
            document.getElementById('qrData').value = cropResult.qrText;
            const guessed = detectPlatformFromText(cropResult.qrText);
            if (guessed && !document.getElementById('platform').value) setPlatform(guessed);
        }
        updateDedicatedQrPreview(cropResult.croppedDataUrl, cropResult.qrText, fullScreenshotUrl);
        scanBadge.textContent = t('codeIsolated'); scanBadge.className = 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-md px-2 py-0.5 text-xs';
    } else {
        const fileScanner = new Html5Qrcode("fileReaderHidden");
        fileScanner.scanFile(file, false).then(qrText => {
            document.getElementById('qrData').value = qrText; updateDedicatedQrPreview(null, qrText, fullScreenshotUrl);
            scanBadge.textContent = t('codeDetected'); scanBadge.className = 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-md px-2 py-0.5 text-xs';
            const guessed = detectPlatformFromText(qrText); if (guessed && !document.getElementById('platform').value) setPlatform(guessed);
        }).catch(() => {
            updateDedicatedQrPreview(null, null, fullScreenshotUrl);
            scanBadge.textContent = t('screenshotReady'); scanBadge.className = 'bg-blue-950 text-blue-300 border border-blue-800/60 rounded-md px-2 py-0.5 text-xs';
        });
    }

    try {
        const result = await Tesseract.recognize(file, 'deu+eng'); const rawText = result.data.text || '';
        const foundPlatform = detectPlatformFromText(rawText); if (foundPlatform && !document.getElementById('platform').value) setPlatform(foundPlatform);
        const foundTracking = extractTrackingNumberFromText(rawText); if (foundTracking && !document.getElementById('qrData').value) document.getElementById('qrData').value = foundTracking;
        const smartTitle = smartExtractArticle(rawText); if (smartTitle && !document.getElementById('itemName').value) setItemName(smartTitle);
        const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length >= 5 && l.length <= 60);
        const chipsContainer = document.getElementById('ocrChips');
        if (lines.length > 0) {
            document.getElementById('ocrSuggestionsBox').classList.remove('hidden');
            chipsContainer.innerHTML = lines.slice(0, 8).map(line => '<button type="button" onclick="setItemName(\'' + escapeHtml(line).replace(/'/g, "\\'") + '\')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-1 rounded-xl text-xs transition truncate max-w-full">' + escapeHtml(line) + '</button>').join('');
            ocrBadge.textContent = t('itemDetected'); ocrBadge.className = 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-md px-2 py-0.5 text-xs';
        } else { ocrBadge.textContent = t('noTextDetected'); }
    } catch (e) { ocrBadge.textContent = t('ocrSkipped'); }
}

function resetForm() {
    selectedQrFile = null; originalUploadFile = null; fullScreenshotUrl = null; currentCroppedQrDataUrl = null;
    document.getElementById('qrInputFile').value = ''; document.getElementById('qrData').value = ''; document.getElementById('itemName').value = ''; document.getElementById('platform').value = '';
    document.getElementById('ocrSuggestionsBox').classList.add('hidden'); document.getElementById('returnForm').classList.add('hidden');
}

function openFormQrPreview() {
    const qrText = document.getElementById('qrData').value.trim();
    document.getElementById('modalCounterBadge').classList.add('hidden'); document.getElementById('modalBatchNav').classList.add('hidden'); document.getElementById('modalViewToggleWrap').classList.add('hidden');
    document.getElementById('modalPlatformBadge').textContent = document.getElementById('platform').value || t('previewBadge');
    document.getElementById('modalTitle').textContent = document.getElementById('itemName').value || t('isolatedCodeLabel');
    document.getElementById('modalSubtitle').textContent = qrText;
    const c = document.getElementById('modalContent'); c.innerHTML = '';
    if (currentCroppedQrDataUrl) { c.innerHTML = '<img src="' + currentCroppedQrDataUrl + '" class="max-h-72 object-contain rounded-lg">'; } 
    else if (qrText) { const d = document.createElement('div'); c.appendChild(d); new QRCode(d, { text: qrText, width: 240, height: 240 }); } 
    else { return; }
    openLightboxWithWakeLock();
}

function openFullScreenshotPreview() {
    if (!fullScreenshotUrl) return;
    document.getElementById('modalCounterBadge').classList.add('hidden'); document.getElementById('modalBatchNav').classList.add('hidden'); document.getElementById('modalViewToggleWrap').classList.add('hidden');
    document.getElementById('modalPlatformBadge').textContent = t('originalFileBadge'); document.getElementById('modalTitle').textContent = t('originalScreenshotBtn'); document.getElementById('modalSubtitle').textContent = '';
    document.getElementById('modalContent').innerHTML = '<img src="' + fullScreenshotUrl + '" class="max-h-[65vh] object-contain rounded-lg">';
    openLightboxWithWakeLock();
}

function toggleCamera() {
    const c = document.getElementById('cameraContainer');
    if (!c.classList.contains('hidden')) { stopCamera(); return; }
    c.classList.remove('hidden');
    html5QrScanner = new Html5Qrcode("reader");
    html5QrScanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 200 } }, (text) => {
        selectedQrFile = null; originalUploadFile = null; fullScreenshotUrl = null;
        document.getElementById('previewFullImgBtn').classList.add('hidden'); document.getElementById('qrData').value = text;
        updateDedicatedQrPreview(null, text, null); document.getElementById('scanStatusBadge').textContent = t('cameraCaptured');
        const guessed = detectPlatformFromText(text); if (guessed) setPlatform(guessed);
        document.getElementById('returnForm').classList.remove('hidden'); stopCamera();
    }, () => {}).catch(() => { alert(t('alertCameraHttps')); c.classList.add('hidden'); });
}
function stopCamera() { if (html5QrScanner) { html5QrScanner.stop().catch(()=>{}).finally(()=>document.getElementById('cameraContainer').classList.add('hidden')); } else { document.getElementById('cameraContainer').classList.add('hidden'); } }

function setFilter(f) {
    currentFilter = f;
    ['pending', 'completed', 'settings'].forEach(k => {
        const btn = document.getElementById('tab-' + k);
        if (btn) btn.className = k === f ? 'flex-1 bg-blue-600 text-white font-semibold px-2.5 py-2 rounded-lg text-xs transition shadow-md' : 'flex-1 text-slate-400 hover:text-slate-200 font-medium px-2.5 py-2 rounded-lg text-xs transition';
    });
    const mainView = document.getElementById('mainView'); const settingsView = document.getElementById('settingsView');
    if (f === 'settings') {
        mainView.classList.add('hidden');
        settingsView.classList.remove('hidden');
        document.getElementById('setServerUrl').value = SERVER_URL;
        document.getElementById('setDeviceUser').value = DEVICE_USER;
        loadSettings();
    } else {
        settingsView.classList.add('hidden');
        mainView.classList.remove('hidden');
        renderReturns();
    }
}

async function loadReturns() {
    allReturns = await apiGetReturns();
    updateShopModeButtons();
    if (currentFilter !== 'settings') renderReturns();
}

function updateShopModeButtons() {
    const openCount = allReturns.filter(r => (r.status || 'pending') === 'pending').length;
    const topBtn = document.getElementById('shopModeTopBtn'); const cardBtn = document.getElementById('shopModeCardBtn');
    if (openCount > 0) {
        topBtn.textContent = t('shopModeBtn', { n: openCount }); cardBtn.textContent = t('shopModeStartBtn', { n: openCount });
        topBtn.classList.remove('hidden'); cardBtn.classList.remove('hidden');
    } else { topBtn.classList.add('hidden'); cardBtn.classList.add('hidden'); }
}

function formatImageSrc(pathOrDataUrl) {
    if (!pathOrDataUrl) return '';
    if (pathOrDataUrl.startsWith('data:') || pathOrDataUrl.startsWith('blob:') || pathOrDataUrl.startsWith('http')) return pathOrDataUrl;
    return getApiUrl('/' + pathOrDataUrl.replace(/^\/+/, ''));
}

function renderReturns() {
    const list = document.getElementById('returnsList');
    const filtered = allReturns.filter(r => (r.status || 'pending') === currentFilter);
    document.getElementById('counterText').textContent = t('entriesCount', { n: filtered.length });

    if (!filtered.length) {
        list.innerHTML = '<div class="bg-slate-950 border border-slate-800/80 rounded-xl p-6 text-center text-slate-400 text-sm">' + t('noReturnsInView') + '</div>';
        return;
    }

    list.innerHTML = filtered.map(r => {
        const isDone = r.status === 'completed';
        const isPriv = r.is_private === 1 || r.is_private === true;
        const statusBadge = isDone ? '<span class="bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-md px-2 py-0.5 text-xs">' + t('statusCompleted') + '</span>' : '<span class="bg-amber-950 text-amber-300 border border-amber-800/60 rounded-md px-2 py-0.5 text-xs">' + t('statusPending') + '</span>';
        const privBadge = isPriv ? `<button onclick="togglePrivacy(${r.id}, true)" class="bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800/60 rounded-md px-2 py-0.5 text-xs flex items-center transition">${t('privateBadge')}</button>` : `<button onclick="togglePrivacy(${r.id}, false)" class="bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded-md px-2 py-0.5 text-xs flex items-center transition">${t('sharedBadge')}</button>`;
        const trackingUrl = buildTrackingUrl(r.platform, r.qr_data);
        const trackingBtn = trackingUrl ? '<a href="' + escapeHtml(trackingUrl) + '" target="_blank" rel="noopener noreferrer" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-1.5 rounded-xl text-xs transition">' + t('trackShipment') + '</a>' : '';

        const qrBox = r.qr_image_path ? '<img src="' + formatImageSrc(r.qr_image_path) + '" onclick="showQrModal(' + r.id + ')" title="' + t('tapToMaximize') + '" class="w-16 h-16 object-contain bg-white p-1 rounded-lg cursor-pointer shrink-0">' : '<div id="qr-mini-' + r.id + '" onclick="showQrModal(' + r.id + ')" title="' + t('tapToMaximize') + '" class="w-16 h-16 bg-white p-1 rounded-lg flex items-center justify-center cursor-pointer shrink-0"></div>';
        const recBox = r.receipt_path ? '<div class="flex items-center justify-between gap-3"><button onclick="showReceiptModal(' + r.id + ')" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-4 py-2 rounded-xl text-sm transition">' + t('viewReceiptBtn') + '</button><img src="' + formatImageSrc(r.receipt_path) + '" onclick="showReceiptModal(' + r.id + ')" class="w-14 h-14 object-cover rounded-lg border border-slate-800 cursor-pointer shrink-0"></div>' : '<div class="space-y-2"><input type="file" id="receipt-input-' + r.id + '" accept="image/*" capture="environment" onchange="previewReceiptBtn(' + r.id + ')" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200"><button id="receipt-btn-' + r.id + '" onclick="uploadReceiptWithOcr(' + r.id + ')" class="hidden w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition shadow-md">' + t('saveReceiptBtn') + '</button></div>';

        return `<div class="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 sm:p-4 space-y-4">
            <div class="flex items-start justify-between gap-3"><div><div class="flex items-center gap-2 flex-wrap">
            <span class="bg-blue-950 text-blue-300 border border-blue-800/60 rounded-md px-2 py-0.5 text-xs">${escapeHtml(r.platform)}</span>
            ${statusBadge} ${privBadge} ${r.created_at ? '<span class="text-xs text-slate-400">' + escapeHtml(r.created_at) + '</span>' : ''}
            </div><h3 class="font-bold text-base mt-2 text-white">${escapeHtml(r.item_name)}</h3>
            ${r.qr_data ? '<p class="text-xs text-slate-400 font-mono mt-1 break-all">' + t('trackingPrefix') + escapeHtml(r.qr_data) + '</p>' : ''}
            </div><div class="flex items-center gap-2 flex-wrap justify-end">${trackingBtn}<button onclick="deleteReturn(${r.id})" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-1.5 rounded-xl text-xs transition">${t('deleteBtn')}</button></div></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-slate-800/80">
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"><div><span class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">${t('returnCodeLabel')}</span><button onclick="showQrModal(${r.id})" class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-xl text-xs transition shadow-md">${t('maximizeBtn')}</button></div>${qrBox}</div>
            <div class="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"><span class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">${t('receiptLabel')}</span>${recBox}</div></div>
            <div class="flex justify-end pt-1"><button onclick="toggleStatus(${r.id}, '${isDone ? 'pending' : 'completed'}')" class="${isDone ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'} font-medium px-4 py-2.5 rounded-xl text-sm transition">${isDone ? t('markPendingBtn') : t('markCompletedBtn')}</button></div></div>`;
    }).join('');
    filtered.forEach(r => { if (!r.qr_image_path && r.qr_data) { const el = document.getElementById('qr-mini-' + r.id); if (el) { el.innerHTML = ''; new QRCode(el, { text: r.qr_data, width: 56, height: 56 }); } } });
}

async function apiUpdateStatus(id, status) {
    if (!IS_LOCAL_MODE) {
        await fetch(getApiUrl(`/api/returns/${id}/status`), { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    } else {
        const nowStr = status === 'completed' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null; const db = await openLocalDb();
        await new Promise((resolve) => { const tx = db.transaction('returns', 'readwrite'); const store = tx.objectStore('returns'); const g = store.get(Number(id));
            g.onsuccess = () => { if (g.result) { g.result.status = status; g.result.completed_at = nowStr; store.put(g.result); } resolve(); };
        });
    }
}
async function toggleStatus(id, status) { await apiUpdateStatus(id, status); loadReturns(); }

async function apiDeleteReturn(id) {
    if (!IS_LOCAL_MODE) { await fetch(getApiUrl(`/api/returns/${id}`), { method: 'DELETE', headers: getAuthHeaders() }); } 
    else { const db = await openLocalDb(); await new Promise((resolve) => { const tx = db.transaction('returns', 'readwrite'); tx.objectStore('returns').delete(Number(id)); tx.oncomplete = () => resolve(); }); }
}
async function deleteReturn(id) { if (!confirm(t('confirmDelete'))) return; await apiDeleteReturn(id); loadReturns(); }

function previewReceiptBtn(id) { if (document.getElementById('receipt-input-' + id).files.length > 0) document.getElementById('receipt-btn-' + id).classList.remove('hidden'); }
async function uploadReceiptWithOcr(id) {
    const input = document.getElementById('receipt-input-' + id); const btn = document.getElementById('receipt-btn-' + id);
    if (!input.files[0]) return; btn.disabled = true; btn.textContent = t('checkingReceiptOcr');
    let dt = ''; try { const res = await Tesseract.recognize(input.files[0], 'deu+eng'); dt = extractTrackingNumberFromText(res.data.text || ''); } catch (e) {}
    
    if (!IS_LOCAL_MODE) {
        const fd = new FormData(); fd.append('receipt', input.files[0]); if (dt) fd.append('qr_data', dt);
        await fetch(getApiUrl(`/api/returns/${id}/receipt`), { method: 'POST', headers: getAuthHeaders(), body: fd });
    } else {
        const recDataUrl = await fileToDataUrl(input.files[0]); const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' '); const db = await openLocalDb();
        await new Promise((resolve) => {
            const tx = db.transaction('returns', 'readwrite'); const store = tx.objectStore('returns'); const g = store.get(Number(id));
            g.onsuccess = () => { if (g.result) { g.result.receipt_path = recDataUrl; if (dt) g.result.qr_data = dt; g.result.status = 'completed'; g.result.completed_at = nowStr; store.put(g.result); } resolve(); };
        });
    }
    loadReturns();
}

function openBatchModal(startIndex = 0) {
    batchItems = allReturns.filter(r => (r.status || 'pending') === 'pending');
    if (batchItems.length === 0) return;
    batchIndex = Math.max(0, Math.min(startIndex, batchItems.length - 1));
    showingOriginalInModal = false; renderCurrentBatchItem(); openLightboxWithWakeLock();
}
function stepBatchModal(delta) {
    if (batchItems.length <= 1) return;
    batchIndex = (batchIndex + delta + batchItems.length) % batchItems.length;
    showingOriginalInModal = false; renderCurrentBatchItem();
}
function showQrModal(id) {
    const openList = allReturns.filter(r => (r.status || 'pending') === 'pending');
    const idxInOpen = openList.findIndex(r => r.id === id);
    if (idxInOpen !== -1 && openList.length > 1) { openBatchModal(idxInOpen); return; }
    const item = allReturns.find(r => r.id === id); if (!item) return;
    batchItems = [item]; batchIndex = 0; showingOriginalInModal = false; renderCurrentBatchItem(); openLightboxWithWakeLock();
}
function renderCurrentBatchItem() {
    const item = batchItems[batchIndex]; if (!item) return; currentModalItem = item;
    const counterBadge = document.getElementById('modalCounterBadge'); const batchNav = document.getElementById('modalBatchNav');
    if (batchItems.length > 1) { counterBadge.textContent = t('pkgCounter', { cur: batchIndex + 1, total: batchItems.length }); counterBadge.classList.remove('hidden'); batchNav.classList.remove('hidden'); } else { counterBadge.classList.add('hidden'); batchNav.classList.add('hidden'); }
    document.getElementById('modalPlatformBadge').textContent = item.platform; document.getElementById('modalTitle').textContent = item.item_name; document.getElementById('modalSubtitle').textContent = item.qr_data ? t('codePrefix') + item.qr_data : t('noTextCode');
    const hasOriginal = Boolean(item.original_image_path); const toggleWrap = document.getElementById('modalViewToggleWrap'); const toggleBtn = document.getElementById('modalToggleOrigBtn');
    if (hasOriginal) { toggleWrap.classList.remove('hidden'); toggleBtn.textContent = showingOriginalInModal ? t('showIsolatedQr') : t('showOrigScreenshot'); } else { toggleWrap.classList.add('hidden'); }
    const c = document.getElementById('modalContent'); c.innerHTML = '';
    if (showingOriginalInModal && item.original_image_path) { c.innerHTML = '<img src="' + formatImageSrc(item.original_image_path) + '" class="max-h-[60vh] object-contain rounded-lg">'; } else if (item.qr_image_path) { c.innerHTML = '<img src="' + formatImageSrc(item.qr_image_path) + '" class="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-lg">'; } else if (item.qr_data) { const d = document.createElement('div'); c.appendChild(d); new QRCode(d, { text: item.qr_data, width: 256, height: 256 }); } else { c.innerHTML = '<p class="text-sm text-slate-600 py-6">' + t('noImageStored') + '</p>'; }
}
function toggleModalOriginalView() { showingOriginalInModal = !showingOriginalInModal; renderCurrentBatchItem(); }
function showReceiptModal(id) {
    const item = allReturns.find(r => r.id === id); if (!item || !item.receipt_path) return;
    batchItems = []; document.getElementById('modalCounterBadge').classList.add('hidden'); document.getElementById('modalBatchNav').classList.add('hidden'); document.getElementById('modalViewToggleWrap').classList.add('hidden');
    document.getElementById('modalPlatformBadge').textContent = item.platform; document.getElementById('modalTitle').textContent = item.item_name; document.getElementById('modalSubtitle').textContent = t('receiptLabel');
    document.getElementById('modalContent').innerHTML = '<img src="' + formatImageSrc(item.receipt_path) + '" class="max-h-[65vh] object-contain rounded-lg">';
    openLightboxWithWakeLock();
}

let touchStartX = 0; const modalCardEl = document.getElementById('modalCard');
modalCardEl.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
modalCardEl.addEventListener('touchend', (e) => { const diff = e.changedTouches[0].screenX - touchStartX; if (Math.abs(diff) > 50 && batchItems.length > 1) { stepBatchModal(diff < 0 ? 1 : -1); } }, { passive: true });

async function openLightboxWithWakeLock() { document.getElementById('lightboxModal').classList.remove('hidden'); if ('wakeLock' in navigator) { try { wakeLockObj = await navigator.wakeLock.request('screen'); } catch (e) {} } }
function closeModal() { document.getElementById('lightboxModal').classList.add('hidden'); if (wakeLockObj) { wakeLockObj.release().catch(() => {}); wakeLockObj = null; } }

async function apiSaveSettings(payload) {
    if (!IS_LOCAL_MODE) { await fetch(getApiUrl('/api/settings'), { method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } 
    else { const db = await openLocalDb(); await new Promise((resolve) => { const tx = db.transaction('settings', 'readwrite'); const store = tx.objectStore('settings'); Object.entries(payload).forEach(([k, v]) => store.put({ key: k, value: String(v) })); tx.oncomplete = () => resolve(); }); }
}

async function loadSettings() {
    const s = await apiGetSettings();
    document.getElementById('setCleanupEnabled').checked = s.cleanup_enabled === 'true'; document.getElementById('setCleanupDays').value = s.cleanup_days || '90'; document.getElementById('setCleanupMode').value = s.cleanup_mode || 'files_only';
    document.getElementById('setWebhookEnabled').checked = s.webhook_enabled === 'true'; document.getElementById('setWebhookUrl').value = s.webhook_url || ''; document.getElementById('setWebhookDays').value = s.webhook_days || '10';
    const badge = document.getElementById('cleanupStatusBadge');
    if (s.cleanup_enabled === 'true') { badge.textContent = t('cleanupActive', { n: s.cleanup_days }); badge.className = 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 rounded-md px-2 py-0.5 text-xs'; } else { badge.textContent = t('cleanupInactive'); badge.className = 'bg-slate-950 text-slate-400 border border-slate-800 rounded-md px-2 py-0.5 text-xs'; }
}

async function saveSettings() {
    const payload = { cleanup_enabled: document.getElementById('setCleanupEnabled').checked ? 'true' : 'false', cleanup_days: document.getElementById('setCleanupDays').value, cleanup_mode: document.getElementById('setCleanupMode').value, webhook_enabled: document.getElementById('setWebhookEnabled').checked ? 'true' : 'false', webhook_url: document.getElementById('setWebhookUrl').value.trim(), webhook_days: document.getElementById('setWebhookDays').value };
    await apiSaveSettings(payload); await loadSettings(); alert(t('alertSettingsSaved'));
}

async function apiRunCleanup(days, mode, dryRun) {
    if (!IS_LOCAL_MODE) {
        const endpoint = dryRun ? '/api/cleanup/preview' : '/api/cleanup/run';
        const res = await fetch(getApiUrl(endpoint), { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ days, mode }) });
        if (res.ok) return await res.json();
        return { count: 0 };
    } else {
        const cutoffMs = Date.now() - (parseInt(days, 10) || 90) * 86400000; const all = await apiGetReturns();
        const expired = all.filter(r => { if (r.status !== 'completed') return false; const dt = Date.parse((r.completed_at || r.created_at || '').replace(' ', 'T')); return !isNaN(dt) && dt <= cutoffMs; });
        if (dryRun || expired.length === 0) return { count: expired.length };
        const db = await openLocalDb();
        return new Promise((resolve) => {
            const tx = db.transaction('returns', 'readwrite'); const store = tx.objectStore('returns');
            expired.forEach(r => { if (mode === 'delete_all') { store.delete(r.id); } else { r.qr_image_path = null; r.original_image_path = null; r.receipt_path = null; store.put(r); } });
            tx.oncomplete = () => resolve({ count: expired.length });
        });
    }
}

async function runManualCleanup() {
    const days = document.getElementById('setCleanupDays').value; const mode = document.getElementById('setCleanupMode').value;
    const prev = await apiRunCleanup(days, mode, true);
    if (!prev.count) return alert(t('alertNoCleanupItems', { days }));
    if (!confirm(t('confirmCleanup', { count: prev.count, days }))) return;
    const out = await apiRunCleanup(days, mode, false); alert(t('alertCleanedUp', { count: out.count })); loadReturns();
}

async function sendTestWebhook() {
    const url = document.getElementById('setWebhookUrl').value.trim(); if (!url) return alert(t('alertEnterWebhook'));
    try { await fetch(url, { method: 'POST', headers: { 'Title': 'ReTrack Test' }, body: 'ReTrack webhook test notification successful.' }); alert(t('alertTestSent')); } catch (e) { alert(t('alertTestFailed') + ': ' + e.message); }
}

document.addEventListener('click', async (e) => {
    const link = e.target.closest('a[href="/api/backup/export"]');
    if (!link || IS_LOCAL_MODE) return;
    e.preventDefault();
    const settings = await apiGetSettings(); const returns = await apiGetReturns();
    const payload = { app: 'ReTrack', version: 3, exported_at: new Date().toISOString(), settings, returns };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `retrack-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
});

function restoreBackupFile(event) {
    const file = event.target.files[0]; if (!file) return;
    if (!confirm(t('confirmRestore'))) { event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (!IS_LOCAL_MODE) {
                const res = await fetch(getApiUrl('/api/backup/restore'), { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(json) });
                const out = await res.json(); if (res.ok) { alert(t('alertRestoreSuccess', { count: out.count })); loadReturns(); loadSettings(); } else { alert(out.error || t('alertInvalidBackup')); }
                return;
            } else {
                if (json.settings) await apiSaveSettings(json.settings);
                const db = await openLocalDb();
                const tx = db.transaction('returns', 'readwrite'); const store = tx.objectStore('returns'); store.clear();
                (json.returns || []).forEach(r => store.put(r));
                tx.oncomplete = () => { alert(t('alertRestoreSuccess', { count: (json.returns || []).length })); loadReturns(); loadSettings(); };
            }
        } catch (err) { alert(t('alertInvalidBackup')); }
    };
    reader.readAsText(file);
}

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

(async function initApp() {
    applyLanguage();

    const urlInput = document.getElementById('setServerUrl');
    const userInput = document.getElementById('setDeviceUser');
    if (urlInput && SERVER_URL) urlInput.value = SERVER_URL;
    if (userInput && DEVICE_USER) userInput.value = DEVICE_USER;

    if (!SERVER_URL && !window.Capacitor && window.location.protocol.startsWith('http')) {
        try {
            const res = await fetch('/api/ping');
            if (res.ok) {
                SERVER_URL = window.location.origin;
                localStorage.setItem('retrack_server_url', SERVER_URL);
                if (urlInput) urlInput.value = SERVER_URL;
            }
        } catch (e) {}
    }

    await loadReturns();
    if (SERVER_URL) {
        const s = await apiGetSettings();
        if (s.cleanup_enabled === 'true') await apiRunCleanup(s.cleanup_days, s.cleanup_mode, false);
    }
})();