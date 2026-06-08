import { execFileSync } from 'node:child_process';

const VERSION_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

export function normalizeVersion(input) {
  if (!VERSION_TAG_PATTERN.test(input)) {
    throw new Error('Expected version like v1.2.3');
  }

  return input.slice(1);
}

export function buildReleaseCommands(tag) {
  const version = normalizeVersion(tag);

  return [
    ['npm', ['version', version, '--no-git-tag-version']],
    ['git', ['add', 'package.json']],
    ['git', ['commit', '-m', `chore: release ${tag}`]],
    ['git', ['tag', tag]],
    ['git', ['push']],
    ['git', ['push', 'origin', tag]],
  ];
}

export function assertCleanWorktree(execFn = execFileSync) {
  const output = execFn('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  });

  if (output.trim() !== '') {
    throw new Error('Refusing to release from a dirty worktree');
  }
}

function runRelease(tag) {
  const commands = buildReleaseCommands(tag);

  assertCleanWorktree();
  console.log(`Releasing ${tag}`);

  for (const [command, args] of commands) {
    execFileSync(command, args, { stdio: 'inherit' });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , tag] = process.argv;

  if (tag === undefined || process.argv.length !== 3) {
    console.error('Usage: yarn release v1.2.3');
    process.exit(1);
  }

  try {
    runRelease(tag);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
