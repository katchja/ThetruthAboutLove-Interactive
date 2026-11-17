# Security Specification — The Truth About Love Cloud Archive

## 1. Data Invariants & Master Source of Truth

1. **Master Identity Invariant (`Verified Studio Author`)**:
   - Every write (`create`, `update`, `delete`) across `archive_sources`, `private_content`, `archive_assets`, `archive_tombstones`, and `archive_config` requires an authenticated Google session (`request.auth != null`) where `request.auth.token.email_verified == true` and `request.auth.token.email == 'butnaru.catalina@gmail.com'`.
   - Every created document must bind `authorUid == request.auth.uid`, and `authorUid`, `createdAt`, and primary ID fields (`id`, `sourceId`, `assetId`, `targetId`, `configId`) are strictly immutable after creation.

2. **Relational Master Gate (`private_content` -> `archive_sources`)**:
   - A `private_content/{contentId}` document under `/archive_sources/{sourceId}/private_content/{contentId}` cannot exist without a valid parent `/archive_sources/{sourceId}` document owned by the same verified author (`exists` or atomic batch `existsAfter`).
   - Full raw protected manuscript chapters in `private_content` are strictly denied to unauthenticated readers and non-author Google accounts (`allow get, list: if isVerifiedAuthor()`).

3. **No Blanket Public Reads & Query Enforcement**:
   - Public `get` and `list` operations on `archive_sources`, `archive_assets`, `archive_tombstones`, and `archive_config` strictly evaluate `resource.data.isPublished == true` without performing O(n) `get()`/`exists()` calls inside `list` blocks.

4. **Volumetric & Anti-Poisoning Bounds**:
   - All path IDs match `^[a-zA-Z0-9_\-]+$` (`1..128` chars).
   - Every string and list field enforces explicit `.size()` bounds synchronized verbatim with `firebase-blueprint.json`, keeping `archive_assets` base64 payloads strictly `<= 850000` characters (under Firestore's 1 MiB ceiling).

5. **Temporal Integrity**:
   - `createdAt == request.time` and `updatedAt == request.time` are enforced on `create`; `createdAt == existing().createdAt` and `updatedAt == request.time` are enforced on `update`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 — Unauthenticated Chapter Overwrite**: Anonymous client attempts `update` on `/archive_sources/src-ch3` to swap `imageUrl`. -> `PERMISSION_DENIED`.
2. **Payload 2 — Unverified Email Spoof Attack**: Attacker presents token with `email: 'butnaru.catalina@gmail.com'` and `email_verified: false` attempting `create` on `/archive_sources/src-spoof`. -> `PERMISSION_DENIED`.
3. **Payload 3 — Non-Author Authenticated Write**: Signed-in Google user `attacker@gmail.com` (`email_verified: true`) attempts `delete` on `/archive_assets/asset-123`. -> `PERMISSION_DENIED`.
4. **Payload 4 — Protected Manuscript Scraping (`private_content`)**: Public reader attempts `get` on `/archive_sources/src-ch3/private_content/full`. -> `PERMISSION_DENIED`.
5. **Payload 5 — Unpublished Draft Enumeration (`list` Query Bypass)**: Public client runs unfiltered collection query on `/archive_sources` where an unpublished draft (`isPublished: false`) exists. -> `PERMISSION_DENIED`.
6. **Payload 6 — Shadow / Ghost Field Injection**: Verified author client sends an undeclared field `isAdminOverride: true` during `create` or `update` on `/archive_sources/src-ch3`. -> `PERMISSION_DENIED` via `hasOnly()`.
7. **Payload 7 — Identity Spoofing (`authorUid` Mismatch)**: Verified author attempts `create` on `/archive_sources/src-ch3` setting `authorUid: 'someone-else-uid'`. -> `PERMISSION_DENIED`.
8. **Payload 8 — Immortal Field Mutation (`createdAt` / `id` Tampering)**: Update payload attempts to mutate `createdAt` or `id` on `/archive_sources/src-ch3`. -> `PERMISSION_DENIED`.
9. **Payload 9 — Client-Forged Timestamp**: Create payload supplies a static integer or past timestamp for `updatedAt` instead of `request.time` (`serverTimestamp()`). -> `PERMISSION_DENIED`.
10. **Payload 10 — ID Poisoning / Path Traversal**: Create request targets `/archive_assets/../../bad$id!` or a 300-character junk ID. -> `PERMISSION_DENIED` via `isValidId()`.
11. **Payload 11 — Denial-of-Wallet Oversized Asset / Unbounded Tag Array**: Create payload injects 30 tags (`> 25`) or a `950,000`-char `dataBase64` string into `/archive_assets/asset-huge`. -> `PERMISSION_DENIED`.
12. **Payload 12 — Orphaned Subcollection Write**: Verified author attempts `create` on `/archive_sources/nonexistent-parent/private_content/full` without a parent source document. -> `PERMISSION_DENIED` via Master Gate `exists`/`existsAfter`.
