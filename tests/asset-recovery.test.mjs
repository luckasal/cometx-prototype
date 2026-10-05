import test from 'node:test';
import assert from 'node:assert/strict';
import { assetRecoveryUrl, isAssetLoadError } from '../src/lib/asset-recovery.ts';

test('detects Vite and browser dynamic chunk load failures', () => {
  assert.equal(isAssetLoadError(new TypeError('Failed to fetch dynamically imported module')), true);
  assert.equal(isAssetLoadError(new Error('Loading chunk 42 failed')), true);
  assert.equal(isAssetLoadError(new Error('Network request failed')), false);
});

test('asset recovery forces fresh HTML while preserving route and existing search', () => {
  const refreshed = new URL(
    assetRecoveryUrl('https://cometx.example/events/workshop?preview=false#tickets', 123),
  );
  assert.equal(refreshed.pathname, '/events/workshop');
  assert.equal(refreshed.searchParams.get('preview'), 'false');
  assert.equal(refreshed.searchParams.get('__asset_reload'), '123');
  assert.equal(refreshed.hash, '#tickets');
});
