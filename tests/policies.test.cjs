const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error('Unexpected dependency: ' + name);
  }, module, module.exports);
  return module.exports;
}
const definitions = load('lib/policy-definitions.ts');
test('legacy effective dates are preserved and removed from the policy body', () => {
  for (const marker of ['', '*', '**']) {
    assert.deepEqual(definitions.splitPolicyEffectiveDate(marker + 'Effective date: April 2, 2027' + marker + '\r\n\r\nPolicy body'), {
      markdown: 'Policy body', effectiveDate: 'April 2, 2027',
    });
  }
  assert.equal(definitions.splitPolicyEffectiveDate('Policy body').markdown, 'Policy body');
});
function storage(initial = [], available = true) {
  const rows = new Map(initial.map(row => [row.setting_key, row]));
  const writes = [];
  const audit = [];
  const policies = load('lib/policies.ts', {
    '@/lib/policy-definitions': definitions,
    '@/lib/db': { hasDatabaseUrl: () => available, getSql: () => async (parts, ...values) => {
      if (parts.join('').includes('INSERT')) {
        writes.push(values);
        for (let i = 0; i < values.length; i += 2) rows.set(values[i], { setting_key: values[i], setting_value: values[i + 1], updated_at: '2026-11-02T12:00:00Z' });
        return [];
      }
      return values.map(key => rows.get(key)).filter(Boolean);
    } },
    '@/lib/audit': { ensureAuditSchema: async () => {}, getRequestContext: () => ({}), logAuditEvent: async event => audit.push(event) },
  });
  return { policies, writes, audit };
}
test('default policies expose a date without duplicating it in the body', async () => {
  for (const key of ['terms', 'privacy']) {
    const doc = await storage([], false).policies.getPolicyDocument(key);
    assert.equal(doc.effectiveDate, 'March 10, 2026');
    assert.doesNotMatch(doc.markdown, /^\*Effective date:/);
  }
});
test('saved effective date overrides a legacy date and saves atomically with content', async () => {
  const { policies, writes, audit } = storage([{ setting_key: 'policy_terms_markdown', setting_value: '*Effective date: July 1, 2026*\n\nPolicy body' }]);
  assert.equal((await policies.getPolicyDocument('terms')).effectiveDate, 'July 1, 2026');
  const result = await policies.savePolicyDocument({ key: 'terms', markdown: 'Revised body', effectiveDate: '  Upon board approval  ', actorUserId: 'staff' });
  assert.equal(result.effectiveDate, 'Upon board approval');
  assert.equal(result.markdown, 'Revised body');
  assert.equal(writes.length, 1);
  assert.equal(audit[0].metadata.effectiveDate, 'Upon board approval');
});
test('invalid dates are rejected before any writes', async () => {
  const { policies, writes } = storage();
  for (const effectiveDate of ['', '   ', 'x'.repeat(201)]) {
    await assert.rejects(policies.savePolicyDocument({ key: 'privacy', markdown: 'Body', effectiveDate, actorUserId: 'staff' }), /Effective date/);
  }
  assert.equal(writes.length, 0);
});
test('policy API preserves authorization and validates date input', async () => {
  for (const [userId, admin, expected] of [[null, false, 401], ['staff', false, 403], ['admin', true, 400]]) {
    let saved = false;
    const route = load('app/api/admin/policies/route.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId }) },
      '@/lib/access': { isAdminUser: async () => admin },
      '@/lib/policies': { ...definitions, savePolicyDocument: async () => { saved = true; } },
    });
    const response = await route.POST(new Request('https://example.com/api/admin/policies', { method: 'POST', body: JSON.stringify({ documentKey: 'terms', markdown: 'Body', effectiveDate: ' ' }) }));
    assert.equal(response.status, expected);
    assert.equal(saved, false);
  }
});
