import { readFileSync } from 'node:fs';
import { api, slack } from './inpera-release.mjs';

if (!process.env.INPERA_RELEASE_SLACK_WEBHOOK_URL) process.exit(0);
const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const repo = process.env.GITHUB_REPOSITORY;
if (repo !== 'tdpsistemacloud/chatwoot')
  throw new Error('Notificação restrita ao fork.');
const isRelease = p =>
  p.base.ref === 'inpera_chat' &&
  p.head.repo?.full_name === repo &&
  /^release\/inpera-\d+\.\d+\.\d+$/.test(p.head.ref);

if (process.env.GITHUB_EVENT_NAME === 'pull_request_target') {
  const p = event.pull_request;
  if (p.merged && isRelease(p))
    await slack(
      `INPERA ${p.head.ref.replace('release/inpera-', '')}: atualização integrada. ${p.html_url}`
    );
} else {
  const run = event.workflow_run;
  if (run.event === 'pull_request' && run.head_repository.full_name === repo) {
    const pulls = api(
      `repos/${repo}/commits/${run.head_sha}/pulls?per_page=100`
    );
    for (const associated of pulls) {
      const p = api(`repos/${repo}/pulls/${associated.number}`)[0];
      // Ignore stale runs after a subsequent human commit. Never execute run artifacts/code.
      if (isRelease(p) && p.head.sha === run.head_sha) {
        await slack(
          `INPERA ${p.head.ref.replace('release/inpera-', '')}: CI ${run.conclusion}. ${run.html_url} | ${p.html_url}`
        );
      }
    }
  }
}
