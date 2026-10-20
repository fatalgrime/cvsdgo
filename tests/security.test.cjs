const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

// Load TypeScript with explicit service mocks; no live database or Clerk account.
function load(relativePath, mocks = {}, globals = {}) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), source)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports, ...Object.values(globals));
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

test('report endpoints reject malformed and non-object JSON without writes', async () => {
  for (const [file, method] of [
    ['app/api/reports/route.ts', 'POST'],
    ['app/api/reports/[id]/route.ts', 'PUT'],
    ['app/api/reports/[id]/comments/route.ts', 'POST'],
  ]) {
    const route = load(file, {
      '@clerk/nextjs/server': {
        auth: async () => ({ userId: 'staff' }),
        clerkClient: async () => { throw new Error('Invalid body reached Clerk'); },
      },
      '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => { throw new Error('Invalid body reached database'); } },
      '@/lib/report-schema': { ensureReportSchema: async () => { throw new Error('Invalid body reached migration'); } },
      '@/lib/access': { isReportStaffUser: async () => true },
      '@/lib/audit': {},
      '@/lib/automod': {},
      '@/lib/report-submissions': {},
    });
    for (const body of ['', '{', 'null', '[]', '"text"', 'true', '42']) {
      const response = await route[method](new Request('https://example.com/api/reports/1', {
        method, body,
      }), { params: Promise.resolve({ id: '1' }) });
      assert.equal(response.status, 400, `${file}: ${body}`);
    }
  }
});

test('folder schema repairs an existing table and retries failed migrations', async () => {
  let fail = true;
  const columns = new Set(['id', 'name', 'is_public']);
  const sql = async (parts) => {
    const text = parts.join('?');
    // Existing table: CREATE IF NOT EXISTS leaves its old columns unchanged.
    if (/ALTER TABLE link_folders/.test(text)) {
      if (fail) { fail = false; throw new Error('Temporary migration failure'); }
      columns.add('sort_order');
    }
    if (/ALTER TABLE redirects/.test(text) && /folder_id/.test(text)) columns.add('folder_id');
    return [{ exists: true }];
  };
  const schema = load('lib/link-schema.ts', {
    '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => sql },
  });
  await assert.rejects(schema.ensureLinkSchema(), /Temporary migration failure/);
  await schema.ensureLinkSchema();
  assert.ok(columns.has('sort_order'));
  assert.ok(columns.has('folder_id'));
});

function reportStatusRoute(sql) {
  const events = [];
  return {
    events,
    route: load('app/api/reports/[id]/route.ts', {
      '@clerk/nextjs/server': {
        auth: async () => ({ userId: 'staff' }),
        clerkClient: async () => ({ users: { getUser: async () => ({ firstName: 'Staff', lastName: null, username: 'staff' }) } }),
      },
      '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => sql },
      '@/lib/report-schema': { ensureReportSchema: async () => {} },
      '@/lib/access': { isReportStaffUser: async () => true },
      '@/lib/audit': { getRequestContext: () => ({}), logAuditEvent: async (event) => { events.push(event); } },
    }),
  };
}

test('report status and penalties are sent as one database operation before auditing', async () => {
  for (const status of ['rejected', 'resolved']) {
    let writes = 0;
    const { route, events } = reportStatusRoute(async () => {
      writes++;
      assert.equal(events.length, 0);
      return [{ id: 1, user_id: 'reporter', status }];
    });
    const response = await route.PUT(new Request('https://example.com/api/reports/1', {
      method: 'PUT', body: JSON.stringify({ status }),
    }), { params: Promise.resolve({ id: '1' }) });
    assert.equal(response.status, 200);
    assert.equal(writes, 1);
    assert.equal(events.length, 1);
    assert.equal((await response.json()).report.status, status);
  }
});

test('failed or missing report updates do not emit success audits', async () => {
  for (const fail of [true, false]) {
    const { route, events } = reportStatusRoute(async () => {
      if (fail) throw new Error('Penalty write failed');
      return [];
    });
    const pending = route.PUT(new Request('https://example.com/api/reports/1', {
      method: 'PUT', body: JSON.stringify({ status: 'rejected' }),
    }), { params: Promise.resolve({ id: '1' }) });
    if (fail) await assert.rejects(pending, /Penalty write failed/);
    else assert.equal((await pending).status, 404);
    assert.equal(events.length, 0);
  }
});

const announcementTypes = load('lib/announcement-types.ts');
const announcementInput = { audience: 'everyone', title: 'District update', message: 'School opens at 9.', tone: 'info', dismissible: true, published: false };

test('announcement validation enforces lengths, settings and supported tones', () => {
  assert.deepEqual(announcementTypes.parseAnnouncement({ ...announcementInput, title: '  District update  ' }), announcementInput);
  for (const value of [null, [], 'text', {},
    { ...announcementInput, title: ' ' }, { ...announcementInput, title: 'a'.repeat(101) },
    { ...announcementInput, message: 'a'.repeat(1001) }, { ...announcementInput, message: '' },
    { ...announcementInput, published: 'true' }, { ...announcementInput, dismissible: 1 },
    { ...announcementInput, audience: undefined }, { ...announcementInput, audience: null },
    { ...announcementInput, audience: 'students' }, { ...announcementInput, audience: ['staff'] },
    { ...announcementInput, tone: ['info'] }, { ...announcementInput, tone: 'invalid' },
  ]) assert.equal(announcementTypes.parseAnnouncement(value), null);
  assert.notEqual(announcementTypes.announcementKey({ id: '1', revision: 1 }), announcementTypes.announcementKey({ id: '1', revision: 2 }));
});

function announcementAdmin({ denied = null, rows = [{ id: '1' }] } = {}) {
  let writes = 0;
  const audits = [];
  const route = load('app/api/admin/announcements/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'admin-1' }) },
    '@/lib/audit': { getRequestContext: () => ({ actorIpAddress: '127.0.0.1' }), logAuditEvent: async event => { audits.push(event); } },
    '@/lib/access': { requireAdminUser: async () => denied },
    '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async () => { writes++; return rows; } },
    '@/lib/announcements': { ensureAnnouncementSchema: async () => {}, getAnnouncements: async (drafts) => { assert.equal(drafts, true); return []; } },
    '@/lib/announcement-types': announcementTypes,
  });
  return { route, writes: () => writes, audits };
}

test('all announcement administration endpoints reject unauthorized callers', async () => {
  for (const status of [401, 403]) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const { route, writes } = announcementAdmin({ denied: new Response('Denied', { status }) });
      const response = await route[method](new Request('https://example.com/api/admin/announcements', {
        method, ...(method === 'GET' ? {} : { body: JSON.stringify({ ...announcementInput, id: '1' }) }),
      }));
      assert.equal(response.status, status);
      assert.equal(writes(), 0);
    }
  }
});

test('announcement create, edit, delete validate input and return useful results', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const { route, writes } = announcementAdmin();
    const response = await route[method](new Request('https://example.com/api/admin/announcements', { method, body: JSON.stringify({ ...announcementInput, id: '1' }) }));
    assert.equal(response.status, method === 'POST' ? 201 : 200);
    assert.equal(writes(), 1);
    for (const body of ['{', 'null', '[]', JSON.stringify({ id: '-1' }), JSON.stringify({ ...announcementInput, id: '9223372036854775808', title: '' })]) {
      assert.equal((await route[method](new Request('https://example.com/api/admin/announcements', { method, body }))).status, 400);
    }
    assert.equal(writes(), 1);
  }
  const { route } = announcementAdmin({ rows: [] });
  assert.equal((await route.DELETE(new Request('https://example.com/api/admin/announcements', { method: 'DELETE', body: '{"id":"1"}' }))).status, 404);
});

test('announcement feed uses authenticated roles and never requests drafts', async () => {
  for (const [userId, access, includeStaff] of [
    [null, { admin: false, reportStaff: false }, false],
    ['regular', { admin: false, reportStaff: false }, false],
    ['staff', { admin: false, reportStaff: true }, true],
    ['admin', { admin: true, reportStaff: false }, true],
    ['allowlisted', { admin: true, reportStaff: true, allowlisted: true }, true],
  ]) {
    const route = load('app/api/announcements/route.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId }) },
      '@/lib/access': { getAccessProfile: async id => { assert.equal(id, userId); return access; } },
      '@/lib/announcements': { getAnnouncements: async (...args) => { assert.deepEqual(args, [false, includeStaff]); return []; } },
    });
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('announcement queries filter audience and publication independently with safe defaults', async () => {
  const queries = [];
  const { getAnnouncements } = load('lib/announcements.ts', {
    '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async (parts, ...values) => {
      queries.push({ sql: parts.join('?'), values });
      return [];
    } },
  });
  for (const args of [[], [false, true], [true, true], [true, false]]) {
    await getAnnouncements(...args);
    const query = queries.at(-1);
    assert.match(query.sql, /WHERE \(published = TRUE OR \?\)\s+AND \(audience = 'everyone' OR \?\)/);
    assert.deepEqual(query.values, [args[0] ?? false, args[1] ?? false]);
  }
  assert.ok(queries.some(query => query.sql.includes('ADD COLUMN IF NOT EXISTS audience')));
});

test('staff audience survives creation and editing', async () => {
  for (const method of ['POST', 'PUT']) {
    const queries = [];
    const input = { ...announcementInput, audience: 'staff', id: '1' };
    const route = load('app/api/admin/announcements/route.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId: 'allowlisted' }) },
      '@/lib/access': { requireAdminUser: async () => null },
      '@/lib/audit': { getRequestContext: () => ({}), logAuditEvent: async () => {} },
      '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async (parts, ...values) => {
        queries.push({ sql: parts.join('?'), values }); return [input];
      } },
      '@/lib/announcements': { ensureAnnouncementSchema: async () => {} },
      '@/lib/announcement-types': announcementTypes,
    });
    const response = await route[method](new Request('https://example.com/api/admin/announcements', { method, body: JSON.stringify(input) }));
    assert.equal(response.status, method === 'POST' ? 201 : 200);
    assert.ok(queries[0].values.includes('staff'));
    assert.match(queries[0].sql, /audience/);
  }
});

test('banner renders plain text safely and only offers dismissal when allowed', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { AnnouncementBanner } = load('components/announcement-banner.tsx', {
    react: React, 'react/jsx-runtime': require('react/jsx-runtime'), '@/lib/announcement-types': announcementTypes,
  });
  const initial = [
    { ...announcementInput, id: '1', revision: 1, published: true, title: 'Required update', dismissible: false, message: '<script>alert(1)</script>' },
    { ...announcementInput, id: '2', revision: 1, published: true, title: 'Optional update' },
    { ...announcementInput, id: '3', revision: 1, title: 'Private draft' },
  ];
  const html = renderToStaticMarkup(React.createElement(AnnouncementBanner, { initial }));
  assert.ok(html.includes('Required update'));
  assert.ok(html.includes('Dismiss announcement: Optional update'));
  assert.ok(!html.includes('Dismiss announcement: Required update'));
  assert.ok(!html.includes('Private draft'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('dismissal hides only the matching version of a dismissible published announcement', () => {
  const item = { ...announcementInput, id: '1', revision: 1, published: true };
  const dismissed = ['1:1'];
  assert.equal(announcementTypes.isAnnouncementVisible(item, dismissed), false);
  assert.equal(announcementTypes.isAnnouncementVisible({ ...item, revision: 2 }, dismissed), true);
  assert.equal(announcementTypes.isAnnouncementVisible({ ...item, dismissible: false }, dismissed), true);
  assert.equal(announcementTypes.isAnnouncementVisible({ ...item, published: false }, []), false);
  assert.equal(announcementTypes.isAnnouncementVisible({ ...item, id: '2' }, dismissed), true);
});

test('announcement mutations record actor, announcement snapshot and publication settings', async () => {
  for (const [method, action] of [['POST', 'Announcement created'], ['PUT', 'Announcement updated'], ['DELETE', 'Announcement deleted']]) {
    for (const published of [true, false]) {
      const saved = { ...announcementInput, id: '7', revision: 2, published };
      const { route, audits } = announcementAdmin({ rows: [saved] });
      const response = await route[method](new Request('https://example.com/api/admin/announcements', { method, body: JSON.stringify(saved) }));
      assert.ok(response.ok);
      assert.equal(audits.length, 1);
      assert.equal(audits[0].action, action);
      assert.equal(audits[0].category, 'announcements');
      assert.equal(audits[0].source, 'admin-announcements');
      assert.equal(audits[0].actorUserId, 'admin-1');
      assert.deepEqual(audits[0].metadata.announcement, saved);
    }
  }
  const { route, audits } = announcementAdmin({ rows: [] });
  await route.DELETE(new Request('https://example.com/api/admin/announcements', { method: 'DELETE', body: '{"id":"7"}' }));
  assert.equal(audits.length, 0);
});

test('announcement audit events stay internal even for critical severity and repeated deletions', async () => {
  let deliveries = 0;
  let webhookReads = 0;
  const recorded = [];
  const audit = load('lib/audit.ts', {
    '@clerk/nextjs/server': {},
    '@/lib/access': {},
    '@/lib/db': {
      hasDatabaseUrl: () => true,
      getSql: () => async (parts, ...values) => {
        const query = parts.join('?');
        if (/INSERT INTO audit_logs/.test(query)) recorded.push(values);
        if (/SELECT setting_value/.test(query)) { webhookReads++; return [{ setting_value: 'https://example.invalid/webhook' }]; }
        return [];
      },
    },
  }, {
    setInterval: () => 0,
    fetch: async () => { deliveries++; return { ok: true }; },
  });
  for (let index = 0; index < 5; index++) {
    await audit.logAuditEvent({ action: 'Announcement deleted', category: 'announcements', severity: 'critical' });
  }
  await audit.logAuditEvent({ action: 'Updated', source: 'admin-announcements', severity: 'critical' });
  assert.equal(recorded.length, 6);
  assert.equal(deliveries, 0);
  assert.equal(webhookReads, 0);
  // Other activity retains its existing webhook delivery behavior.
  await audit.logAuditEvent({ action: 'Link deleted', category: 'links' });
  assert.equal(recorded.length, 7);
  assert.equal(deliveries, 1);
  assert.equal(webhookReads, 1);
});

test('site settings rejects signed-out and non-admin users before rendering tools', async () => {
  for (const userId of [null, 'report-staff', 'regular-user']) {
    const { default: SettingsLayout } = load('app/(dashboard)/site/settings/layout.tsx', {
      '@clerk/nextjs/server': { auth: async () => ({ userId }) },
      '@/lib/access': { isAdminUser: async () => false },
      'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
      '@/components/settings-nav': { SettingsNav: () => null },
      'react/jsx-runtime': { jsx: () => { throw new Error('Unauthorized render'); }, jsxs: () => { throw new Error('Unauthorized render'); } },
    });
    await assert.rejects(SettingsLayout({ children: 'private tools' }), /redirect:\/access-denied/);
  }
});

test('site settings renders its tools for administrators', async () => {
  const render = (type, props) => ({ type, props });
  const { default: SettingsLayout } = load('app/(dashboard)/site/settings/layout.tsx', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'admin' }) },
    '@/lib/access': { isAdminUser: async () => true },
    'next/navigation': { redirect: () => { throw new Error('Unexpected redirect'); } },
    '@/components/settings-nav': { SettingsNav: () => null },
    'react/jsx-runtime': { jsx: render, jsxs: render },
  });
  const result = await SettingsLayout({ children: 'private tools' });
  assert.equal(result.props.children[1], 'private tools');
});
