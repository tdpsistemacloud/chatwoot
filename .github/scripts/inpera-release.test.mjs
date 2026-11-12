import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compare,
  selectRelease,
  queuedBody,
  synchronize,
  slack,
} from './inpera-release.mjs';

const release = tag_name => ({
  tag_name,
  published_at: '2026-01-01',
  draft: false,
  prerelease: false,
  html_url: `https://github.com/chatwoot/chatwoot/releases/tag/${tag_name}`,
});
test('semantic selection includes majors, ignores drafts/prereleases/unpublished and malformed tags', () => {
  const releases = [
    release('v4.9.9'),
    release('v4.19.1'),
    release('v5.0.0'),
    { ...release('v9.0.0'), draft: true },
    { ...release('v8.0.0'), prerelease: true },
    release('v10.0.0-rc.1'),
    { ...release('v7.0.0'), published_at: null },
  ];
  assert.equal(selectRelease(releases).tag_name, 'v5.0.0');
  assert.deepEqual(selectRelease(releases, 'v9.0.0'), {});
  assert.equal(compare('v4.10.0', '4.9.99'), 1);
  assert.deepEqual(selectRelease([]), {});
});
test('queue update is idempotent and preserves review text', () => {
  const first = queuedBody('Human review', 'v5.0.0', 'https://example.test');
  assert.equal(queuedBody(first, 'v5.0.0', 'https://example.test'), first);
  assert.equal(queuedBody(first, 'v4.20.0', 'https://example.test'), first);
  assert.match(
    queuedBody(first, 'v6.0.0', 'https://example.test'),
    /^Human review/
  );
  assert.equal(
    queuedBody(first, 'v6.0.0', 'https://example.test').split(
      'inpera-next-release -->'
    ).length,
    3
  );
});

const dir = mkdtempSync(join(tmpdir(), 'inpera-api-test-'));
process.env.GITHUB_REPOSITORY = 'tdpsistemacloud/chatwoot';
process.env.INPERA_SYNC_RESULT = join(dir, 'result.json');
delete process.env.INPERA_RELEASE_SLACK_WEBHOOK_URL;
test.after(() => rmSync(dir, { recursive: true, force: true }));
const available = {
  current_version: '4.19.1',
  tag: 'v5.0.0',
  branch: 'release/inpera-5.0.0',
  upstream_sha: 'abc',
  status: 'available',
  conflicts: [],
};
const pr = (state = 'open', version = '5.0.0') => ({
  number: 1,
  state,
  body: 'Human review',
  head: {
    ref: `release/inpera-${version}`,
    repo: { full_name: process.env.GITHUB_REPOSITORY },
  },
});
function scenario({
  pulls = [],
  issues = [],
  status = 'conflict',
  dry = false,
} = {}) {
  process.env.DRY_RUN = String(dry);
  const writes = [];
  let runs = 0;
  return {
    writes,
    pulls,
    issues,
    options: {
      runSync: dryRun => {
        runs++;
        return {
          ...available,
          status: dryRun ? 'available' : status,
          conflicts: status === 'conflict' ? ['app/model.rb'] : [],
        };
      },
      request(path, method = 'GET', body) {
        if (method !== 'GET') {
          writes.push({ path, method, body });
          if (method === 'POST' && path.endsWith('/issues'))
            issues.push({ ...body, state: 'open', number: 7 });
          if (method === 'POST' && path.endsWith('/pulls'))
            pulls.push({ ...pr(), body: body.body });
          if (method === 'PATCH')
            Object.assign(
              [...pulls, ...issues].find(i => path.endsWith(`/${i.number}`)) ||
                {},
              body
            );
          return {
            html_url: 'https://github.com/tdpsistemacloud/chatwoot/issues/7',
          };
        }
        if (path.includes('/releases?')) return [release('v5.0.0')];
        if (path.includes('/pulls?')) return pulls;
        if (path.includes('/issues?')) return issues;
        throw new Error(`Unexpected API request: ${path}`);
      },
    },
    get runs() {
      return runs;
    },
  };
}
test('closed unmerged PR declines a version without changing branches', async () => {
  const s = scenario({ pulls: [pr('closed')] });
  assert.equal((await synchronize(s.options)).status, 'declined');
  assert.equal(s.runs, 1);
  assert.equal(s.writes.length, 0);
});
test('a newer release queues once in the pending PR', async () => {
  const s = scenario({ pulls: [pr('open', '4.20.0')] });
  assert.equal((await synchronize(s.options)).status, 'waiting');
  await synchronize(s.options);
  assert.equal(s.writes.length, 1);
  assert.equal(s.runs, 2);
});
test('conflict creates exactly one issue across reruns', async () => {
  const s = scenario();
  assert.equal((await synchronize(s.options)).status, 'conflict');
  await synchronize(s.options);
  assert.equal(s.writes.length, 1);
  assert.match(s.writes[0].body.body, /app\/model.rb/);
});
test('existing PR is preserved without duplicate comments or PRs', async () => {
  const s = scenario({ pulls: [pr()], status: 'ready' });
  assert.equal((await synchronize(s.options)).status, 'ready');
  assert.equal(s.writes.length, 0);
});
test('clean release creates one normal PR with SHA, notes, migrations and runtime changes', async () => {
  const original = process.cwd();
  const git = (...args) =>
    execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.invalid');
  git('commit', '-q', '--allow-empty', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(join(dir, 'db/migrate'), { recursive: true });
  writeFileSync(
    join(dir, 'db/migrate/20261103091712_example.rb'),
    '# migration'
  );
  writeFileSync(join(dir, '.nvmrc'), '24\n');
  git('add', 'db', '.nvmrc');
  git('commit', '-qm', 'release');
  const sha = git('rev-parse', 'HEAD');
  const s = scenario({ status: 'ready' });
  s.options.runSync = dry => ({
    ...available,
    base_sha: base,
    upstream_sha: sha,
    status: dry ? 'available' : 'ready',
  });
  process.chdir(dir);
  try {
    await synchronize(s.options);
    await synchronize(s.options);
    assert.equal(s.writes.length, 1);
    const body = s.writes[0].body;
    assert.equal(body.draft, false);
    assert.equal(body.base, 'inpera_chat');
    assert.match(body.body, /20261103091712_example.rb/);
    assert.match(body.body, /\.nvmrc/);
    assert.ok(body.body.includes(sha));
    assert.match(body.body, /merge commit/);
  } finally {
    process.chdir(original);
  }
});
test('manual dry-run never writes PRs or issues', async () => {
  const s = scenario({ dry: true });
  assert.equal((await synchronize(s.options)).status, 'available');
  assert.equal(s.runs, 1);
  assert.equal(s.writes.length, 0);
});
test('API errors propagate; never treated as no release', async () => {
  const s = scenario();
  s.options.request = () => {
    throw new Error('Authentication failed');
  };
  await assert.rejects(synchronize(s.options), /Authentication failed/);
});
test('Slack absent or unavailable remains optional', async () => {
  await slack('no webhook');
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  process.env.INPERA_RELEASE_SLACK_WEBHOOK_URL = 'https://example.test/secret';
  try {
    await slack('offline');
  } finally {
    globalThis.fetch = original;
    delete process.env.INPERA_RELEASE_SLACK_WEBHOOK_URL;
  }
});
