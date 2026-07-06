# BerrizReader Web App

BerrizReader is a serverless, frontend-only web application designed as a desktop-friendly archive reader. It replicates the functionality of a native Android app, parsing a SQLite database of conversations directly in the browser using WebAssembly. 

This project was built iteratively using an AI Coding Agent, and this README serves as context for future agentic development.

## Tech Stack & Architecture

- **Frontend Core**: Vanilla HTML, CSS (Custom Properties/Flexbox), and ES6 Modules (`app.js`). Zero build step (no Webpack/Vite/Babel) for maximum simplicity.
- **Database Engine**: [sql.js](https://sql.js.org/) (SQLite compiled to WebAssembly) is used to execute SQL queries entirely on the client-side.
- **Data Source**: A pre-compiled `berriz_v2.db` SQLite database hosted on a public Google Cloud Storage (GCS) bucket.
- **Local Storage (Offline-First)**: The browser's native **IndexedDB** is used to cache the 5+ MB database. The app loads instantly from the local cache and only hits the network when the user explicitly clicks the "Sync" button.

## Agentic Development Context

If you are an AI agent analyzing this repo for future modifications, here is a summary of the historical implementation choices:

### 1. Database & Schema Handling
- The app relies primarily on a view (or flattened table) called `combined_view`, which joins data from `posts`, `artist_activity`, and `media_files`.
- **Media**: Media file paths are aggregated using `GROUP_CONCAT(localFilePath)` by matching `contentId` to `postId` or `artistContentId`.
- **Cultural Notes**: The database has a single `cultural_notes` column in `combined_view`. When processing rows in `app.js`, we group them by `postId` into thread objects. The `cultural_notes` on the *first* row processed for a thread is mapped to the parent post, while `cultural_notes` for subsequent replies are mapped to those specific `artistComments`. 

### 2. UI State & Rendering (`app.js`)
- **State Management**: A global `STATE` object tracks current toggles (`showTranslations`, `showCulturalNotes`), the active board filter (`currentBoard`), and whether the user is viewing the feed or a specific thread (`currentThread`).
- **Dynamic Rendering**: `renderFeed()` and `renderThreadDetail()` dynamically inject HTML into the DOM. Modifying UI templates means editing the string literals in these functions.
- **Toggle Features**: Translations and Cultural Notes are injected conditionally based on `STATE`. Rather than replacing Korean text, English translations are rendered *inline* in a styled callout box directly below the original text.

### 3. Sync Workflow
- On `DOMContentLoaded`, `initApp()` attempts to load the SQLite buffer from `IndexedDB`.
- If successful, it boots `sql.js` entirely offline. 
- If no database is found, the app shows an "Empty State" UI asking the user to sync.
- `syncDatabase()` fetches the ArrayBuffer from GCS, saves it to `IndexedDB`, and reloads the UI. 
- *Note on Images*: Images are *not* explicitly cached into IndexedDB. They rely on the browser's native HTTP disk cache via standard `<img>` tags pointing directly to GCS.

## Configuration

The application uses a configuration object at the top of `app.js`.

```javascript
const CONFIG = {
    GCS_BUCKET_URL: 'https://storage.googleapis.com/berrizreader-app-data',
    DB_FILENAME: 'berriz_v2.db'
};
```

## Running Locally

Because this is a static site, you only need a basic HTTP server to run it.

```bash
npx http-server .
# or
python3 -m http.server
```

Open `http://localhost:8080` (or `8000` for python) in your browser.

**CORS Note**: The GCS bucket must have a CORS policy allowing `GET` requests from `localhost` and your production origin. If the manual sync fails with a "Network error", it is almost always a CORS issue on the GCS bucket.
