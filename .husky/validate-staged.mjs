import { execFileSync, spawnSync } from 'node:child_process';

const files = execFileSync('git', [
  'diff',
  '--cached',
  '--name-only',
  '--diff-filter=ACMR',
  '-z',
])
  .toString()
  .split('\0')
  .filter(Boolean);

for (const file of files) {
  let command;
  let args;
  if (/^app\/.*\.(js|vue)$/.test(file)) {
    command = 'pnpm';
    args = ['exec', 'eslint', '--stdin', '--stdin-filename', file];
  } else if (file.endsWith('.rb')) {
    command = 'bundle';
    args = ['exec', 'rubocop', '--force-exclusion', '--stdin', file];
  } else {
    continue;
  }

  const input = execFileSync('git', ['show', `:${file}`]);
  const result =
    process.platform === 'win32'
      ? spawnSync(
          'sh',
          ['-c', 'exec "$@"', 'validate-staged', command, ...args],
          {
            input,
            stdio: ['pipe', 'inherit', 'inherit'],
          }
        )
      : spawnSync(command, args, {
          input,
          stdio: ['pipe', 'inherit', 'inherit'],
        });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}
