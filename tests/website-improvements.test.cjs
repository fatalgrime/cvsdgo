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
    throw new Error('Unexpected dependency: ' + name);
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
const announcements = load('lib/announcement-types.ts');
const input = { title: 'An update', message: 'Details', tone: 'info', audience: 'everyone', published: true, dismissible: true };
const start = '2026-11-10T09:00:00-07:00';
const end = '2026-11-10T10:00:00-07:00';
test('announcement schedule validates zones, dates, order, and exact visibility boundaries', () => {
  const parsed = announcements.parseAnnouncement({ ...input, starts_at: start, expires_at: end });
  assert.equal(parsed.starts_at, '2026-11-10T16:00:00.000Z');
  assert.equal(parsed.expires_at, '2026-11-10T17:00:00.000Z');
  const item = { ...parsed, id: '1', revision: 1 };
  for (const [now, visible, status] of [[Date.parse(start)-1, false, 'Scheduled'], [Date.parse(start), true, 'Published'], [Date.parse(end)-1, true, 'Published'], [Date.parse(end), false, 'Expired']]) {
    assert.equal(announcements.isAnnouncementVisible(item, [], now), visible);
    assert.equal(announcements.announcementStatus(item, now), status);
  }
  assert.equal(announcements.isAnnouncementVisible({ ...item, published: false }, [], Date.parse(start)), false);
  assert.equal(announcements.isAnnouncementVisible(item, ['1:1'], Date.parse(start)), false);
  assert.equal(announcements.isAnnouncementVisible({ ...input, id: '2', revision: 1 }, [], Date.parse(start)), true);
  for (const dates of [
    { starts_at: end, expires_at: start }, { starts_at: start, expires_at: start },
    { starts_at: '2026-11-10T09:00' }, { expires_at: 'invalid' }, { starts_at: 123 },
    { starts_at: '2026-02-30T09:00:00Z' },
  ]) assert.equal(announcements.parseAnnouncement({ ...input, ...dates }), null);
});
test('schedule survives creation, editing, clearing and audit snapshots', async () => {
  for (const method of ['POST', 'PUT']) for (const dates of [{ starts_at: start, expires_at: end }, { starts_at: null, expires_at: null }]) {
    const saved = { ...input, ...dates, id: '1', revision: 2 };
    const queries = [];
    const audit = [];
    const route = load('app/api/admin/announcements/route.ts', {
      '@clerk/nextjs/server': { auth: async () => ({ userId: 'admin' }) },
      '@/lib/access': { requireAdminUser: async () => null },
      '@/lib/audit': { getRequestContext: () => ({}), logAuditEvent: async entry => audit.push(entry) },
      '@/lib/db': { hasDatabaseUrl: () => true, getSql: () => async (parts, ...values) => { queries.push({ query: parts.join('?'), values }); return [saved]; } },
      '@/lib/announcements': { ensureAnnouncementSchema: async () => {} },
      '@/lib/announcement-types': announcements,
    });
    assert.ok((await route[method](new Request('https://example.com', { method, body: JSON.stringify(saved) }))).ok);
    assert.match(queries[0].query, /starts_at/);
    assert.match(queries[0].query, /expires_at/);
    if (dates.starts_at) {
      assert.ok(queries[0].values.includes('2026-11-10T16:00:00.000Z'));
      assert.ok(queries[0].values.includes('2026-11-10T17:00:00.000Z'));
    } else assert.ok(queries[0].values.filter(value => value === null).length >= 2);
    assert.equal(audit[0].metadata.announcement.expires_at, saved.expires_at);
  }
});
test('clipboard errors and missing APIs return a manual-copy result without throwing', async () => {
  let text;
  const success = load('lib/copy-text.ts', {}, { navigator: { clipboard: { writeText: async value => { text = value; } } } });
  assert.equal(await success.tryCopyText('https://go.cvsd.live/help'), true);
  assert.equal(text, 'https://go.cvsd.live/help');
  for (const navigator of [{}, { clipboard: { writeText: async () => { throw new Error('Denied'); } } }]) {
    assert.equal(await load('lib/copy-text.ts', {}, { navigator }).tryCopyText('test'), false);
  }
});
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}
const drafts = load('lib/editor-drafts.ts');
const validate = value => Boolean(value && typeof value.text === 'string');
test('draft storage handles corruption, expiry, validation, and storage denial', () => {
  const store = storage();
  assert.equal(drafts.writeEditorDraft(store, 'draft', { text: 'Unfinished work' }), true);
  assert.deepEqual(drafts.readEditorDraft(store, 'draft', validate), { text: 'Unfinished work' });
  for (const value of ['{', JSON.stringify({ version: 1, savedAt: 0, value: { text: 'Old' } }), JSON.stringify({ version: 1, savedAt: Date.now(), value: {} })]) {
    store.setItem('draft', value);
    assert.equal(drafts.readEditorDraft(store, 'draft', validate), null);
  }
  assert.equal(drafts.writeEditorDraft({ setItem() { throw new Error('Blocked'); } }, 'draft', {}), false);
});
// Exercise hooks across renders and remounts, without an auth account or browser storage.
function hooks() {
  const slots = [];
  let cursor = 0, changed = false, queued = [], output;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; changed = true; } }];
    },
    useRef(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) queued.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
    },
  };
  return { react, run(render) { let runs = 0; do { changed = false; cursor = 0; queued = []; output = render(); queued.forEach(fn => fn()); assert.ok(++runs < 20, 'hook effects converge'); } while (changed); return output; }, unmount() { slots.forEach(slot => slot?.cleanup?.()); } };
}
test('draft recovery survives remounts, is scoped to the editor/user, and clears after saving', () => {
  const store = storage();
  let userId = 'staff-a';
  function mount() {
    const runtime = hooks();
    const api = load('components/use-editor-draft.ts', { react: runtime.react, '@clerk/nextjs': { useAuth: () => ({ userId }) }, '@/lib/editor-drafts': drafts }, { sessionStorage: store });
    return { runtime, api };
  }
  let { runtime, api } = mount();
  let props = { name: 'policy:terms', value: { text: 'Original' }, dirty: false, validate };
  runtime.run(() => api.useEditorDraft(props));
  props = { ...props, value: { text: 'Unfinished edits' }, dirty: true };
  runtime.run(() => api.useEditorDraft(props));
  runtime.unmount();
  ({ runtime, api } = mount());
  props = { ...props, value: { text: 'Original' }, dirty: false };
  let result = runtime.run(() => api.useEditorDraft(props));
  assert.deepEqual(result.recovered, { text: 'Unfinished edits' });
  // New typing must not overwrite a recovery the editor has not accepted yet.
  props = { ...props, value: { text: 'Other typing' }, dirty: true };
  runtime.run(() => api.useEditorDraft(props));
  assert.deepEqual(drafts.readEditorDraft(store, 'cvsdgo:draft:staff-a:policy:terms', validate), { text: 'Unfinished edits' });
  userId = 'staff-b';
  props = { ...props, dirty: false };
  result = runtime.run(() => api.useEditorDraft(props));
  assert.equal(result.recovered, null);
  userId = 'staff-a';
  result = runtime.run(() => api.useEditorDraft(props));
  assert.deepEqual(result.recovered, { text: 'Unfinished edits' });
  result.clear();
  result = runtime.run(() => api.useEditorDraft(props));
  assert.equal(result.recovered, null);
  assert.equal(store.values.size, 0);
});
function events() {
  const handlers = new Map();
  return { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name), emit: (name, event) => handlers.get(name)?.(event), handlers };
}
test('dirty editors warn on refresh and can cancel navigation without affecting clean editors', () => {
  const runtime = hooks(), window = events(), document = events();
  let prompts = 0;
  window.confirm = () => { prompts++; return false; };
  class Element { closest() { return this.anchor; } }
  const api = load('components/use-editor-draft.ts', { react: runtime.react, '@clerk/nextjs': {}, '@/lib/editor-drafts': drafts }, { window, document, Element, location: { origin: 'https://go.cvsd.live', pathname: '/current', search: '' } });
  let dirty = true;
  runtime.run(() => api.useUnsavedChanges(dirty));
  let prevented = false, stopped = false;
  window.emit('beforeunload', { preventDefault() { prevented = true; } });
  assert.ok(prevented);
  const target = new Element();
  target.anchor = { protocol: 'https:', target: '', hasAttribute: () => false, href: 'https://go.cvsd.live/elsewhere' };
  prevented = false;
  document.emit('click', { target, button: 0, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  assert.ok(prevented && stopped);
  assert.equal(prompts, 1);
  dirty = false;
  runtime.run(() => api.useUnsavedChanges(dirty));
  assert.equal(document.handlers.size, 0);
  assert.equal(window.handlers.size, 0);
});

function dialogFixture() {
  const document = { ...events(), activeElement: null };
  class Element {
    constructor(name, tabIndex = -1) { this.name = name; this.tabIndex = tabIndex; this.children = []; this.inert = false; this.isConnected = true; this.style = {}; this.visible = true; this.disabled = false; this.hidden = false; this.attributes = new Set(); }
    append(child) { this.children.push(child); child.parentElement = this; return child; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll()]); }
    matches() { return this.disabled; }
    hasAttribute(name) { return this.attributes.has(name); }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.inert || (selector.includes('hidden') && node.hidden)) return node; return null; }
    getClientRects() { return this.visible ? [{}] : []; }
    focus() { if (this.closest('[inert]')) return; document.activeElement = this; document.emit('focusin', { target: this }); }
  }
  document.body = new Element('body');
  document.body.style.overflow = 'auto';
  const background = document.body.append(new Element('background'));
  const trigger = background.append(new Element('trigger', 0));
  const parentRoot = document.body.append(new Element('parent-root'));
  const parent = parentRoot.append(new Element('parent'));
  const first = parent.append(new Element('first', 0));
  const hidden = parent.append(new Element('hidden', 0)); hidden.visible = false;
  const disabled = parent.append(new Element('disabled', 0)); disabled.disabled = true;
  const last = parent.append(new Element('last', 0));
  const childRoot = document.body.append(new Element('child-root'));
  const child = childRoot.append(new Element('child'));
  const childButton = child.append(new Element('child-button', 0));
  const stack = load('lib/dialog-stack.ts', {}, { document, HTMLElement: Element, Node: Element, getComputedStyle: () => ({ visibility: 'visible' }) });
  function key(key, shiftKey = false, defaultPrevented = false) {
    const event = { key, shiftKey, defaultPrevented, preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {} };
    document.emit('keydown', event);
    return event;
  }
  trigger.focus();
  return { document, stack, background, trigger, parent, first, last, child, childButton, key };
}
test('only the top dialog handles Escape and focus returns through nested dialogs', () => {
  const f = dialogFixture();
  let parentCloses = 0, childCloses = 0;
  let closeParent, closeChild;
  closeParent = f.stack.registerDialog(f.parent, () => { parentCloses++; closeParent(); });
  assert.equal(f.document.activeElement, f.first);
  assert.equal(f.background.inert, true);
  f.last.focus();
  closeChild = f.stack.registerDialog(f.child, () => { childCloses++; closeChild(); });
  assert.equal(f.parent.closest('[inert]') !== null, true);
  assert.equal(f.document.activeElement, f.childButton);
  f.key('Escape');
  assert.equal(childCloses, 1);
  assert.equal(parentCloses, 0);
  assert.equal(f.document.activeElement, f.last);
  f.key('Escape');
  assert.equal(parentCloses, 1);
  assert.equal(f.document.activeElement, f.trigger);
  assert.equal(f.background.inert, false);
  assert.equal(f.document.body.style.overflow, 'auto');
  assert.equal(f.document.handlers.size, 0);
});
test('dialog Tab ignores hidden/disabled controls and redirects escaped focus', () => {
  const f = dialogFixture();
  const close = f.stack.registerDialog(f.parent, () => {});
  f.key('Tab', true);
  assert.equal(f.document.activeElement, f.last);
  f.key('Tab');
  assert.equal(f.document.activeElement, f.first);
  // A script moving focus outside the modal must not escape the active panel.
  f.document.activeElement = f.trigger;
  f.document.emit('focusin', { target: f.trigger });
  assert.equal(f.document.activeElement, f.first);
  close();
});
test('handled Escape is not applied twice and removing a parent preserves the child focus trap', () => {
  const f = dialogFixture();
  let closes = 0;
  const closeParent = f.stack.registerDialog(f.parent, () => { closes++; });
  f.key('Escape', false, true);
  assert.equal(closes, 0);
  const closeChild = f.stack.registerDialog(f.child, () => {});
  closeParent();
  assert.equal(f.document.body.style.overflow, 'hidden');
  assert.equal(f.stack.isTopDialog(f.child), true);
  closeChild();
  assert.equal(f.document.activeElement, f.trigger);
  assert.equal(f.document.body.style.overflow, 'auto');
});


test('reverting all edits removes a stale recovery without erasing an unread draft on mount', () => {
  const runtime = hooks(), store = storage();
  const api = load('components/use-editor-draft.ts', { react: runtime.react, '@clerk/nextjs': { useAuth: () => ({ userId: 'staff' }) }, '@/lib/editor-drafts': drafts }, { sessionStorage: store });
  let props = { name: 'announcement', value: { text: 'Original' }, dirty: false, validate };
  runtime.run(() => api.useEditorDraft(props));
  props = { ...props, value: { text: 'Changed' }, dirty: true };
  runtime.run(() => api.useEditorDraft(props));
  assert.equal(store.values.size, 1);
  props = { ...props, value: { text: 'Original' }, dirty: false };
  runtime.run(() => api.useEditorDraft(props));
  assert.equal(store.values.size, 0);
});
test('copy feedback offers the manual dialog only on failure and announces successful copies', async () => {
  let permitted = false;
  const runtime = hooks();
  const api = load('components/copy-link-feedback.tsx', {
    react: { ...runtime.react, useId: () => 'copy-test' },
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/components/accessible-dialog': {},
    '@/lib/copy-text': { tryCopyText: async () => permitted },
  });
  let result = runtime.run(api.useCopyLink);
  await result.copyLink('help');
  result = runtime.run(api.useCopyLink);
  assert.equal(result.manualLink, 'https://go.cvsd.live/help');
  assert.equal(result.copiedSlug, null);
  permitted = true;
  await result.copyLink('support');
  result = runtime.run(api.useCopyLink);
  assert.equal(result.manualLink, null);
  assert.equal(result.copiedSlug, 'support');
  assert.match(result.message, /Copied https:\/\/go.cvsd.live\/support/);
  runtime.unmount();
});
test('an open announcement banner removes expired notices without waiting for a network refresh', () => {
  let now = Date.parse(start);
  const runtime = hooks();
  const timers = new Map();
  let nextTimer = 0;
  const document = { ...events(), visibilityState: 'visible' };
  const window = { ...events(), setInterval: () => 100 };
  class ClockDate extends Date { static now() { return now; } }
  const { AnnouncementBanner } = load('components/announcement-banner.tsx', {
    react: runtime.react,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@/lib/announcement-types': announcements,
  }, { Date: ClockDate, document, window, localStorage: storage(), fetch: async () => ({ ok: false }), clearInterval: () => {}, setTimeout: (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) });
  const initial = [{ ...input, id: '1', revision: 1, starts_at: start, expires_at: end }];
  assert.ok(runtime.run(() => AnnouncementBanner({ initial })));
  // Advance directly to the end; background tabs may throttle timers.
  now = Date.parse(end);
  Array.from(timers.values())[0].fn();
  assert.equal(runtime.run(() => AnnouncementBanner({ initial })), null);
  runtime.unmount();
});


test('dialog returns focus to the captured trigger even when its input auto-focused before registration', () => {
  const f = dialogFixture();
  f.first.focus();
  const close = f.stack.registerDialog(f.parent, () => {}, f.trigger);
  close();
  assert.equal(f.document.activeElement, f.trigger);
});
