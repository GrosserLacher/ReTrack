# ReTrack 📦🔍

ReTrack is a lightweight, self-hosted Progressive Web App (PWA) and standalone Android application for managing and tracking your online returns (e.g., Amazon, DHL, Hermes, DPD, GLS, UPS, Zalando, Otto, eBay, and more).

Featuring an integrated QR code scanner (camera or screenshot upload), intelligent client-side OCR for item names, platforms, and tracking numbers, drop-off receipt uploads as proof of return, and a dedicated full-screen Parcel Shop swipe mode. Built with a clean Dark Mode UI and full **German / English** language support.

## ✨ Features

- **Bilingual Interface (DE / EN):** Instant language toggle in the top right corner (persisted locally).
- **Dual-Mode Architecture (Docker Server & Standalone APK):** Runs either on your homelab server (Node.js + SQLite) or 100% locally offline on your Android device via IndexedDB.
- **PWA & Web-Share-Target:** Installable as a native app. Share return QR code screenshots directly from your shopping app via the Android share menu to ReTrack.
- **Smart QR Code Isolation:** Automatically detects QR codes on uploaded screenshots (via `jsQR`), crops them cleanly with a quiet zone, and keeps the full original screenshot as a toggleable fallback.
- **QR Code & Label Capture:** Scan live via your smartphone/webcam or upload images/screenshots directly (including `Ctrl + V` clipboard paste support on desktop).
- **Intelligent OCR (Text Recognition):** Analyzes uploaded screenshots locally in the browser (via `Tesseract.js`), filters out noise, and automatically suggests item descriptions and platforms.
- **1-Click Text Chips:** Displays all detected text lines from the return label as clickable chips—no manual typing required.
- **Receipt OCR & Shipment Tracking:** Photograph or upload your drop-off receipt. ReTrack automatically extracts the tracking number (e.g., `JJD...`, `0034...`, `1Z...`), generates direct tracking links (DHL, Hermes, DPD, GLS, UPS), and marks the return as *Completed*.
- **Parcel Shop Mode (Batch-Swipe Lightbox):** Displays all pending return codes in high contrast on a white background. Swipe left/right through multiple packages, toggle the original screenshot at any time, and keep your screen awake automatically via the *Screen Wake Lock API*.
- **Deadline Reminders (Webhooks):** Optional background check that sends push notifications via **ntfy**, **Gotify**, or **Discord** when pending returns remain open for too long.
- **Auto-Cleanup (Storage Hygiene):** Optional automatic cleanup of image files or entire records for completed returns after a configurable retention period (30, 60, 90, 180, or 365 days).
- **1-Click Backup & Restore:** Export and import the complete database including all images and receipts as a single JSON archive directly from the settings tab.

## 📁 Project Structure

```text
ReTrack/
├── .github/workflows/
│   └── build-release.yml # Automated GitHub Action for Android APK builds
├── capacitor.config.json # Capacitor configuration for standalone Android APK
├── docker-compose.yml    # Docker Compose configuration with volume mounts
├── Dockerfile            # Node.js container build instructions
├── server.js             # Express.js & SQLite backend (Upload, Backup & Webhook API)
├── package.json          # Node.js & Capacitor dependencies
├── .gitignore            # Excludes database and personal uploads from Git
├── README.md             # Project documentation
├── public/               # Static frontend files (Live-Mount & Capacitor webDir)
│   ├── index.html        # User interface (Tailwind CSS Dark Mode, DE/EN)
│   ├── app.js            # Dual-mode logic, i18n, QR isolation, scanner & OCR
│   ├── manifest.json     # Web App Manifest (including Web-Share-Target)
│   ├── sw.js             # Service Worker (including Share-Target interceptor)
│   ├── icon-192.png      # App icon & favicon (192x192 px)
│   └── icon-512.png      # High-res app icon (512x512 px)
├── data/                 # Persistent SQLite database (returns.db)
└── uploads/              # Persistent storage for QR codes, screenshots & receipts
```

## 📱 Option A: Android Standalone APK (No Server Required)

Don't have a home server? You can use ReTrack as a **100% local standalone Android app**. All data and images are stored directly on your device using IndexedDB.

1. Go to the [**Releases**](https://github.com/grosserlacher/ReTrack/releases) page of this repository.
2. Download the latest `ReTrack-Light-Standalone.apk` to your Android smartphone and install it.
3. Every push or tag (`v*`) to this repository automatically builds a fresh APK via **GitHub Actions**.

---

## 🚀 Option B: Self-Hosted Installation (Docker)

### Prerequisites
- A server or local system with **Docker** and **Docker Compose** installed.

### Method 1: Use the Pre-Built `latest` Image (Recommended)

You don't need to clone the repository or build the image yourself. Simply create a directory, add a `docker-compose.yml`, and start the container:

```bash
mkdir retrack && cd retrack
nano docker-compose.yml
```

Paste the following configuration into `docker-compose.yml`:

```yaml
version: '3.8'

services:
  return-tracker:
    image: ghcr.io/grosserlacher/retrack:latest
    container_name: retrack
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
    restart: unless-stopped
```

Start the container:

```bash
docker compose up -d
```

To update to the latest version later on:

```bash
docker compose pull && docker compose up -d
```

### Method 2: Clone Repository & Build Locally (Developers / Live-Mount)

If you want to modify the source code or customize the frontend in `public/`:

```bash
git clone [https://github.com/grosserlacher/ReTrack.git](https://github.com/grosserlacher/ReTrack.git)
cd ReTrack
docker compose up -d --build
```

The included `docker-compose.yml` mounts `data/`, `uploads/`, and `public/` as live volumes:

```yaml
version: '3.8'

services:
  return-tracker:
    build: .
    container_name: retrack
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads
      - ./public:/app/public
    restart: unless-stopped
```

**Advantage:** Changes made to files in `public/` (`index.html`, `app.js`, or icons) take effect immediately upon refreshing your browser without rebuilding the Docker image.

The web application is immediately available at:
👉 `http://<Your-Server-IP>:3000`

## 🔄 Usage & Workflow

1. **Capture a Return:**
   - **Direct Share (Android Web-Share-Target):** Take a screenshot of the return QR code in your shopping app (e.g., Amazon), tap *Share* in the Android screenshot preview, and select **ReTrack**.
   - **On Desktop:** Take a screenshot (`Win + Shift + S`) containing both the QR code and item title, open ReTrack, and press `Ctrl + V` (or select the file manually).
   - **Via Camera:** Use the built-in camera scanner to scan a physical or digital code.
2. **Verify & Save:**
   - ReTrack automatically isolates the QR code and uses OCR to fill in the platform and item description (or lets you pick from clickable text chips). Click **Save Return**.
3. **At the Parcel Shop:**
   - Open the app (*Pending* tab) and tap **Parcel Shop Mode** (or *Maximize* on an individual item).
   - Swipe left/right through all open packages and let the clerk scan the codes directly from your screen. You can toggle the full original screenshot at any time.
4. **Save Drop-Off Receipt & Track:**
   - Under *Drop-Off Receipt* on the return card, take a photo of your printed receipt and tap **Save Receipt (incl. Tracking OCR)**.
   - The tracking number is automatically extracted, the **Track Shipment** button is unlocked, and the return moves to the *Completed* tab.

## 🔒 Notes on HTTPS, Camera & PWA Installation

Modern browsers (Chrome, Safari, Firefox, Edge) require a secure **HTTPS connection** (or `http://localhost`) for security reasons to enable:
1. The Service Worker for PWA installation and **Web-Share-Target**.
2. Camera access (`getUserMedia`) in the browser.
3. The `Screen Wake Lock API` (keeping the display awake in Parcel Shop Mode).

**Recommended Homelab Setup:**
Run ReTrack behind a reverse proxy with an SSL certificate (e.g., Nginx Proxy Manager, Traefik, or Caddy) and/or access it securely on the go via your own VPN (e.g., Headscale / Tailscale or WireGuard).

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, Multer (multipart file uploads), SQLite3, Zlib (fallback icon generator)
- **Frontend & Mobile:** HTML5, Tailwind CSS (CDN), Vanilla JavaScript, IndexedDB (offline storage), Capacitor (Android APK)
- **Libraries:**
  - `jsQR` (Precise QR code localization & canvas cropping)
  - `html5-qrcode` (Live camera & file scanner)
  - `tesseract.js` (Client-side OCR for item names & drop-off receipts)
  - `qrcode.js` (Fallback QR code generator)

## 📄 License

This project is licensed under the **MIT License** – free for personal and commercial use as well as modification.