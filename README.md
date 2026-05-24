# The Scribbler's Almanac

A literary PWA for the curious mind. Three pillars — daily curated prose, a personal commonplace book, and a distraction-free writing atelier — all offline-first, all free to host.

---

## File Structure

```
almanac/
├── index.html       ← App shell and all three views
├── style.css        ← All styles and layout
├── app.js           ← All app logic (IndexedDB, views, PWA)
├── stories.js       ← Public domain content catalog
├── sw.js            ← Service worker (offline caching)
├── manifest.json    ← PWA manifest (install metadata)
├── README.md        ← This file
└── icons/
    ├── icon-192.png ← App icon (192×192)
    └── icon-512.png ← App icon (512×512)
```

---

## Hosting on GitHub Pages (Recommended — Free)

### Step 1 — Create a GitHub repository

1. Go to [github.com](https://github.com) and sign in
2. Click **New repository**
3. Name it `scribblersalmanac` (or any name you like)
4. Set it to **Public**
5. Click **Create repository**

### Step 2 — Upload the files

**Option A — GitHub web interface (no Git needed)**

1. Open your new repository
2. Click **Add file → Upload files**
3. Drag and drop all the files: `index.html`, `style.css`, `app.js`, `stories.js`, `sw.js`, `manifest.json`
4. Create the `icons/` folder by uploading icons with the path `icons/icon-192.png` and `icons/icon-512.png`
5. Click **Commit changes**

**Option B — Git command line**

```bash
git clone https://github.com/YOUR-USERNAME/scribblersalmanac.git
cd scribblersalmanac

# Copy all your files into this folder, then:
git add .
git commit -m "Initial commit — The Scribbler's Almanac"
git push origin main
```

### Step 3 — Enable GitHub Pages

1. In your repository, go to **Settings → Pages**
2. Under **Source**, select **Deploy from a branch**
3. Choose branch: **main**, folder: **/ (root)**
4. Click **Save**
5. Wait 1–2 minutes, then your app is live at:

```
https://YOUR-USERNAME.github.io/scribblersalmanac/
```

---

## Adding the App Icons

The PWA needs two PNG icons. You have two options:

**Option A — Generate online (easiest)**

1. Go to [realfavicongenerator.net](https://realfavicongenerator.net)
2. Upload any square image (a quill, book, or letter "A" on a dark background works well)
3. Download the package and use the 192×192 and 512×512 PNGs
4. Rename them `icon-192.png` and `icon-512.png`
5. Upload them into an `icons/` folder in your repository

**Option B — Quick placeholder (to test immediately)**

You can temporarily point both icon paths to any hosted image URL, or create a simple SVG icon. The app will work without icons — they are only needed for the install prompt and home screen.

---

## Installing on Your Devices

### Android (Chrome)
1. Open the app URL in Chrome
2. Tap the **⋮ menu → Add to Home screen**
3. Or wait for the install banner to appear automatically after a few seconds

### iPhone / iPad (Safari)
1. Open the app URL in Safari
2. Tap the **Share button** (box with arrow)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**

### Windows / Mac (Chrome or Edge)
1. Open the app URL
2. Look for the **install icon** in the address bar (a screen with a down arrow)
3. Click it and then click **Install**

---

## Updating the App

To update content or fix bugs after the first deploy:

1. Edit your files locally
2. Push the changes to GitHub:

```bash
git add .
git commit -m "Update: describe your change"
git push origin main
```

3. GitHub Pages re-deploys automatically within 1–2 minutes
4. **Important:** Bump the cache version in `sw.js` when you make changes, so users get the update:

```js
// sw.js — change v1 to v2 (or v3 etc.)
const VERSION = 'almanac-v2';
```

---

## Adding More Stories

Open `stories.js` and add a new object to the `STORIES` array:

```js
{
  id: 8,                          // next sequential number
  title: "The Gift of the Magi",
  author: "O. Henry",
  year: 1905,
  genre: "Irony",
  prompt: "Write about a sacrifice made out of love that turns out to be unnecessary.",
  paragraphs: [
    "First paragraph text here...",
    "Second paragraph text here...",
    // add as many paragraphs as you like
  ]
}
```

Good sources for free public domain texts:
- [gutenberg.org](https://gutenberg.org) — thousands of books and stories
- [americanliterature.com](https://americanliterature.com) — short stories in clean format
- [poets.org](https://poets.org) — poetry archive

---

## Alternative Free Hosting Options

| Platform | Notes |
|---|---|
| **GitHub Pages** | Best for this app. Free SSL, global CDN, no limits for static files. |
| **Netlify** | Also excellent. Drag-and-drop deploy at [app.netlify.com](https://app.netlify.com). Better PWA headers out of the box. |
| **Cloudflare Pages** | Fastest global CDN. Connect your GitHub repo and it deploys on every push. |
| **Vercel** | Great for developers. Also connects to GitHub for auto-deploy. |

All four options are completely free for a static PWA with no backend.

---

## Data & Privacy

All your data — saved quotes, written pieces, reading preferences — is stored **entirely on your own device** using IndexedDB. Nothing is ever sent to any server. No accounts, no tracking, no cloud.

The only network requests the app makes are:
- Loading Google Fonts on first visit (then cached offline)
- Fetching app files from GitHub Pages (also cached offline)

**Back up your data regularly** using the **Export** button in the sidebar. This downloads a `.json` file you can import on any other device or browser.

---

## License

All application code is yours to use, modify, and share freely.

The public domain texts in `stories.js` are sourced from works published before 1928 and are in the public domain worldwide.
