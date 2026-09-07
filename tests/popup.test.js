const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const popupHtml = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.html'), 'utf8');
const popupCss = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.css'), 'utf8');
const popupJs = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.js'), 'utf8');

test('popup.html defines accessible dialog roles and titles on both drawers', () => {
  assert.match(popupHtml, /id="settingsPanel"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="settingsDrawerTitle"/);
  assert.match(popupHtml, /<h2 id="settingsDrawerTitle">Preferences &amp; Models<\/h2>/);

  assert.match(popupHtml, /id="helpPanel"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="helpDrawerTitle"/);
  assert.match(popupHtml, /<h2 id="helpDrawerTitle">How to Use bunnyReplai<\/h2>/);
});

test('popup.html includes persistent debug warning banner and two-tier debug settings', () => {
  assert.match(popupHtml, /id="debugWarningBanner"[^>]*class="debug-warning-banner"/);
  assert.match(popupHtml, /id="debugMode"/);
  assert.match(popupHtml, /id="debugFullContent"/);
});

test('popup.css removes obsolete selectors and applies rotation only to settings gear', () => {
  assert.doesNotMatch(popupCss, /\.advanced-section/);
  assert.match(popupCss, /#toggleSettingsBtn:hover\s*\{\s*transform:\s*rotate\(25deg\);/);
});

function createMockElement(id = '', tag = 'div', type = '') {
  return {
    id,
    tagName: tag.toUpperCase(),
    type,
    value: '',
    checked: false,
    open: false,
    hidden: false,
    disabled: false,
    textContent: '',
    className: '',
    classList: {
      classes: new Set(),
      add(cls) { this.classes.add(cls); },
      remove(cls) { this.classes.delete(cls); },
      contains(cls) { return this.classes.has(cls); }
    },
    attributes: {},
    setAttribute(name, val) { this.attributes[name] = String(val); },
    getAttribute(name) { return this.attributes[name]; },
    listeners: {},
    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    dispatchEvent(event) {
      const fns = this.listeners[event.type || event] || [];
      fns.forEach((fn) => fn(event));
    },
    focus() {
      if (globalThis.__mockActiveElementTracker) {
        globalThis.__mockActiveElementTracker.current = this;
      }
    }
  };
}

function loadPopupEnvironment(initialStorage = {}, apiResponse = { success: true, workingModel: 'gemini-3.5-flash-lite' }) {
  const storage = { ...initialStorage };
  const elements = {};
  const elementIds = [
    'apiKey', 'toggleKeyVisibility', 'testKeyBtn', 'testResult', 'keyDetails', 'keySummaryText', 'keyState',
    'defaultTone', 'defaultLength', 'userName', 'selectedModel', 'useEmoji', 'privacyConsentAccepted',
    'privacyDetails', 'privacySummaryText', 'privacyState', 'colorTheme', 'appearanceMode', 'debugMode',
    'debugFullContent', 'debugSubOptions', 'debugWarningBanner', 'toggleSettingsBtn', 'closeSettingsBtn',
    'settingsPanel', 'toggleHelpBtn', 'closeHelpBtn', 'openHelpLink',
    'helpPanel', 'saveBtn', 'statusBadge', 'statusText', 'lastModelText', 'toast'
  ];

  elementIds.forEach((id) => {
    elements[id] = createMockElement(id);
  });

  const docListeners = {};
  const activeTracker = { current: null };
  globalThis.__mockActiveElementTracker = activeTracker;

  const mockDocument = {
    activeElement: null,
    documentElement: { dataset: {} },
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener(event, fn) {
      if (!docListeners[event]) docListeners[event] = [];
      docListeners[event].push(fn);
    },
    dispatchEvent(event) {
      const fns = docListeners[event.type || event] || [];
      fns.forEach((fn) => fn(event));
    }
  };

  Object.defineProperty(mockDocument, 'activeElement', {
    get() { return activeTracker.current; },
    set(val) { activeTracker.current = val; }
  });

  const mockWindow = {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    clearTimeout() {},
    setTimeout(fn) { return 1; }
  };

  const mockChrome = {
    runtime: {
      sendMessage(msg, callback) {
        if (msg.action === 'TEST_API_KEY') {
          callback(apiResponse);
        }
      }
    },
    storage: {
      local: {
        get(keys, callback) {
          const result = Object.fromEntries(keys.map((k) => [k, storage[k]]));
          if (callback) callback(result);
          return Promise.resolve(result);
        },
        set(values, callback) {
          Object.assign(storage, values);
          if (callback) callback();
          return Promise.resolve(values);
        }
      }
    }
  };

  const sandbox = {
    document: mockDocument,
    window: mockWindow,
    chrome: mockChrome,
    console: { log() {}, error() {}, warn() {} },
    Set,
    Boolean,
    String,
    Date,
    Object,
    Array
  };

  vm.createContext(sandbox);
  vm.runInContext(popupJs, sandbox);

  mockDocument.dispatchEvent({ type: 'DOMContentLoaded' });

  return { elements, storage, mockDocument, activeTracker };
}

test('drawer open/close and keyboard Escape focus restoration', () => {
  const { elements, mockDocument, activeTracker } = loadPopupEnvironment();

  activeTracker.current = elements.toggleSettingsBtn;

  elements.toggleSettingsBtn.dispatchEvent({ type: 'click' });
  assert.equal(elements.settingsPanel.classList.contains('open'), true);
  assert.equal(elements.settingsPanel.getAttribute('aria-hidden'), 'false');
  assert.equal(activeTracker.current, elements.closeSettingsBtn);

  mockDocument.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
  assert.equal(elements.settingsPanel.classList.contains('open'), false);
  assert.equal(elements.settingsPanel.getAttribute('aria-hidden'), 'true');
  assert.equal(activeTracker.current, elements.toggleSettingsBtn);
});

test('auto-saving drawer controls persists changes immediately', () => {
  const { elements, storage } = loadPopupEnvironment();

  elements.colorTheme.value = 'rose';
  elements.colorTheme.dispatchEvent({ type: 'change' });
  assert.equal(storage.colorTheme, 'rose');

  elements.selectedModel.value = 'gemini-3.7-flash';
  elements.selectedModel.dispatchEvent({ type: 'change' });
  assert.equal(storage.selectedModel, 'gemini-3.7-flash');

  elements.debugMode.checked = true;
  elements.debugMode.dispatchEvent({ type: 'change' });
  assert.equal(storage.debugMode, true);
  assert.equal(elements.debugSubOptions.hidden, false);
  assert.equal(elements.debugWarningBanner.hidden, false);
});

test('auto-save key immediately upon successful verification', () => {
  const { elements, storage } = loadPopupEnvironment({}, { success: true, workingModel: 'gemini-3.5-flash-lite' });

  elements.apiKey.value = 'AIzaSyAABBCCDDEEFFGGHHIIJJKKLLMMNN';
  elements.testKeyBtn.dispatchEvent({ type: 'click' });

  assert.equal(storage.geminiApiKey, 'AIzaSyAABBCCDDEEFFGGHHIIJJKKLLMMNN');
  assert.equal(storage.apiKeyVerified, true);
  assert.equal(storage.verifiedModel, 'gemini-3.5-flash-lite');
  assert.equal(elements.keyDetails.open, false);
});