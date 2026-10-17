const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Load TypeScript with explicit service mocks; no live database or Clerk account.
function load(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}

const normalize = load('lib/normalize.ts');
const invalidUrls = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', 'ftp://example.com', '//example.com', '/relative', 'not a URL', ''];

test('destinations accept HTTP/HTTPS and reject other protocols and malformed URLs', () => {
  assert.equal(normalize.parseDestinationUrl('HTTPS://Example.COM/path?q=1#anchor'), 'https://example.com/path?q=1#anchor');
  assert.equal(normalize.parseDestinationUrl('http://example.com'), 'http://example.com/');
  for (const url of invalidUrls) assert.equal(normalize.parseDestinationUrl(url), null, url);
});

test('create and edit reject unsafe URLs before writing to the database', async () => {
  const existing = { id: 1, slug: 'test', url: 'https://example.com/', is_locked: false, folder_id: null };
  for (const file of ['app/api/links/route.ts', 'app/api/links/[id]/route.ts']) {
    const queries = [];
    const route = load(file, {
      'next/cache': { revalidateTag() { throw new Error('Unexpected invalidation'); } },
      '@clerk/nextjs/server': {},
      '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async (parts) => {
        queries.push(parts.join('?'));
        return [existing];
      } },
      '@/lib/normalize': normalize,
      '@/lib/password': {},
      '@/lib/access': { requireAllowedUser: async () => null },
      '@/lib/link-schema': { ensureLinkSchema: async () => {} },
      '@/lib/audit': { getRequestContext: () => ({}) },
      '@/lib/automod': { validateContentWithAutoMod() { throw new Error('Unsafe URL reached AutoMod'); } },
    });
    for (const url of invalidUrls) {
      const request = new Request('https://example.com/api/links', {
        method: route.POST ? 'POST' : 'PUT',
        body: JSON.stringify({ slug: 'test', url }),
      });
      const response = await (route.POST || route.PUT)(request, { params: Promise.resolve({ id: '1' }) });
      assert.equal(response.status, 400, `${file}: ${url}`);
    }
    assert.ok(queries.every((query) => !/INSERT|UPDATE|DELETE/.test(query)));
  }
});

test('public directory redacts protected destinations from cache and fallback', async () => {
  const locked = { id: 1, slug: 'locked', url: 'https://secret.example/', is_locked: true };
  const open = { id: 2, slug: 'open', url: 'https://public.example/', is_locked: false };
  for (const cached of [[locked, open], []]) {
    const redirects = load('lib/redirects.ts', {
      '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async () => [locked, open] },
      'next/cache': { unstable_cache: () => async () => cached },
      '@/lib/link-schema': { ensureLinkSchema: async () => {} },
    });
    const result = await redirects.getAllRedirects();
    assert.equal(result[0].url, '');
    assert.equal(result[1].url, open.url);
    assert.ok(!JSON.stringify(result).includes('secret.example'));
    assert.equal(locked.url, 'https://secret.example/');
  }
});

test('admin requires trusted Discord identity or private role metadata', () => {
  const { getAccessProfileForUser: profile } = load('lib/access.ts', { '@clerk/nextjs/server': {} });
  const user = { username: 'admin', externalAccounts: [], privateMetadata: {} };
  for (const username of ['admin', 'ADMIN', 'someone', null]) {
    const result = profile({ ...user, username });
    assert.equal(result.admin, false);
    assert.equal(result.canManageLinks, false);
  }
  assert.equal(profile({ ...user, publicMetadata: { cvsdGo: { admin: true } } }).admin, false);
  assert.equal(profile({ ...user, privateMetadata: { cvsdGo: { admin: 'true' } } }).admin, false);
  assert.equal(profile({ ...user, privateMetadata: { cvsdGo: { admin: true } } }).admin, true);
  const staff = profile({ ...user, privateMetadata: { cvsdGo: { reportStaff: true } } });
  assert.equal(staff.canManageReports, true);
  assert.equal(staff.admin, false);
  assert.equal(profile({ ...user, externalAccounts: [{ provider: 'oauth_discord', providerUserId: '1012507248305647718' }] }).admin, true);
  assert.equal(profile({ ...user, externalAccounts: [{ provider: 'oauth_discord', providerUserId: 'other' }] }).admin, false);
  assert.equal(profile({ ...user, externalAccounts: [{ provider: 'oauth_google', providerUserId: '1012507248305647718' }] }).admin, false);
});

test('inactive links are excluded on every cache read and fallback', async () => {
  const now = Date.now();
  const rows = [
    { slug: 'active', url: 'https://active.example/' },
    { slug: 'future', url: 'https://future.example/', release_at: new Date(now + 60000) },
    { slug: 'expired', url: 'https://expired.example/', expires_at: new Date(now - 60000).toISOString() },
    { slug: 'invalid', url: 'https://invalid.example/', release_at: 'invalid' },
    { slug: 'released', url: 'https://released.example/', release_at: new Date(now - 60000), expires_at: new Date(now + 60000) },
  ];
  for (const cached of [rows, []]) {
    const redirects = load('lib/redirects.ts', {
      '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async () => rows },
      'next/cache': { unstable_cache: () => async () => cached },
      '@/lib/link-schema': { ensureLinkSchema: async () => {} },
    });
    assert.deepEqual((await redirects.getAllRedirects()).map(r => r.slug), ['active', 'released']);
    rows[4].expires_at = new Date(now - 1);
    assert.deepEqual((await redirects.getAllRedirects()).map(r => r.slug), ['active']);
    rows[4].expires_at = new Date(now + 60000);
  }
});

test('async password verification preserves legacy hashes and rejects wrong passwords', async () => {
  const crypto = require('node:crypto');
  const passwords = load('lib/password.ts', { crypto, util: require('node:util') });
  const oldHash = `pbkdf2$310000$salt$${crypto.pbkdf2Sync('secret', 'salt', 310000, 32, 'sha256').toString('hex')}`;
  assert.equal(await passwords.verifyPassword('secret', oldHash), true);
  assert.equal(await passwords.verifyPassword('wrong', oldHash), false);
  const pending = passwords.hashPassword('new secret');
  assert.ok(pending instanceof Promise);
  assert.equal(await passwords.verifyPassword('new secret', await pending), true);
  for (const hash of [null, 'garbage', 'pbkdf2$1.5$salt$hash', 'pbkdf2$999999999$salt$hash']) {
    assert.equal(await passwords.verifyPassword('secret', hash), false);
  }
});

function unlockRoute({ allowed = true, limiterError = false, valid = false, admin = false } = {}) {
  const calls = { limit: 0, verify: 0, clicks: 0 };
  const route = load('app/api/redirect/[slug]/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'user' }) },
    '@/lib/access': { getAccessProfile: async () => ({ admin }) },
    '@/lib/db': { hasDatabaseUrl: () => true },
    '@/lib/password': { verifyPassword: async () => { calls.verify++; return valid; } },
    '@/lib/unlock-rate-limit': { consumeUnlockAttempt: async () => {
      calls.limit++;
      if (limiterError) throw new Error('Database unavailable');
      return allowed;
    } },
    '@/lib/redirects': {
      getRedirectBySlug: async () => ({ is_locked: true, url: 'https://secret.example/', password_hash: 'hash' }),
      recordClick: async () => { calls.clicks++; },
    },
  });
  return { calls, post: (body) => route.POST(new Request('https://example.com/api/redirect/locked', {
    method: 'POST', body: JSON.stringify(body),
  }), { params: Promise.resolve({ slug: 'locked' }) }) };
}

test('throttled unlocks never hash passwords or disclose destinations', async () => {
  const { post, calls } = unlockRoute({ allowed: false, valid: true });
  const response = await post({ password: 'secret' });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.deepEqual(calls, { limit: 1, verify: 0, clicks: 0 });
  assert.ok(!(await response.text()).includes('secret.example'));
});

test('unlock awaits password verification and permits only verified overrides', async () => {
  for (const valid of [false, true]) {
    const { post, calls } = unlockRoute({ valid });
    const response = await post({ password: 'secret' });
    assert.equal(response.status, valid ? 200 : 401);
    assert.equal(calls.verify, 1);
    assert.equal(calls.clicks, valid ? 1 : 0);
  }
  for (const admin of [false, true]) {
    const { post, calls } = unlockRoute({ allowed: false, admin });
    const response = await post({ override: true });
    assert.equal(response.status, admin ? 200 : 403);
    assert.equal(calls.verify, 0);
    assert.equal(calls.limit, 0);
  }
});

test('report writes acquire a transaction lock before quota decisions and recording', async () => {
  const queries = [];
  const sql = (parts, ...values) => ({ text: parts.join('?'), values });
  sql.transaction = async (statements, options) => {
    assert.equal(options.isolationLevel, 'ReadCommitted');
    queries.push(...statements);
    return [[], [{ report: null, reason: 'hourly' }]];
  };
  const { submitReport } = load('lib/report-submissions.ts', {
    '@/lib/db': { getSql: () => sql },
    '@/lib/abuse-schema': { ensureAbuseSchema: async () => {} },
  });
  const result = await submitReport({ userId: 'user', email: null, title: 'Report', description: 'Details', linkSlug: null, priority: 'normal', metadata: null });
  assert.equal(result.reason, 'hourly');
  assert.equal(queries.length, 2);
  assert.match(queries[0].text, /pg_advisory_xact_lock/);
  assert.match(queries[1].text, /FROM report_submissions/);
  assert.match(queries[1].text, /INSERT INTO report_submissions/);
  assert.match(queries[1].text, /FROM decision WHERE reason IS NULL/);
});

test('unlock fails closed when the shared limiter is unavailable', async () => {
  const { post, calls } = unlockRoute({ limiterError: true, valid: true });
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal((await post({ password: 'secret' })).status, 503);
    assert.deepEqual(calls, { limit: 1, verify: 0, clicks: 0 });
  } finally {
    console.error = original;
  }
});

test('shared limiter uses an atomic bounded upsert and normalizes link keys', async () => {
  for (const accepted of [true, false]) {
    let query;
    const { consumeUnlockAttempt } = load('lib/unlock-rate-limit.ts', {
      '@/lib/db': { getSql: () => async (parts, ...values) => {
        query = { text: parts.join('?'), values };
        return accepted ? [{ slug: 'locked' }] : [];
      } },
      '@/lib/abuse-schema': { ensureAbuseSchema: async () => {} },
    });
    assert.equal(await consumeUnlockAttempt(' LOCKED '), accepted);
    assert.equal(query.values[0], 'locked');
    assert.match(query.text, /ON CONFLICT \(slug\) DO UPDATE/);
    assert.match(query.text, /OR link_unlock_attempts.attempts </);
  }
});

test('submission outcome maps quota denials to 429 and bans to 403', async () => {
  for (const reason of ['hourly', 'daily', 'banned', null]) {
    let audits = 0;
    const route = load('app/api/reports/route.ts', {
      '@/lib/report-submissions': { submitReport: async () => ({ reason, report: reason ? null : { id: 1 } }) },
      '@clerk/nextjs/server': {
        auth: async () => ({ userId: 'user' }),
        clerkClient: async () => ({ users: { getUser: async () => ({ emailAddresses: [] }) } }),
      },
      '@/lib/db': { hasDatabaseUrl: () => true },
      '@/lib/report-schema': { ensureReportSchema: async () => {} },
      '@/lib/access': {},
      '@/lib/audit': { logAuditEvent: async () => { audits++; } },
      '@/lib/automod': { validateContentWithAutoMod: async () => ({ isClean: true }) },
    });
    const response = await route.POST(new Request('https://example.com/api/reports', {
      method: 'POST', body: JSON.stringify({ title: 'Report', description: 'Details' }),
    }));
    assert.equal(response.status, reason === 'banned' ? 403 : reason ? 429 : 201);
    assert.equal(audits, reason ? 0 : 1);
  }
});
