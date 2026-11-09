const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === '@/lib/audit-redaction') return redaction;
    throw new Error('Unexpected dependency: ' + name);
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
const redaction = load('lib/audit-redaction.ts');
const { redactAuditData, auditSecretValues, AUDIT_REDACTED: hidden } = redaction;
test('sensitive fields are hidden recursively, including arrays and historical setting values', () => {
  const input = { id: 15, actor_user_id: 'user_staff', source: 'link-manager', metadata: {
    apiKey: 'short', nested: [{ password: 'tiny', safe: 'hello' }, { CLIENT_SECRET: 'client-value' }],
    authorization: 'Bearer credential', credentials: { user: 'x', password: 'y' },
    headers: { Cookie: 'session=plain' }, headerPairs: [['X-API-Key', 'pair-credential']],
    changes: { settingKey: 'discord_webhook_url', previousValue: 'old-value', newValue: 'new-value', valueChanged: true },
    variable: { name: 'DATABASE_URL', value: 'connection', from: 'before', to: 'after' },
    policyKey: 'terms', storageKey: 'policy_terms_markdown', newLength: 150,
  } };
  const safe = redactAuditData(input);
  for (const secret of ['short', 'tiny', 'client-value', 'Bearer credential', 'old-value', 'new-value', 'connection', 'before', 'after', 'pair-credential']) assert.ok(!JSON.stringify(safe).includes(secret), secret);
  assert.equal(safe.metadata.apiKey, hidden);
  assert.equal(safe.metadata.nested[0].safe, 'hello');
  assert.equal(safe.metadata.changes.settingKey, 'discord_webhook_url');
  assert.equal(safe.metadata.changes.valueChanged, true);
  assert.equal(safe.metadata.policyKey, 'terms');
  assert.equal(safe.actor_user_id, 'user_staff');
  assert.equal(safe.metadata.newLength, 150);
  assert.equal(input.metadata.apiKey, 'short');
  assert.deepEqual(redactAuditData(safe), safe);
});
test('recognizes free-text credentials, credential URLs, tokens, private keys, and encoded secrets', () => {
  const examples = [
    ['Authorization: Bearer abc.def.secret', 'abc.def.secret'],
    ['Basic dXNlcjpwYXNzd29yZA==', 'dXNlcjpwYXNzd29yZA=='],
    ['password="phrase with spaces"', 'phrase with spaces'],
    ['API_KEY=plain-value', 'plain-value'],
    ['token is unprefixed-credential', 'unprefixed-credential'],
    ['https://name:password@example.com/path', 'name:password'],
    ['postgresql://name:password@db.example/app', 'name:password'],
    ['https://example.com?api_key=query-credential&safe=1', 'query-credential'],
    ['https://example.com#access_token=fragment-credential', 'fragment-credential'],
    ['https://discord.com/api/webhooks/12345/discord-credential', 'discord-credential'],
    ['https://hooks.slack.com/services/TEAM/CHANNEL/slack-credential', 'slack-credential'],
    ['sk_test_1234567890abcdefghijklmnop', 'sk_test_1234567890abcdefghijklmnop'],
    ['ghp_1234567890abcdefghijklmnopqrstuvwxyz', 'ghp_1234567890abcdefghijklmnopqrstuvwxyz'],
    ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123456', 'eyJhbGci'],
    ['-----BEGIN PRIVATE KEY-----\nprivate-material\n-----END PRIVATE KEY-----', 'private-material'],
    ['password%3Dencoded-credential', 'encoded-credential'],
    ['password%253Ddouble-encoded-credential', 'double-encoded-credential'],
    ['password%3Dpartial-encoded-credential%25', 'partial-encoded-credential'],
    [JSON.stringify({ nested: { api_key: 'json-credential' } }), 'json-credential'],
    ['aBcD0123456789aBcD0123456789aBcD0123456789aBcD0123456789', 'aBcD0123456789'],
  ];
  for (const [text, secret] of examples) {
    const safe = redactAuditData({ notes: text });
    assert.ok(!JSON.stringify(safe).includes(secret), text);
    assert.ok(JSON.stringify(safe).includes(hidden));
  }
  assert.equal(redactAuditData('https://cvsd.live/site/help?topic=links'), 'https://cvsd.live/site/help?topic=links');
});
test('known runtime/configuration credentials are hidden even under unrelated field names', () => {
  const secrets = auditSecretValues({ CLERK_SECRET_KEY: 'opaque-runtime-credential', DATABASE_URL: 'postgres://credential', title: 'safe' });
  assert.deepEqual(secrets, ['opaque-runtime-credential', 'postgres://credential']);
  const safe = redactAuditData({ message: 'Copied opaque-runtime-credential into a note', safe: 'safe' }, secrets);
  assert.equal(safe.message, 'Copied [REDACTED] into a note');
  assert.equal(safe.safe, 'safe');
});
test('cycles and excessive nesting fail closed while harmless dates and IDs remain useful', () => {
  const cycle = { id: 7 }; cycle.self = cycle;
  const safe = redactAuditData(cycle);
  assert.equal(safe.id, 7);
  assert.equal(safe.self, hidden);
  assert.equal(redactAuditData(new Date('2026-11-09T12:00:00Z')), '2026-11-09T12:00:00.000Z');
  let deep = { password: 'deep-credential' };
  for (let i = 0; i < 30; i++) deep = { nested: deep };
  assert.ok(!JSON.stringify(redactAuditData(deep)).includes('deep-credential'));
});
function actor() { return { username: 'Staff', email: 'staff@example.com', discordUsername: null, discordUserId: null, hasDiscordAccount: false, hasLoginAccount: true }; }
test('audit writer redacts database entries and Discord payloads before either is emitted', async () => {
  const inserts = [], deliveries = [];
  const audit = load('lib/audit.ts', {
    '@clerk/nextjs/server': {}, '@/lib/access': { getCachedUserInfo: () => actor() },
    '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async (parts, ...values) => {
      const query = parts.join('?');
      if (/INSERT INTO audit_logs/.test(query)) inserts.push(values);
      if (/SELECT setting_value/.test(query)) return [{ setting_value: 'https://discord.com/api/webhooks/1/delivery-credential' }];
      return [];
    } },
  }, { setInterval: () => 0, process: { env: { API_KEY: 'runtime-unprefixed-credential' } }, fetch: async (_url, request) => { deliveries.push(JSON.parse(request.body)); return { ok: true }; } });
  await audit.logAuditEvent({ action: 'Link updated', actorUserId: 'user_staff', details: 'Destination https://example.com?token=url-credential', metadata: { password: 'field-credential', note: 'runtime-unprefixed-credential' } });
  assert.equal(inserts.length, 1);
  assert.equal(deliveries.length, 1);
  for (const secret of ['url-credential', 'field-credential', 'runtime-unprefixed-credential']) {
    assert.ok(!JSON.stringify(inserts).includes(secret));
    assert.ok(!JSON.stringify(deliveries).includes(secret));
  }
  assert.ok(JSON.stringify(inserts).includes(hidden));
});
test('activity API redacts old rows before sending them to the browser without changing stored rows', async () => {
  const old = { id: 1, action: 'Updated', details: 'token=old-details-credential', actor_user_id: 'user_staff', actor_username: 'Staff', actor_email: 'staff@example.com', actor_discord_username: null, actor_has_discord_account: false, actor_has_login_account: true, actor_ip_address: '192.168.1.2', actor_user_agent: 'Bearer agent-credential', metadata: { nested: [{ privateKey: 'old-key-credential' }], settingKey: 'API_KEY', previousValue: 'old-setting-credential', newValue: 'new-setting-credential' }, source: 'settings', created_at: '2026-11-09T12:00:00Z', severity: 'info', category: 'settings' };
  const route = load('app/api/admin/settings/route.ts', {
    '@clerk/nextjs/server': { auth: async () => ({ userId: 'staff' }) },
    '@/lib/access': { isAllowedUser: async () => true, getAccessProfile: async () => ({ admin: true }), canEditDiscordWebhook: () => false },
    '@/lib/audit': { ensureAuditSchema: async () => {}, resolveAuditActorInfo: async () => actor() },
    '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async parts => parts.join('').includes('FROM audit_logs') ? [old] : [] },
  }, { process: { env: {} } });
  const response = await route.GET();
  const body = await response.json();
  const logs = JSON.stringify(body.auditLogs);
  for (const secret of ['old-details-credential', 'agent-credential', 'old-key-credential', 'old-setting-credential', 'new-setting-credential']) assert.ok(!logs.includes(secret));
  assert.equal(body.auditLogs[0].actor_ip_address, '192.168.x.x');
  assert.equal(body.auditLogs[0].actor_user_id, 'user_staff');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(old.metadata.newValue, 'new-setting-credential');
});
