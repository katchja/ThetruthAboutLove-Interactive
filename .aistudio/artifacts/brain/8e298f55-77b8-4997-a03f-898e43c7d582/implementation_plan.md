# Implementation Plan: Public Archive Synchronization for Photos & Citations

## Why Photos & Citations Were Missing on the Public Link
Your uploaded photos and the citations added under **Bibliographic & Citation Index (Literature, References and Quotations)** are currently stored in your browser's local database (`IndexedDB`) under the Studio preview domain (`ais-dev-...`). They were not appearing on the public shared link (`ais-pre-...`) due to two bottlenecks:
1. **Proxy Header Rejection on Sync**: Behind the Cloud Run proxy, the server's `isStudioAdminRequest` check relied on `Host`/`Origin` headers that are often stripped or rewritten internally, causing `/api/archive/sync` requests from your Studio session to be ignored.
2. **Public Container & Static Asset Persistence**: The public app needs the synced archive written to both the server runtime store (`archive-store.json`) and the static public bundle (`public/archive-store.json`), with a high payload limit (`100MB`) so base64-encoded cover photos and archival images are never dropped.

---

## Key Changes

### 1. Reliable Studio-to-Public Server Persistence (`server.ts`)
- Increase the Express JSON payload limit to `100mb` so full-resolution uploaded photos and manuscript illustrations sync without truncation.
- Update Studio authorization detection to recognize an explicit `X-Studio-Author-Mode: true` header sent from the Studio environment (`ais-dev-...`) alongside origin/referer checks.
- Persist every sync operation atomically to both `/archive-store.json` and `/public/archive-store.json`, and expose a `/api/archive/status` check returning the exact count of published chapters, photos, and bibliographic citations.

### 2. Full Local-to-Public Archive Hydration (`src/App.tsx` & `src/utils/vectorStore.ts`)
- On load in Studio (`isAuthorMode`), gather all sources (including custom `imageUrl` photos on default cards and all entries in the **Literature, References and Quotations** section) from local `IndexedDB` and immediately push the complete snapshot to `/api/archive/sync`.
- On the public link (`!isAuthorMode`), fetch `/api/archive` (with fallback to `/archive-store.json`) so public visitors immediately see all custom photos, updated chapters, and every entry in the **Bibliographic & Citation Index** while keeping all edit/delete controls hidden.

### 3. Auto-Sync + "Publish to Public" Button (`src/App.tsx` & `src/components/SourcesView.tsx`)
- **Automatic Sync**: Automatically push any photo upload, new citation, edit, or deletion made in Studio to the shared server archive.
- **"Publish to Public" Button & Status Badge**: Add an explicit **Publish to Public** button in the Studio navigation bar and inside the **Source Archive** header showing live sync status (`Synced · X Photos · Y Citations`) so you can trigger and verify public updates with one click.
