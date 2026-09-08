import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Isolated UI regression fixtures. No real session, credential, network request,
// or model invocation is used by this suite. Live RLS is verified separately.
const source = readFileSync(new URL('../qwen/qwen.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/, '')
  .replace(/boot\(\);\s*$/, '');

class Element {
  constructor(id = '') {
    this.id = id;
    this.className = id === 'consoleState' ? 'phase-badge wait' : '';
    this.textContent = '';
    this.value = '';
    this.children = [];
    this.hidden = false;
    this.disabled = false;
    this.scrollHeight = 400;
    this.scrollTop = 0;
    this.clientHeight = 250;
    this.renders = 0;
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  replaceChildren(...children) { this.children = children; this.renders++; }
  addEventListener() {}
  matches(selector) {
    return selector.split(',').some(s => this.className.split(' ').includes(s.trim().slice(1)));
  }
}

function fixture(overrides = {}) {
  const elements = new Map();
  const calls = [];
  const owner = { user: { id: 'test-owner' } };
  const results = {
    qwen_instances: { data: { id: 'polymarket-qwen' }, error: null },
    qwen_messages: { data: [{ id: 'reply', sender_type: 'qwen', body: 'Saved reply', status: 'completed', created_at: '2026-09-08T01:24:32Z' }], error: null },
    qwen_events: { data: [], error: null },
    qwen_state: { data: null, error: null },
    ...overrides
  };
  const client = {
    from(table) {
      calls.push({ table });
      const request = {};
      for (const method of ['select', 'eq', 'order', 'limit', 'lt']) {
        request[method] = (...args) => { calls.push({ table, method, args }); return request; };
      }
      const result = () => typeof results[table] === 'function' ? results[table]() : results[table];
      // Like PostgrestBuilder, requests are PromiseLike (then, not catch).
      request.maybeSingle = () => request;
      request.then = (resolve, reject) => Promise.resolve(result()).then(resolve, reject);
      return request;
    },
    rpc: async (...args) => { calls.push({ rpc: args }); return { data: { ok: true }, error: null }; },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => {}
  };
  const context = vm.createContext({
    document: {
      getElementById(id) { if (!elements.has(id)) elements.set(id, new Element(id)); return elements.get(id); },
      createElement: () => new Element()
    },
    Date, Intl, setTimeout, setInterval,
    client
  });
  vm.runInContext(source + '\nsupabase = client; globalThis.api = { setSession, resolveAccess, loadMessages, refreshAll, sendMessage, renderMessages, state: () => ({ canControl, accessState }) };', context);
  return { api: context.api, elements, client, calls, results, owner };
}

async function signedIn(overrides) {
  const f = fixture(overrides);
  f.api.setSession(f.owner);
  await f.api.resolveAccess();
  return f;
}

test('hidden auth sections stay hidden; chat is the first panel on mobile and desktop', () => {
  const css = readFileSync(new URL('../qwen/qwen.css', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../qwen/index.html', import.meta.url), 'utf8');
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.ok(html.indexOf('id="console-title"') < html.indexOf('id="connections-title"'));
  assert.equal((html.match(/id="console-title"/g) || []).length, 1);
  assert.doesNotMatch(html, /class="hero-orbit"/);
  assert.match(css, /\.composer textarea\s*\{[^}]*font-size: 16px/s);
});

test('existing owner sign-in exposes chat and saved reply, not the sign-in gate', async () => {
  const f = await signedIn();
  await f.api.loadMessages();
  assert.equal(f.api.state().canControl, true);
  assert.equal(f.elements.get('authGate').hidden, true);
  assert.equal(f.elements.get('chatArea').hidden, false);
  assert.equal(f.elements.get('sendButton').disabled, false);
  assert.equal(f.elements.get('consoleState').textContent, 'Connected');
  assert.equal(f.elements.get('chatLog').children[0].children[1].textContent, 'Saved reply');
});

test('signed-in visitors are observers and cannot send', async () => {
  const f = await signedIn({ qwen_instances: { data: null, error: null } });
  assert.equal(f.api.state().canControl, false);
  assert.equal(f.elements.get('consoleState').textContent, 'Observer access');
  assert.equal(f.elements.get('chatArea').hidden, true);
  f.elements.get('messageInput').value = 'blocked';
  await f.api.sendMessage({ preventDefault() {} });
  assert.equal(f.calls.filter(c => c.rpc).length, 0);
});

test('guest sees sign-in; a failed access check does not falsely sign out the owner', async () => {
  const f = fixture();
  await f.api.resolveAccess();
  assert.equal(f.elements.get('consoleState').textContent, 'Sign-in required');
  assert.equal(f.elements.get('sendButton').disabled, true);
  f.results.qwen_instances = { data: null, error: { message: 'permission test' } };
  f.api.setSession(f.owner);
  await f.api.resolveAccess();
  assert.equal(f.elements.get('authLink').textContent, 'Account');
  assert.equal(f.elements.get('consoleState').textContent, 'Access check failed');
});

test('late owner access results cannot reopen chat after sign-out', async () => {
  const f = fixture();
  let finish;
  f.results.qwen_instances = () => new Promise(resolve => { finish = resolve; });
  f.api.setSession(f.owner);
  const pending = f.api.resolveAccess();
  await Promise.resolve();
  f.api.setSession(null);
  finish({ data: { id: 'polymarket-qwen' }, error: null });
  await pending;
  assert.equal(f.api.state().canControl, false);
  assert.equal(f.elements.get('chatArea').hidden, true);
});

test('late message responses are discarded after account switching', async () => {
  const f = await signedIn();
  let finish;
  f.results.qwen_messages = () => new Promise(resolve => { finish = resolve; });
  const pending = f.api.loadMessages();
  await Promise.resolve();
  f.api.setSession(null);
  finish({ data: [{ body: 'Must not appear' }], error: null });
  await pending;
  assert.equal(f.elements.get('chatLog').children.length, 0);
});

test('history failure stays in chat and does not mark the public state store unavailable', async () => {
  const f = await signedIn({ qwen_messages: { data: null, error: { message: 'permission test' } } });
  f.elements.get('connectionNote').textContent = 'Public state healthy';
  await f.api.refreshAll();
  assert.equal(f.elements.get('connectionNote').textContent, 'Public state healthy');
  assert.equal(f.elements.get('consoleState').textContent, 'History unavailable');
  assert.equal(f.elements.get('authGate').hidden, true);
});

test('accepted send remains accepted if history refresh fails; Send is re-enabled', async () => {
  const f = await signedIn({ qwen_messages: { data: null, error: { message: 'permission test' } } });
  f.elements.get('messageInput').value = 'A test message';
  await f.api.sendMessage({ preventDefault() {} });
  assert.equal(f.elements.get('messageInput').value, '');
  assert.equal(f.elements.get('sendButton').disabled, false);
  assert.equal(f.calls.filter(c => c.rpc).length, 1);
  assert.match(f.elements.get('composerNote').textContent, /Queued/);
});

test('failed delivery preserves the draft and re-enables Send', async () => {
  const f = await signedIn();
  f.client.rpc = async () => { throw new Error('network test'); };
  f.elements.get('messageInput').value = 'Keep my draft';
  await f.api.sendMessage({ preventDefault() {} });
  assert.equal(f.elements.get('messageInput').value, 'Keep my draft');
  assert.equal(f.elements.get('sendButton').disabled, false);
  assert.match(f.elements.get('composerNote').textContent, /Could not confirm delivery/);
});

test('history loads the latest messages and unchanged polling preserves the reading position', async () => {
  const f = await signedIn();
  await f.api.loadMessages();
  const log = f.elements.get('chatLog');
  log.scrollTop = 12;
  const renders = log.renders;
  await f.api.loadMessages();
  assert.equal(log.renders, renders);
  assert.equal(log.scrollTop, 12);
  assert.equal(f.calls.find(c => c.table === 'qwen_messages' && c.method === 'order').args[1].ascending, false);
});
