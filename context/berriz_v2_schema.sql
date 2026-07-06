CREATE TABLE artist_activity (
                contentId TEXT PRIMARY KEY,
                postId TEXT NOT NULL,
                artistCommentBody TEXT,
                commentCreatedAt TEXT,
                boardName TEXT,
                isReply INTEGER,
                parentCommentId INTEGER,
                parentCommentAuthor TEXT,
                parentCommentBody TEXT,
                details_fetched INTEGER DEFAULT 0,
                mediaCount INTEGER DEFAULT NULL
            );
CREATE INDEX idx_activity_postid ON artist_activity(postId);
CREATE TABLE posts (
                    postId TEXT PRIMARY KEY, originalPostBody TEXT, postWriterUserId INTEGER,
                    postWriterName TEXT, postCreatedAt TEXT, readContentId TEXT,
                    isDeleted INTEGER DEFAULT 0, mediaCount INTEGER DEFAULT NULL);
CREATE TABLE users_comments (
                    commentId INTEGER PRIMARY KEY, parentPostId TEXT, commentBody TEXT,
                    commentWriterId INTEGER, commentWriterName TEXT, commentCreatedAt TEXT,
                    mediaCount INTEGER DEFAULT NULL
                );
CREATE TABLE combined_view (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Post info
    postId TEXT NOT NULL,
    postBody TEXT,
    postWriterName TEXT,
    postCreatedAt TEXT,
    boardName TEXT,
    isDeleted INTEGER DEFAULT 0,
    
    -- Artist comment info
    artistContentId TEXT,
    artistCommentBody TEXT,
    artistCommentCreatedAt TEXT,
    isReply INTEGER DEFAULT 0,
    
    -- Parent user comment (when artist is replying to a user)
    parentCommentId INTEGER,
    parentCommentBody TEXT,
    parentCommentAuthor TEXT,
    parentCommentCreatedAt TEXT,
    
    -- Translation columns (Korean -> English)
    postBody_en TEXT,
    artistCommentBody_en TEXT,
    parentCommentBody_en TEXT,
    
    -- Metadata
    readContentId TEXT,
    postMediaCount INTEGER DEFAULT NULL,
    artistCommentMediaCount INTEGER DEFAULT NULL,
    parentCommentMediaCount INTEGER DEFAULT NULL,
    cultural_notes TEXT);
CREATE TABLE sqlite_sequence(name,seq);
CREATE INDEX idx_cv_postId ON combined_view(postId);
CREATE INDEX idx_cv_boardName ON combined_view(boardName);
CREATE INDEX idx_cv_artistCommentCreatedAt ON combined_view(artistCommentCreatedAt);
CREATE INDEX idx_cv_postCreatedAt ON combined_view(postCreatedAt);

CREATE TABLE media_files (
    mediaId TEXT PRIMARY KEY,
    contentId TEXT NOT NULL,
    contentType TEXT NOT NULL,
    imageUrl TEXT NOT NULL,
    localFilePath TEXT,
    width INTEGER,
    height INTEGER,
    publishedAt INTEGER
);
CREATE INDEX idx_media_contentId ON media_files(contentId);
