import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReleaseCommands, normalizeVersion } from './release.mjs';

test('normalizeVersion strips the leading v from a release tag', () => {
  assert.equal(normalizeVersion('v1.2.3'), '1.2.3');
});

test('normalizeVersion rejects tags without the leading v', () => {
  assert.throws(
    () => normalizeVersion('1.2.3'),
    /Expected version like v1\.2\.3/,
  );
});

test('normalizeVersion rejects non-semver tags', () => {
  assert.throws(
    () => normalizeVersion('v1.2'),
    /Expected version like v1\.2\.3/,
  );
});

test('buildReleaseCommands returns the expected release flow', () => {
  assert.deepEqual(buildReleaseCommands('v1.2.3'), [
    ['npm', ['version', '1.2.3', '--no-git-tag-version']],
    ['git', ['add', 'package.json']],
    ['git', ['commit', '-m', 'chore: release v1.2.3']],
    ['git', ['tag', 'v1.2.3']],
    ['git', ['push']],
    ['git', ['push', 'origin', 'v1.2.3']],
  ]);
});
