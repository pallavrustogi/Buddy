import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactUrl } from '../src/lib/redact.js';

test('redactUrl strips userinfo', () => {
  const r = redactUrl('https://user:pass@example.com/path');
  assert.equal(r.redacted, true);
  assert.ok(!r.url.includes('user:pass'));
  assert.ok(r.warnings.some((w) => /userinfo/i.test(w)));
});

test('redactUrl redacts sensitive query params', () => {
  const r = redactUrl('https://api.example.com/x?token=abc123&safe=ok');
  assert.equal(r.redacted, true);
  assert.ok(r.url.includes('token=REDACTED'));
  assert.ok(r.url.includes('safe=ok'));
});

test('redactUrl handles api_key, password, secret variants', () => {
  for (const key of ['api_key', 'password', 'client_secret', 'sig', 'access_token']) {
    const r = redactUrl(`https://example.com/?${key}=SECRETVALUE`);
    assert.equal(r.redacted, true, `should redact ${key}`);
    assert.ok(!r.url.includes('SECRETVALUE'), `should not leak ${key} value`);
  }
});

test('redactUrl redacts OAuth-style hash fragments', () => {
  const r = redactUrl('https://example.com/cb#access_token=xyz&token_type=bearer');
  assert.equal(r.redacted, true);
  assert.ok(r.url.includes('#REDACTED'));
});

test('redactUrl leaves clean URLs alone', () => {
  const r = redactUrl('https://example.com/docs/page');
  assert.equal(r.redacted, false);
  assert.equal(r.url, 'https://example.com/docs/page');
});

test('redactUrl handles invalid URLs gracefully', () => {
  const r = redactUrl('not a url');
  assert.equal(r.redacted, false);
  assert.equal(r.url, 'not a url');
  assert.ok(r.warnings.length > 0);
});
