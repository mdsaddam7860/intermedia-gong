## Intermedia → Gong Call Recording Sync

### A Node.js utility to sync call recordings from Intermedia to Gong, including user mapping, call creation, media upload, and cleanup — designed for reliability, clarity, and extensibility.

✨ What This Does

- This script automates the full lifecycle of syncing Intermedia call recordings into Gong:

- Reads Intermedia users from a local JSON file

- Maps Intermedia users to Gong users

- Fetches call recordings per user

- Creates corresponding calls in Gong

- Downloads Intermedia call recordings

- Uploads recordings to Gong

- Cleans up temporary files

- Logs every step for traceability

## 📁 Project Structure (Relevant)

```text
intermedia-gong-integration/
├── logs/
│   └── development.log
├── src/
│   ├── config/                     # App & client configuration
│   │   ├── gong.axios.config.js
│   │   └── index.js
│   ├── controllers/                # Orchestrators (flows, not logic)
│   │   └── sync.controller.js
│   ├── services/                   # Business logic & external APIs
│   │   ├── gong/
│   │   │   ├── gong.service.js
│   │   │   └── gong.media.service.js
│   │   ├── intermedia/
│   │   │   └── intermedia.service.js
│   │   └── auth/
│   │       └── token.manager.js
│   ├── mappers/                    # Data transformation layer
│   │   └── intermediaToGong.mapper.js
│   ├── utils/                      # Pure helpers (no side effects)
│   │   ├── logger.js
│   │   ├── file.utils.js
│   │   └── userMap.utils.js
│   ├── jobs/                       # Runnable jobs / scripts
│   │   └── syncIntermediaToGong.job.js
│   ├── constants/
│   │   └── paths.js
│   ├── app.js                      # App bootstrap
│   └── index.js                    # Public exports
├── data/                           # Static / runtime data
│   ├── intermedia-users.json
│   └── gong-token.json
├── temp/                           # Auto-cleaned runtime files
│   └── intermedia-recordings/
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```



--- 

### 🔄 Sync Flow (High Level)
    Intermedia User
            ↓   
    Fetch Call Recordings
            ↓
    Map Call → Gong Payload
            ↓
    Create Gong Call
            ↓
    Download Recording
            ↓
    Upload Media to Gong
            ↓
    Cleanup Local File

### 🚀 Usage
    1. Prerequisites

    Node.js 18+

    Intermedia API access

    Gong API access

    Proper environment variables configured (API keys, base URLs, etc.)

    2. Prepare User Mapping

    Ensure intermedia-users.json exists at the project root:

    {
    "results": [
        {
        "id": "12345",
        "displayName": "John Doe"
        }
    ]
    }


    displayName is used to map Intermedia users to Gong users.

    3. Run the Sync
    import { syncIntermediaToGong } from "./scripts/syncIntermediaToGong.js";

    await syncIntermediaToGong();

### 🧠 Core Logic Overview
- User Mapping
const gongId = buildUserIdMap(user.displayName);


- Maps Intermedia users to Gong users

- Skips users with no matching Gong ID

- Recording Fetch
const recordings = await fetchIntermediaCallRecordings(user.id);


- Fetches all available call recordings for the user

- Gracefully skips users with no recordings

- Gong Call Creation
const payload = mapIntermediaCallToGongPayload(recording, user, gongId);
const gongRecording = await createGongCall(payload);


- Transforms Intermedia data into Gong-compatible payloads

- Creates a call before uploading media

- Media Upload
await uploadMediaToGong(gongRecording.callId, filePath);


- Uploads the downloaded recording file to Gong

- Only executes if call creation succeeds

- Cleanup
cleanupRecordingFile(filePath);


- Ensures temporary files are removed

- Runs in both success and failure paths


## 📝 Logging & Observability

Uses a centralized logger

Logs:

    - User processing

    - Recording counts

    - Payloads

    - API responses

Errors (with context)

- This makes debugging and auditing straightforward.

⚠️ Notes & TODOs

- Pagination handling is currently disabled for testing

- return; // TODO Remove After Testing pagination


### Duration filtering (< 60s) is available but commented out

- Safe cleanup runs in both catch and finally

- 🛠️ Tech Stack

- Node.js (ESM)

- Native fs & path

- Intermedia API

## Gong API

### ✅ Design Principles

- Fail-safe execution (per user & per recording)

- No orphaned temp files

- Explicit logging over silent failures

- Clear separation of concerns via exported utilities

### 📌 Future Improvements

- Enable pagination handling

- Parallelize uploads with controlled concurrency

- Persist sync state (idempotency)

- Retry logic for transient failures

- Dry-run mode
---
### 👤 Author
### Md Saddam