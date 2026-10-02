const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../servidor/usb.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
function run(response, hidden = false) {
  const ids = ['usb-label', 'usb-title', 'usb-message', 'usb-action', 'usb-network', 'retry', 'signin', 'upgrade', 'freshness'];
  const elements = Object.fromEntries(ids.map(id => [id, {textContent: '', hidden: true, disabled: false, listeners: {}, addEventListener(type, callback) {this.listeners[type] = callback;}}]));
  const panel = {dataset: {}, classList: {add() {}, remove() {}}};
  const document = {hidden, listeners: {}, querySelector: () => panel, getElementById: id => elements[id], addEventListener(type, callback) {this.listeners[type] = callback;}};
  const requests = []; const timers = new Map(); let nextTimer = 0;
  const context = {document, window: {matchMedia: () => ({matches: false}), addEventListener() {}}, navigator: {onLine: true}, AbortController, Date, Object, Error, Number, clearTimeout(id) {timers.delete(id);}, setTimeout(callback, delay) {const id = ++nextTimer; timers.set(id, {callback, delay}); return id;}, requestAnimationFrame: callback => callback(), fetch(url, options) {requests.push({url, options}); return typeof response === 'function' ? response() : Promise.resolve(response);}};
  vm.runInNewContext(source, context);
  return {elements, panel, document, requests, timers};
}
const snapshot = extra => ({State: 'no_device', Connected: false, NetworkReady: false, NeedsPreparation: false, CanPrepare: false, Title: 'Sin móvil', Message: 'Conecta un cable de datos', Action: 'Volver a comprobar', CheckedUtc: new Date().toISOString(), ...extra});
test('no device is a real inspected state and uses same-origin credentials', async () => {
  const view = run({ok: true, status: 200, json: async () => snapshot()}); await settle();
  assert.equal(view.panel.dataset.state, 'no_device');
  assert.equal(view.requests[0].url, '/inhouse-manager/v1/usb');
  assert.equal(view.requests[0].options.credentials, 'same-origin');
  assert.equal(view.requests[0].options.redirect, 'error');
  assert.equal(view.elements['usb-action'].hidden, true);
  assert.ok([...view.timers.values()].some(item => item.delay === 2000));
});
test('MTP presence is not presented as an active USB transfer', async () => {
  const view = run({ok: true, status: 200, json: async () => snapshot({State: 'connected_needs_network', Connected: true, Title: 'Móvil conectado', Message: 'Activa Compartir conexión USB'})}); await settle();
  assert.equal(view.panel.dataset.state, 'connected_needs_network');
  assert.equal(view.elements['usb-network'].hidden, true);
  assert.equal(view.elements['usb-title'].textContent, 'Móvil conectado');
});
test('ready shows negotiated link capability, not invented measured speed', async () => {
  const view = run({ok: true, status: 200, json: async () => snapshot({State: 'ready', Connected: true, NetworkReady: true, LinkMbps: 480, Title: 'Red preparada'})}); await settle();
  assert.equal(view.panel.dataset.state, 'ready');
  assert.match(view.elements['usb-network'].textContent, /enlace de 480 Mbps/);
  assert.match(view.elements['usb-network'].textContent, /velocidad real se muestra/);
});
test('login and old manager get distinct actionable states', async () => {
  const login = run({ok: false, status: 401}); const old = run({ok: false, status: 404}); await settle();
  assert.equal(login.panel.dataset.state, 'login'); assert.equal(login.elements.signin.hidden, false);
  assert.equal(old.panel.dataset.state, 'unavailable'); assert.equal(old.elements.upgrade.hidden, false);
});
test('outage or stale data never masquerades as a disconnected phone', async () => {
  const outage = run(() => Promise.reject(new Error('offline')));
  const stale = run({ok: true, status: 200, json: async () => snapshot({State: 'ready', CheckedUtc: '2020-01-01T00:00:00Z'})}); await settle();
  assert.equal(outage.panel.dataset.state, 'unavailable'); assert.equal(stale.panel.dataset.state, 'unavailable');
  assert.match(outage.elements['usb-action'].textContent, /No significa que hayas desconectado/);
});
test('does not overlap requests or poll in a hidden page', async () => {
  let resolve; const view = run(() => new Promise(done => {resolve = done;}));
  view.elements.retry.listeners.click(); assert.equal(view.requests.length, 1);
  resolve({ok: true, status: 200, json: async () => snapshot()}); await settle();
  const background = run({ok: false, status: 503}, true); assert.equal(background.requests.length, 0);
});
test('server status strings use textContent instead of markup interpretation', async () => {
  const title = '<img src=x onerror=alert(1)>';
  const view = run({ok: true, status: 200, json: async () => snapshot({Title: title})}); await settle();
  assert.equal(view.elements['usb-title'].textContent, title);
  assert.equal(view.elements['usb-title'].innerHTML, undefined);
});
test('does not show green ready from malformed payloads', async () => {
  const view = run({ok: true, status: 200, json: async () => snapshot({State: 'ready', NetworkReady: 'yes'})}); await settle();
  assert.equal(view.panel.dataset.state, 'unavailable');
});
test('server-calculated age is used despite browser clock skew', async () => {
  const view = run({ok: true, status: 200, json: async () => snapshot({CheckedUtc: '2020-01-01T00:00:00Z', AgeSeconds: 2})}); await settle();
  assert.equal(view.panel.dataset.state, 'no_device');
});
