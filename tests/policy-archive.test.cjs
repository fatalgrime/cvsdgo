const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === 'react/jsx-runtime') return require(name);
    throw new Error('Unexpected dependency: ' + name);
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
const access = load('lib/policy-archive-access.ts');
const definitions = load('lib/policy-definitions.ts');
const legacy = load('lib/legacy-policy-documents.ts');
const cutoff = Date.parse('2026-11-09T07:00:00Z');
test('archive expires at the start of November 9 in Mountain Time', () => {
  assert.equal(access.POLICY_ARCHIVE_CLOSES_AT_MS, cutoff);
  assert.equal(access.isPolicyArchivePublic(cutoff - 1), true);
  assert.equal(access.isPolicyArchivePublic(cutoff), false);
  assert.equal(access.isPolicyArchivePublic(cutoff + 1), false);
});
function page(open) {
  return load('app/(dashboard)/site/policies/[documentKey]/previous/page.tsx', {
    'next/link': { default: 'a' },
    'next/navigation': { notFound: () => { throw new Error('404'); } },
    '@/components/policy-markdown': { PolicyMarkdown: 'markdown' },
    '@/components/policy-archive-window': { PolicyArchiveWindow: 'window' },
    '@/lib/policy-archive-access': { isPolicyArchivePublic: () => open },
    '@/lib/legacy-policy-documents': legacy,
    '@/lib/policy-definitions': definitions,
  });
}
test('both old policies render before expiration and reject unknown policy keys', async () => {
  const route = page(true);
  for (const key of ['terms', 'privacy']) {
    assert.ok(await route.default({ params: Promise.resolve({ documentKey: key }) }));
    assert.equal(legacy.LEGACY_POLICY_DOCUMENTS[key].effectiveDate, 'March 10, 2026');
    assert.ok(legacy.LEGACY_POLICY_DOCUMENTS[key].markdown.length > 1000);
  }
  await assert.rejects(route.default({ params: Promise.resolve({ documentKey: 'invalid' }) }), /404/);
  assert.equal(route.dynamic, 'force-dynamic');
  assert.equal(route.metadata.robots.index, false);
});
test('direct old policy URLs are blocked after expiration', async () => {
  for (const key of ['terms', 'privacy']) {
    await assert.rejects(page(false).default({ params: Promise.resolve({ documentKey: key }) }), /404/);
  }
});
test('buttons are omitted on the server after expiration', () => {
  for (const open of [true, false]) {
    const { PreviousPolicyLink } = load('components/previous-policy-link.tsx', {
      'next/link': { default: 'a' },
      '@/components/policy-archive-window': { PolicyArchiveWindow: 'window' },
      '@/lib/policy-archive-access': { isPolicyArchivePublic: () => open },
      '@/lib/policy-definitions': definitions,
    });
    for (const key of ['terms', 'privacy']) assert.equal(PreviousPolicyLink({ documentKey: key }) !== null, open);
  }
});
test('open pages schedule expiry and recheck on browser restore or visibility change', () => {
  let now = cutoff - 1000;
  let state;
  let timer;
  let cleanup;
  const listeners = new Map();
  const target = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const { PolicyArchiveWindow } = load('components/policy-archive-window.tsx', {
    'react': { useState: init => { state = init(); return [state, value => { state = value; }]; }, useEffect: fn => { cleanup = fn(); } },
    '@/lib/policy-archive-access': { POLICY_ARCHIVE_CLOSES_AT_MS: cutoff, isPolicyArchivePublic: () => now < cutoff },
  }, { Date: { now: () => now }, setTimeout: (fn, delay) => { timer = { fn, delay }; return 1; }, clearTimeout: () => {}, window: target, document: target });
  assert.equal(PolicyArchiveWindow({ children: 'old policy' }), 'old policy');
  assert.equal(timer.delay, 1000);
  now = cutoff;
  timer.fn();
  assert.equal(state, false);
  assert.ok(listeners.has('pageshow'));
  assert.ok(listeners.has('visibilitychange'));
  assert.equal(PolicyArchiveWindow({ children: 'old policy' }), null);
  cleanup();
  assert.equal(listeners.size, 0);
});
