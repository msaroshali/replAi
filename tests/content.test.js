const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'content', 'content.js'),
  'utf8'
);

test('toolbar placement anchors SmartReply immediately before Gmail formatting', () => {
  assert.match(source, /\[command=\\?"\+formatting\\?"\]/);
  assert.match(source, /formattingButton\?\.closest\('td'\)/);
  assert.match(source, /row\.insertBefore\(cell, formattingCell\)/);
});

test('toolbar placement no longer uses the broad legacy cell selector', () => {
  assert.doesNotMatch(source, /td\.oc\.gU, td\.a8X\.gU/);
});

test('storage access is guarded when Gmail retains a stale extension context', () => {
  assert.match(source, /globalThis\.chrome\?\.storage\?\.local/);
  assert.match(source, /if \(!localStorage\?\.get\)/);
  assert.doesNotMatch(source, /chrome\.storage\.local\.get/);
  assert.match(source, /Refresh Gmail and try again/);
});

test('runtime messaging fails gracefully after an extension reload', () => {
  assert.match(source, /if \(!runtime\?\.sendMessage\)/);
  assert.match(source, /try \{\s*runtime\.sendMessage/s);
  assert.match(source, /catch \(error\) \{/);
});
