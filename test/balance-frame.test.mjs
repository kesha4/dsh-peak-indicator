import test from 'node:test';
import assert from 'node:assert/strict';
import {createBalanceStore} from '../lib/balance.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const wallet = (balance, currency = 'CNY') => ({ balance, currency });
const ready = (value = [], bonusWallets = []) => ({ status: 'ready', value, bonusWallets });

/** One controlled account stream yielding the given raw RemoteStream items. */
function fixture(items) {
  let wake;
  const stream = {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
      await new Promise((resolve) => { wake = resolve; });
    },
    dispose() { wake?.(); },
  };
  const remote = {
    $stream: () => stream,
    account: {
      getBalance: async () => ({ ok: true, value: ready([wallet('12.34')], [wallet('0.01')]) }),
    },
  };
  const store = createBalanceStore();
  const stop = store.connect(remote, () => ({ version: '0.2.2-rc.5', locale: 'ru', timezoneOffsetSeconds: 10800 }));
  return { store, stop };
}

const item = (value) => ({ value, accept() {} });

test('accepts the DSH 0.2.2-rc.5 wrapped snapshot item', async () => {
  const f = fixture([item({ type: 'snapshot', state: { status: 'credential-stored', attempt: null, links: {} } })]);
  try {
    await tick(); await tick();
    assert.equal(f.store.getSnapshot().status, 'ready');
    assert.equal(f.store.getSnapshot().total, '¥12.35');
  } finally { f.stop(); f.store.dispose(); }
});

test('accepts the DSH 0.2.2-rc.5 credentials-changed item', async () => {
  const f = fixture([item({ type: 'credentials-changed', state: { status: 'credential-stored', attempt: null, links: {} } })]);
  try {
    await tick(); await tick();
    assert.equal(f.store.getSnapshot().status, 'ready');
    assert.equal(f.store.getSnapshot().total, '¥12.35');
  } finally { f.stop(); f.store.dispose(); }
});

test('still accepts the legacy bare account state item', async () => {
  const f = fixture([item({ status: 'credential-stored' })]);
  try {
    await tick(); await tick();
    assert.equal(f.store.getSnapshot().status, 'ready');
  } finally { f.stop(); f.store.dispose(); }
});

test('a wrapped signed-out state still renders signed-out', async () => {
  const f = fixture([item({ type: 'snapshot', state: { status: 'signed-out', attempt: null, links: {} } })]);
  try {
    await tick(); await tick();
    assert.equal(f.store.getSnapshot().status, 'signed-out');
  } finally { f.stop(); f.store.dispose(); }
});
