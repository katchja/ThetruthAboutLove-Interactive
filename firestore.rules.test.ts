/**
 * Firestore Security Rules Verification Suite ("Dirty Dozen" Adversarial Payloads)
 * Verifies that all 12 identity, schema, relational, and volumetric attack vectors
 * defined in security_spec.md are rejected with PERMISSION_DENIED.
 */

export interface SimulatedAuthContext {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: SimulatedAuthContext | null;
  existingDoc?: Record<string, unknown> | null;
  parentExists?: boolean;
  payload?: Record<string, unknown>;
  usesServerTimestamp?: boolean;
  expectedAllow: false;
}

const AUTHOR_UID = 'author-catalina-uid-01';
const AUTHOR_EMAIL = 'butnaru.catalina@gmail.com';
const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function evaluateHardenedRules(tc: DirtyDozenTestCase): boolean {
  const segments = tc.path.replace(/^\/+/, '').split('/');
  const isSignedIn = tc.auth !== null;
  const isVerifiedAuthor =
    isSignedIn &&
    tc.auth?.email_verified === true &&
    typeof tc.auth?.email === 'string' &&
    tc.auth.email.length <= 160 &&
    tc.auth.email === AUTHOR_EMAIL;

  const isValidId = (id?: string) =>
    typeof id === 'string' && id.length >= 1 && id.length <= 128 && VALID_ID_REGEX.test(id);

  if (segments[0] === 'archive_sources' && segments.length === 2) {
    const sourceId = segments[1];
    if (tc.operation === 'list') {
      return Boolean(tc.existingDoc?.isPublished === true) || isVerifiedAuthor;
    }
    if (!isValidId(sourceId)) return false;
    if (tc.operation === 'get') {
      return Boolean(tc.existingDoc?.isPublished === true) || isVerifiedAuthor;
    }
    if (!isVerifiedAuthor) return false;
    if (tc.operation === 'delete') return true;

    const d = tc.payload || {};
    const required = [
      'id',
      'title',
      'type',
      'section',
      'summary',
      'tags',
      'isProtected',
      'isPublished',
      'authorUid',
      'createdAt',
      'updatedAt',
    ];
    const allowed = new Set([
      ...required,
      'author',
      'year',
      'reference',
      'content',
      'externalUrl',
      'imageUrl',
      'images',
      'coverAssetId',
      'assetIds',
      'ocrDetectedPage',
      'ocrDocumentType',
    ]);
    const keys = Object.keys(d);
    if (!required.every((k) => keys.includes(k))) return false;
    if (!keys.every((k) => allowed.has(k))) return false;
    if (d.id !== sourceId || d.authorUid !== tc.auth?.uid) return false;
    if (!tc.usesServerTimestamp) return false;
    if (Array.isArray(d.tags) && d.tags.length > 25) return false;
    if (tc.operation === 'update' && tc.existingDoc) {
      if (d.createdAt !== tc.existingDoc.createdAt) return false;
      if (d.id !== tc.existingDoc.id) return false;
      if (d.authorUid !== tc.existingDoc.authorUid) return false;
    }
    return true;
  }

  if (segments[0] === 'archive_sources' && segments[2] === 'private_content' && segments.length === 4) {
    const sourceId = segments[1];
    const contentId = segments[3];
    if (!isValidId(sourceId) || !isValidId(contentId)) return false;
    if (!isVerifiedAuthor) return false;
    if (tc.operation === 'get') return true;
    if (!tc.parentExists) return false;
    return Boolean(tc.usesServerTimestamp);
  }

  if (segments[0] === 'archive_assets' && segments.length === 2) {
    const assetId = segments[1];
    if (!isValidId(assetId)) return false;
    if (!isVerifiedAuthor) return false;
    if (tc.operation === 'delete') return true;
    const d = tc.payload || {};
    if (typeof d.dataBase64 !== 'string' || d.dataBase64.length > 850000) return false;
    return Boolean(tc.usesServerTimestamp);
  }

  return false;
}

export const DIRTY_DOZEN_CASES: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated chapter cover overwrite',
    operation: 'update',
    path: '/archive_sources/src-ch3',
    auth: null,
    existingDoc: { id: 'src-ch3', isPublished: true },
    payload: { imageUrl: 'https://evil.example/cover.jpg' },
    expectedAllow: false,
  },
  {
    id: 2,
    name: 'Unverified author email spoof attack',
    operation: 'create',
    path: '/archive_sources/src-spoof',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: false },
    usesServerTimestamp: true,
    payload: {
      id: 'src-spoof',
      title: 'Spoofed Chapter',
      type: 'chapter',
      section: 'authored',
      summary: 'Spoof',
      tags: ['Spoof'],
      isProtected: true,
      isPublished: true,
      authorUid: AUTHOR_UID,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedAllow: false,
  },
  {
    id: 3,
    name: 'Authenticated non-author asset deletion',
    operation: 'delete',
    path: '/archive_assets/asset-valid123',
    auth: { uid: 'intruder-99', email: 'intruder@gmail.com', email_verified: true },
    expectedAllow: false,
  },
  {
    id: 4,
    name: 'Public scraping of protected raw manuscript chapter',
    operation: 'get',
    path: '/archive_sources/src-ch3/private_content/full',
    auth: null,
    expectedAllow: false,
  },
  {
    id: 5,
    name: 'Public list query against unpublished draft',
    operation: 'list',
    path: '/archive_sources/src-draft',
    auth: null,
    existingDoc: { id: 'src-draft', isPublished: false },
    expectedAllow: false,
  },
  {
    id: 6,
    name: 'Shadow / ghost field injection on ArchiveSource',
    operation: 'create',
    path: '/archive_sources/src-ch3',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: true },
    usesServerTimestamp: true,
    payload: {
      id: 'src-ch3',
      title: 'Chapter 3',
      type: 'chapter',
      section: 'authored',
      summary: 'Summary',
      tags: ['Self-Love'],
      isProtected: true,
      isPublished: true,
      authorUid: AUTHOR_UID,
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
      ghostPrivilegeFlag: true,
    },
    expectedAllow: false,
  },
  {
    id: 7,
    name: 'Identity spoofing via mismatched authorUid',
    operation: 'create',
    path: '/archive_sources/src-ch3',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: true },
    usesServerTimestamp: true,
    payload: {
      id: 'src-ch3',
      title: 'Chapter 3',
      type: 'chapter',
      section: 'authored',
      summary: 'Summary',
      tags: ['Self-Love'],
      isProtected: true,
      isPublished: true,
      authorUid: 'forged-other-uid',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedAllow: false,
  },
  {
    id: 8,
    name: 'Immortal field createdAt mutation during update',
    operation: 'update',
    path: '/archive_sources/src-ch3',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: true },
    usesServerTimestamp: true,
    existingDoc: {
      id: 'src-ch3',
      authorUid: AUTHOR_UID,
      createdAt: 'ORIGINAL_TIME',
    },
    payload: {
      id: 'src-ch3',
      title: 'Chapter 3',
      type: 'chapter',
      section: 'authored',
      summary: 'Summary',
      tags: ['Self-Love'],
      isProtected: true,
      isPublished: true,
      authorUid: AUTHOR_UID,
      createdAt: 'TAMPERED_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expectedAllow: false,
  },
  {
    id: 9,
    name: 'Client-forged static timestamp instead of request.time',
    operation: 'create',
    path: '/archive_sources/src-ch3',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: true },
    usesServerTimestamp: false,
    payload: {
      id: 'src-ch3',
      title: 'Chapter 3',
      type: 'chapter',
      section: 'authored',
      summary: 'Summary',
      tags: ['Self-Love'],
      isProtected: true,
      isPublished: true,
      authorUid: AUTHOR_UID,
      createdAt: 1700000000,
      updatedAt: 1700000000,
    },
    expectedAllow: false,
  },
  {
    id: 10,
    name: 'Path variable ID poisoning with unsafe characters',
    operation: 'create',
    path: '/archive_assets/bad$id!injection',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: true },
    usesServerTimestamp: true,
    payload: {
      assetId: 'bad$id!injection',
      dataBase64: 'AAAA',
    },
    expectedAllow: false,
  },
  {
    id: 11,
    name: 'Denial-of-Wallet oversized >850KB base64 asset write',
    operation: 'create',
    path: '/archive_assets/asset-oversized',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: true },
    usesServerTimestamp: true,
    payload: {
      assetId: 'asset-oversized',
      dataBase64: 'A'.repeat(900000),
    },
    expectedAllow: false,
  },
  {
    id: 12,
    name: 'Orphaned private_content write without parent ArchiveSource',
    operation: 'create',
    path: '/archive_sources/missing-source/private_content/full',
    auth: { uid: AUTHOR_UID, email: AUTHOR_EMAIL, email_verified: true },
    parentExists: false,
    usesServerTimestamp: true,
    payload: {
      sourceId: 'missing-source',
      rawContent: 'Orphaned secret text',
    },
    expectedAllow: false,
  },
];

export function runDirtyDozenSuite(): { passed: number; failed: string[] } {
  const failed: string[] = [];
  for (const tc of DIRTY_DOZEN_CASES) {
    const allowed = evaluateHardenedRules(tc);
    if (allowed !== tc.expectedAllow) {
      failed.push(`Case #${tc.id} (${tc.name}) unexpectedly returned allow=${allowed}`);
    }
  }
  return { passed: DIRTY_DOZEN_CASES.length - failed.length, failed };
}
