# BerrizReader Web App

BerrizReader is a mobile app for reading messages from a local database of conversations. This project implements a web-based version of the application using HTML, CSS, and JavaScript, with Google Cloud Storage (GCS) for database distribution.

## Features

- **Cloud-Based Database**: Automatically downloads and caches the SQLite database from a Google Cloud Storage bucket.
- **Dynamic UI**: No hardcoded data. The user interface is generated dynamically from the database schema.
- **Data Synchronization**:
  - Checks for `version.json` to determine if the database needs to be updated.
  - Downloads the latest database file if available.
- **Interactive Features**:
  - **Tabs**: Automatically creates tabs for each board found in the database.
  - **Feed View**: Displays posts and replies in a chronological feed.
  - **Thread View**: Detailed view of a specific thread with all posts and replies.
  - **Translation Toggle**: Button to show/hide English translations of posts (if available in the database).
  - **Cultural Notes Toggle**: Button to show/hide cultural notes (if available in the database).
- **Error Handling**: Graceful handling of network errors and database issues with user-friendly messages.
- **Loading States**: Visual feedback while loading the database and rendering content.
- **Responsive Design**: Basic styling for readability on different screen sizes.

## Prerequisites

Before you begin, ensure you have the following set up:

1.  **Google Cloud Storage Bucket**: The bucket must be publicly accessible (or have appropriate CORS configuration) to allow the web app to download the database file.
2.  **Database File**: A SQLite database file (default: `berriz_v2.db`) must be uploaded to the bucket.
3.  **Version File**: A `version.json` file in the same bucket is recommended to manage database versions.

## Configuration

The application uses a configuration object in `app.js`. You can customize the GCS bucket URL and database filename there.

```javascript
const CONFIG = {
    GCS_BUCKET_URL: 'https://storage.googleapis.com/berrizreader-app-data',
    DB_FILENAME: 'berriz_v2.db',
    VERSION_FILENAME: 'version.json'
};
```

## Files

-   **`index.html`**: The main HTML entry point.
-   **`styles.css`**: Styles for the application.
-   **`app.js`**: The core logic for data fetching, database processing, and UI rendering.
-   **`README.md`**: This file.

## Development

### Running Locally

Since this is a client-side application that accesses resources from a cloud bucket, you can run it locally using:

```bash
npm install -g http-server
http-server .
```

Then open `http://localhost:8080` (or the port shown) in your browser.

**Note**: If you encounter CORS issues, ensure your GCS bucket has the correct CORS configuration.

## License

MIT
