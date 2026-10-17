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
