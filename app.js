/**
 * Berriz Reader - Main Application Logic
 */

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    GCS_BUCKET_URL: 'https://storage.googleapis.com/berrizreader-app-data',
    DB_FILENAME: 'berriz_v2.db',
    VERSION_FILENAME: 'version.json'
};

// ============================================================================
// STATE & DATA
// ============================================================================
const STATE = {
    showTranslations: false,
    showCulturalNotes: false,
    currentBoard: 'All', // 'All' means no filter
    boards: ['All'],
    threads: [], // Array of parsed thread objects
    currentThread: null, // If null, show feed. If Thread object, show detail.
    rawDb: null
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================
const DOM = {
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    emptyState: document.getElementById('empty-state'),
    errorMessage: document.getElementById('error-message'),
    feedContainer: document.getElementById('feed-container'),
    threadDetailContainer: document.getElementById('thread-detail-container'),
    tabsContainer: document.getElementById('board-tabs'),
    retryBtn: document.getElementById('retry-btn'),
    emptySyncBtn: document.getElementById('empty-sync-btn'),
    syncDbBtn: document.getElementById('sync-db-btn'),
    toggleTranslateBtn: document.getElementById('toggle-translate'),
    toggleCulturalBtn: document.getElementById('toggle-cultural')
};

// ============================================================================
// INDEXEDDB WRAPPER
// ============================================================================

const IDB_NAME = 'BerrizReaderDB';
const IDB_STORE = 'DatabaseStore';
const IDB_KEY = 'sqlite_db';

function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveToIndexedDB(arrayBuffer) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const request = store.put(arrayBuffer, IDB_KEY);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function loadFromIndexedDB() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const request = store.get(IDB_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ============================================================================
// INITIALIZATION & SYNC
// ============================================================================

async function initApp() {
    showLoading();
    setupEventListeners();

    try {
        const arrayBuffer = await loadFromIndexedDB();
        if (arrayBuffer) {
            await initializeDatabase(arrayBuffer);
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error("IndexedDB load error:", error);
        showEmptyState();
    }
}

async function initializeDatabase(arrayBuffer) {
    try {
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });

        const db = new SQL.Database(new Uint8Array(arrayBuffer));
        STATE.rawDb = db;
        
        console.log("SQLite database initialized successfully in memory.");

        // Process data
        processDatabase(db);
        
        // Setup UI
        renderTabs();
        renderFeed();
    } catch (error) {
        console.error("Application Error:", error);
        showError("Failed to parse local database. Please sync again.");
    }
}

async function syncDatabase() {
    showLoading();
    try {
        const dbUrl = `${CONFIG.GCS_BUCKET_URL}/${CONFIG.DB_FILENAME}`;
        console.log(`Fetching database from: ${dbUrl}`);
        
        const response = await fetch(dbUrl);
        if (!response.ok) {
            throw new Error(`Failed to download database. Status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Save to IndexedDB
        await saveToIndexedDB(arrayBuffer);
        
        // Initialize
        await initializeDatabase(arrayBuffer);
        
    } catch (error) {
        console.error("Sync Error:", error);
        const isLikelyCors = error.message.includes('fetch') || error.name === 'TypeError';
        const msg = isLikelyCors 
            ? "Network error. Please check if the GCS_BUCKET_URL is correct and CORS is configured on your bucket." 
            : error.message || "An unexpected error occurred while syncing data.";
            
        showError(msg);
    }
}

// ============================================================================
// DATABASE PROCESSING
// ============================================================================

function processDatabase(db) {
    // 1. Fetch raw rows from combined_view
    const query = `
        SELECT 
            cv.*,
            (SELECT GROUP_CONCAT(localFilePath) FROM media_files WHERE contentId = cv.postId) as postMediaPaths,
            (SELECT GROUP_CONCAT(localFilePath) FROM media_files WHERE contentId = cv.artistContentId) as artistMediaPaths
        FROM combined_view cv
        ORDER BY postCreatedAt DESC, artistCommentCreatedAt ASC;
    `;
    
    const resultSets = db.exec(query);
    if (resultSets.length === 0) return;
    
    const columns = resultSets[0].columns;
    const values = resultSets[0].values;
    
    const rows = values.map(rowArray => {
        const rowObj = {};
        columns.forEach((colName, index) => {
            rowObj[colName] = rowArray[index];
        });
        return rowObj;
    });

    // 2. Group by postId into Threads
    const threadsMap = new Map();
    const boardSet = new Set();
    
    rows.forEach(row => {
        if (row.boardName) boardSet.add(row.boardName);

        if (!threadsMap.has(row.postId)) {
            threadsMap.set(row.postId, {
                postId: row.postId,
                boardName: row.boardName,
                postBody: row.postBody,
                postBody_en: row.postBody_en,
                postWriterName: row.postWriterName,
                postCreatedAt: row.postCreatedAt,
                isDeleted: row.isDeleted,
                cultural_notes: row.postCulturalNotes || row.post_cultural_notes || row.cultural_notes,
                postMediaPaths: row.postMediaPaths ? row.postMediaPaths.split(',').map(s=>s.trim()).filter(Boolean) : [],
                artistComments: []
            });
        }
        
        const thread = threadsMap.get(row.postId);
        
        // If there's an artist comment in this row, add it
        if (row.artistContentId) {
            if (!thread.artistComments.find(c => c.artistContentId === row.artistContentId)) {
                thread.artistComments.push({
                    artistContentId: row.artistContentId,
                    artistCommentBody: row.artistCommentBody,
                    artistCommentBody_en: row.artistCommentBody_en,
                    artistCommentCreatedAt: row.artistCommentCreatedAt,
                    isReply: row.isReply,
                    parentCommentId: row.parentCommentId,
                    parentCommentBody: row.parentCommentBody,
                    parentCommentBody_en: row.parentCommentBody_en,
                    parentCommentAuthor: row.parentCommentAuthor,
                    artistMediaPaths: row.artistMediaPaths ? row.artistMediaPaths.split(',').map(s=>s.trim()).filter(Boolean) : [],
                    cultural_notes: row.cultural_notes 
                });
            }
        }
    });

    STATE.threads = Array.from(threadsMap.values());
    
    const customOrder = ['From. IU', 'From.IU', 'Dear. IU', 'Dear.IU', 'Free'];
    const sortedBoards = Array.from(boardSet).sort((a, b) => {
        const indexA = customOrder.indexOf(a);
        const indexB = customOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });
    
    STATE.boards = ['All', ...sortedBoards];
}

// ============================================================================
// UI RENDERING - TABS & NAVIGATION
// ============================================================================

function setupEventListeners() {
    // Check if listeners are already attached to avoid duplicates on fast re-init
    if (DOM.toggleTranslateBtn.hasAttribute('data-listeners')) return;
    DOM.toggleTranslateBtn.setAttribute('data-listeners', 'true');

    DOM.toggleTranslateBtn.addEventListener('click', () => {
        STATE.showTranslations = !STATE.showTranslations;
        DOM.toggleTranslateBtn.classList.toggle('active', STATE.showTranslations);
        reRenderCurrentView();
    });

    DOM.toggleCulturalBtn.addEventListener('click', () => {
        STATE.showCulturalNotes = !STATE.showCulturalNotes;
        DOM.toggleCulturalBtn.classList.toggle('active', STATE.showCulturalNotes);
        reRenderCurrentView();
    });

    DOM.retryBtn.addEventListener('click', syncDatabase);
    DOM.emptySyncBtn.addEventListener('click', syncDatabase);
    DOM.syncDbBtn.addEventListener('click', syncDatabase);
}

function renderTabs() {
    DOM.tabsContainer.innerHTML = '';
    DOM.tabsContainer.classList.remove('hidden');

    STATE.boards.forEach(board => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${STATE.currentBoard === board ? 'active' : ''}`;
        btn.textContent = board;
        btn.addEventListener('click', () => {
            STATE.currentBoard = board;
            // update active class
            DOM.tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderFeed();
        });
        DOM.tabsContainer.appendChild(btn);
    });
}

function reRenderCurrentView() {
    if (STATE.currentThread) {
        renderThreadDetail(STATE.currentThread);
    } else {
        renderFeed();
    }
}

function showFeedView() {
    STATE.currentThread = null;
    DOM.loadingState.classList.add('hidden');
    DOM.errorState.classList.add('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.threadDetailContainer.classList.add('hidden');
    DOM.feedContainer.classList.remove('hidden');
    DOM.tabsContainer.classList.remove('hidden');
    window.scrollTo(0,0);
}

function showDetailView() {
    DOM.loadingState.classList.add('hidden');
    DOM.errorState.classList.add('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.feedContainer.classList.add('hidden');
    DOM.tabsContainer.classList.add('hidden');
    DOM.threadDetailContainer.classList.remove('hidden');
    window.scrollTo(0,0);
}

// ============================================================================
// UI RENDERING - FEED VIEW
// ============================================================================

function renderFeed() {
    showFeedView();
    DOM.feedContainer.innerHTML = '';
    
    let filteredThreads = STATE.threads;
    if (STATE.currentBoard !== 'All') {
        filteredThreads = filteredThreads.filter(t => t.boardName === STATE.currentBoard);
    }

    if (filteredThreads.length === 0) {
        DOM.feedContainer.innerHTML = `
            <div style="text-align: center; color: var(--text-secondary); padding: 40px;">
                <p>No posts found in this board.</p>
            </div>
        `;
        return;
    }
    
    // Sort by latest post date
    filteredThreads.sort((a,b) => new Date(b.postCreatedAt) - new Date(a.postCreatedAt));

    filteredThreads.forEach((thread, index) => {
        const card = createThreadCard(thread);
        card.style.animationDelay = `${(index % 10) * 0.05}s`;
        DOM.feedContainer.appendChild(card);
    });
}

function createThreadCard(thread) {
    const card = document.createElement('div');
    card.className = 'post-card thread-card';
    card.addEventListener('click', () => {
        STATE.currentThread = thread;
        renderThreadDetail(thread);
    });
    
    const writerName = thread.postWriterName || 'Anonymous';
    const initial = writerName.charAt(0).toUpperCase();
    const dateStr = formatDate(thread.postCreatedAt);
    
    // Header
    let html = `
        <div class="post-header">
            <div class="avatar">${initial}</div>
            <div class="post-meta">
                <span class="writer-name">${escapeHTML(writerName)} <span style="font-size:0.8em; color:var(--text-secondary); font-weight:normal;">in ${escapeHTML(thread.boardName)}</span></span>
                ${dateStr ? `<span class="post-date">${escapeHTML(dateStr)}</span>` : ''}
            </div>
        </div>
        <div class="post-content">
    `;
    
    // Body preview
    const bodyText = thread.postBody || (thread.isDeleted ? '[Deleted]' : '');
    const bodyEnText = thread.postBody_en || '';
    
    html += `<div class="post-text">${formatText(truncateText(bodyText, 150))}</div>`;
    
    if (STATE.showTranslations && bodyEnText) {
        html += `
            <div class="translation-notes">
                <span class="translation-notes-label">Translation</span>
                ${formatText(truncateText(bodyEnText, 150))}
            </div>
        `;
    }
    
    if (STATE.showCulturalNotes && thread.cultural_notes) {
        html += `
            <div class="cultural-notes">
                <span class="cultural-notes-label">Cultural Context</span>
                ${formatText(truncateText(thread.cultural_notes, 150))}
            </div>
        `;
    }
    
    html += `</div>`; // Close content
    
    // Post Media
    if (thread.postMediaPaths.length > 0) {
        html += `<div class="media-gallery">`;
        thread.postMediaPaths.forEach(path => {
            const mediaUrl = `${CONFIG.GCS_BUCKET_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
            html += `<img class="media-item" src="${mediaUrl}" alt="Attachment" loading="lazy">`;
        });
        html += `</div>`;
    }
    
    // Footer / Responses count
    if (thread.artistComments.length > 0) {
        html += `
            <div class="thread-responses-count">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                ${thread.artistComments.length} Artist Response${thread.artistComments.length !== 1 ? 's' : ''}
            </div>
        `;
    }
    
    card.innerHTML = html;
    return card;
}

// ============================================================================
// UI RENDERING - THREAD DETAIL
// ============================================================================

function renderThreadDetail(thread) {
    showDetailView();
    DOM.threadDetailContainer.innerHTML = '';
    
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"></path></svg> Back to Feed`;
    backBtn.addEventListener('click', showFeedView);
    DOM.threadDetailContainer.appendChild(backBtn);

    // Parent Post
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    
    const writerName = thread.postWriterName || 'Anonymous';
    const initial = writerName.charAt(0).toUpperCase();
    
    let html = `
        <div class="post-header">
            <div class="avatar">${initial}</div>
            <div class="post-meta">
                <span class="writer-name">${escapeHTML(writerName)} <span style="font-size:0.8em; color:var(--text-secondary); font-weight:normal;">in ${escapeHTML(thread.boardName)}</span></span>
                <span class="post-date">${escapeHTML(formatDate(thread.postCreatedAt))}</span>
            </div>
        </div>
        <div class="post-content">
    `;

    if (thread.isDeleted) {
        html += `<div style="font-style:italic; color:var(--text-secondary)">[This post has been deleted]</div>`;
    } else {
        html += `<div class="post-text">${formatText(thread.postBody)}</div>`;
        if (STATE.showTranslations && thread.postBody_en) {
            html += `
                <div class="translation-notes">
                    <span class="translation-notes-label">Translation</span>
                    ${formatText(thread.postBody_en)}
                </div>
            `;
        }
        if (STATE.showCulturalNotes && thread.cultural_notes) {
            html += `
                <div class="cultural-notes">
                    <span class="cultural-notes-label">Cultural Context</span>
                    ${formatText(thread.cultural_notes)}
                </div>
            `;
        }
    }
    html += `</div>`; // Close content
    
    // Post Media
    if (thread.postMediaPaths.length > 0) {
        html += `<div class="media-gallery">`;
        thread.postMediaPaths.forEach(path => {
            const mediaUrl = `${CONFIG.GCS_BUCKET_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
            html += `<img class="media-item" src="${mediaUrl}" alt="Attachment" loading="lazy">`;
        });
        html += `</div>`;
    }
    
    postCard.innerHTML = html;
    DOM.threadDetailContainer.appendChild(postCard);
    
    // Responses
    if (thread.artistComments.length > 0) {
        const header = document.createElement('div');
        header.className = 'responses-header';
        header.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg> Artist Responses`;
        DOM.threadDetailContainer.appendChild(header);
        
        thread.artistComments.sort((a,b) => new Date(a.artistCommentCreatedAt) - new Date(b.artistCommentCreatedAt));
        
        thread.artistComments.forEach(comment => {
            const commentDiv = document.createElement('div');
            commentDiv.className = 'artist-comment';
            
            let cHtml = '';
            
            // Parent context if reply
            if (comment.isReply && comment.parentCommentBody) {
                cHtml += `
                    <div class="parent-comment">
                        <div class="parent-comment-author">Replying to ${escapeHTML(comment.parentCommentAuthor)}:</div>
                `;
                cHtml += `<div class="parent-comment-body">${formatText(comment.parentCommentBody)}</div>`;
                if (STATE.showTranslations && comment.parentCommentBody_en) {
                    cHtml += `
                        <div class="translation-notes">
                            <span class="translation-notes-label">Translation</span>
                            ${formatText(comment.parentCommentBody_en)}
                        </div>
                    `;
                }
                cHtml += `</div>`;
            }
            
            cHtml += `<div class="artist-comment-label">IU · ${escapeHTML(formatDate(comment.artistCommentCreatedAt))}</div>`;
            
            cHtml += `<div class="post-text">${formatText(comment.artistCommentBody)}</div>`;
            
            if (STATE.showTranslations && comment.artistCommentBody_en) {
                cHtml += `
                    <div class="translation-notes">
                        <span class="translation-notes-label">Translation</span>
                        ${formatText(comment.artistCommentBody_en)}
                    </div>
                `;
            }
            
            // Cultural Note
            if (STATE.showCulturalNotes && comment.cultural_notes) {
                cHtml += `
                    <div class="cultural-notes">
                        <span class="cultural-notes-label">Cultural Context</span>
                        ${formatText(comment.cultural_notes)}
                    </div>
                `;
            }
            
            // Comment Media
            if (comment.artistMediaPaths.length > 0) {
                cHtml += `<div class="media-gallery artist-media-gallery">`;
                comment.artistMediaPaths.forEach(path => {
                    const mediaUrl = `${CONFIG.GCS_BUCKET_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
                    cHtml += `<img class="media-item" src="${mediaUrl}" alt="Attachment" loading="lazy">`;
                });
                cHtml += `</div>`;
            }
            
            commentDiv.innerHTML = cHtml;
            DOM.threadDetailContainer.appendChild(commentDiv);
        });
    }
}

// ============================================================================
// UTILITIES
// ============================================================================

function formatDate(dateInput) {
    if (!dateInput) return '';
    try {
        const date = new Date(dateInput);
        if (isNaN(date)) return String(dateInput);
        return date.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        return String(dateInput);
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatText(str) {
    return escapeHTML(str).replace(/\n/g, '<br>');
}

function truncateText(str, maxLength) {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
}

function showLoading() {
    DOM.loadingState.classList.remove('hidden');
    DOM.errorState.classList.add('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.feedContainer.classList.add('hidden');
    DOM.threadDetailContainer.classList.add('hidden');
    DOM.tabsContainer.classList.add('hidden');
}

function showEmptyState() {
    DOM.loadingState.classList.add('hidden');
    DOM.errorState.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
    DOM.feedContainer.classList.add('hidden');
    DOM.threadDetailContainer.classList.add('hidden');
    DOM.tabsContainer.classList.add('hidden');
}

function showError(msg) {
    DOM.loadingState.classList.add('hidden');
    DOM.errorState.classList.remove('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.feedContainer.classList.add('hidden');
    DOM.threadDetailContainer.classList.add('hidden');
    DOM.tabsContainer.classList.add('hidden');
    DOM.errorMessage.textContent = msg;
}

// ============================================================================
// BOOTSTRAP
// ============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
