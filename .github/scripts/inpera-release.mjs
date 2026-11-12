// Trusted automation only. Copy this file outside the worktree before merging upstream.
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  existsSync,
  lstatSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

const stable = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const read = path => JSON.parse(readFileSync(path, 'utf8'));
export function compare(a, b) {
  const x = a.replace(/^v/, '').split('.').map(BigInt);
  const y = b.replace(/^v/, '').split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1;
  return 0;
}
export function selectRelease(releases, tag = '') {
  const available = releases.filter(
    r => !r.draft && !r.prerelease && r.published_at && stable.test(r.tag_name)
  );
  return (
    available
      .filter(r => !tag || r.tag_name === tag)
      .sort((a, b) => compare(b.tag_name, a.tag_name))[0] || {}
  );
}

// gh handles authentication, pagination and API errors. Never convert an error to an empty list.
export function api(path, method = 'GET', body) {
  const args = ['api', path, '--method', method];
  if (method === 'GET') args.push('--paginate', '--slurp');
  if (body) args.push('--input', '-');
  const value = JSON.parse(
    execFileSync('gh', args, {
      encoding: 'utf8',
      input: body ? JSON.stringify(body) : undefined,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'inherit'],
    })
  );
  return method === 'GET' ? value.flat() : value;
}

export async function slack(message) {
  const url = process.env.INPERA_RELEASE_SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Slack HTTP failure');
  } catch {
    const warning =
      'Aviso: Slack indisponível; consulte o resultado da execução no GitHub.\n';
    console.warn(warning);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, warning);
  }
}

const marker = tag => `<!-- inpera-release:${tag} -->`;
const queueMarker = '<!-- inpera-next-release -->';
export function queuedBody(body, tag, url) {
  const queued = body.match(
    /<!-- inpera-next-release -->\nPróxima release detectada: \[(v\d+\.\d+\.\d+)\]/
  )?.[1];
  if (queued && compare(queued, tag) > 0) return body;
  const queue = `${queueMarker}\nPróxima release detectada: [${tag}](${url}). Tratar após concluir esta PR.\n<!-- /inpera-next-release -->`;
  return body.includes(queueMarker)
    ? body.replace(
        /<!-- inpera-next-release -->[\s\S]*?<!-- \/inpera-next-release -->/,
        queue
      )
    : `${body}\n\n${queue}`;
}

export async function synchronize({ request = api, runSync } = {}) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (repo !== 'tdpsistemacloud/chatwoot')
    throw new Error('Sincronização autorizada somente no fork INPERA.');
  const base = 'inpera_chat';
  const script = process.env.INPERA_SYNC_SCRIPT;
  const resultPath = process.env.INPERA_SYNC_RESULT;
  const tag = process.env.INPUT_TAG || '';
  const dryRun = process.env.DRY_RUN !== 'false';
  const run =
    runSync ||
    ((dry, selectedTag = tag) => {
      execFileSync(
        'bash',
        [
          script,
          ...(selectedTag ? [selectedTag] : ['--latest']),
          '--ci',
          ...(dry ? ['--dry-run'] : []),
        ],
        { stdio: 'inherit' }
      );
      return read(resultPath);
    });
  let result = run(true);
  if (result.status !== 'available') return result;
  const release = selectRelease(
    request('repos/chatwoot/chatwoot/releases?per_page=100'),
    result.tag
  );
  if (!release.tag_name)
    throw new Error('Release deixou de estar publicada; tente novamente.');
  const pulls = request(
    `repos/${repo}/pulls?state=all&base=${base}&per_page=100`
  );
  const same = pulls.find(
    p => p.head.repo?.full_name === repo && p.head.ref === result.branch
  );
  if (same?.state === 'closed') {
    result.status = same.merged_at ? 'integrated' : 'declined';
  } else {
    const pending = pulls.filter(
      p =>
        p.state === 'open' &&
        p.head.repo?.full_name === repo &&
        /^release\/inpera-\d+\.\d+\.\d+$/.test(p.head.ref)
    );
    if (pending.length > 1)
      throw new Error(
        'Mais de uma PR de release aberta; conclua as extras manualmente.'
      );
    if (pending.length && pending[0].number !== same?.number) {
      const other = pending[0];
      if (
        compare(result.tag, other.head.ref.replace('release/inpera-', '')) >
          0 &&
        !dryRun
      ) {
        const body = queuedBody(other.body || '', result.tag, release.html_url);
        if (body !== other.body)
          request(`repos/${repo}/pulls/${other.number}`, 'PATCH', { body });
      }
      result.status = 'waiting';
    } else if (!dryRun) {
      // Pin the probed tag: a release appearing during this run must wait.
      result = run(false, result.tag);
      const issues = request(`repos/${repo}/issues?state=all&per_page=100`);
      const issue = issues.find(
        i => !i.pull_request && i.body?.includes(marker(result.tag))
      );
      if (result.status === 'conflict') {
        const body = `${marker(result.tag)}\nRelease ${result.tag}, upstream SHA: \`${result.upstream_sha}\`.\n\nArquivos em conflito:\n${result.conflicts.map(f => `- \`${f.replaceAll('`', '')}\``).join('\n')}\n\nEm uma árvore limpa, fora de branches protegidas:\n\n\`\`\`bash\nbash script/sync_upstream_branches.sh ${result.tag} --no-push\n# Resolver os arquivos preservando Evolution, WhatsApp Cloud, branding e PDF/CSV.\ngit add <arquivos>\ngit commit\nbash script/sync_upstream_branches.sh ${result.tag}\n\`\`\`\n\nReexecute o workflow com a mesma tag. VERSION_CW será atualizado também na retomada.\nConsulte docs/inpera/AUTOMACAO-UPSTREAM.md. Não faça merge diretamente em inpera_chat.`;
        if (issue) {
          if (issue.body !== body || issue.state !== 'open')
            request(`repos/${repo}/issues/${issue.number}`, 'PATCH', {
              body,
              state: 'open',
            });
        } else {
          const created = request(`repos/${repo}/issues`, 'POST', {
            title: `Conflitos INPERA: ${result.tag}`,
            body,
          });
          await slack(
            `INPERA ${result.current_version} → ${result.tag}: conflitos. ${created.html_url}`
          );
        }
      } else if (result.status === 'ready') {
        if (!same) {
          const git = args =>
            execFileSync('git', args, { encoding: 'utf8' }).trim();
          const changes = git([
            'diff',
            '--name-only',
            result.base_sha,
            result.upstream_sha,
          ]);
          const migrations = changes
            .split('\n')
            .filter(p => /^(enterprise\/)?db\/migrate\//.test(p));
          const runtimes = changes
            .split('\n')
            .filter(p =>
              /(^|\/)(Gemfile(\.lock)?|package\.json|pnpm-lock\.yaml|\.ruby-version|\.nvmrc|Dockerfile)$/.test(
                p
              )
            );
          const body = `${marker(result.tag)}\nAtualiza INPERA Chat de ${result.current_version} para ${result.tag}.\n\nUpstream: [${result.tag}](${release.html_url}), SHA \`${result.upstream_sha}\`.\n\n### Migrations\n${migrations.join('\n') || 'Nenhuma.'}\n\n### Runtime e dependências\n${runtimes.join('\n') || 'Nenhuma mudança detectada.'}\n\n### Notas upstream\n${release.body || 'Consulte o link da release.'}\n\n### Revisão INPERA\n- [ ] Evolution: conexão, entrada e envio de mensagens\n- [ ] WhatsApp Cloud e branding\n- [ ] Exportação PDF/CSV e workers\n- [ ] Migrations revisadas e backup planejado\n- [ ] Enterprise revisado (CI CE remove a árvore Enterprise)\n- [ ] INPERA / validação aprovado; revisão humana\n\nIntegrar com **merge commit**, preservando a ancestralidade upstream. Deploy local separado e autorizado. Sem auto-merge.`;
          const created = request(`repos/${repo}/pulls`, 'POST', {
            base,
            head: result.branch,
            title: `chore(release): atualizar INPERA Chat para ${result.tag}`,
            body,
            draft: false,
          });
          await slack(
            `INPERA ${result.current_version} → ${result.tag}: nova PR. ${created.html_url}`
          );
        }
        if (issue?.state === 'open')
          request(`repos/${repo}/issues/${issue.number}`, 'PATCH', {
            state: 'closed',
          });
      }
    }
  }
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function main([command, ...args]) {
  if (command === 'select') {
    console.log(
      JSON.stringify(
        selectRelease(
          api('repos/chatwoot/chatwoot/releases?per_page=100'),
          args[0]
        )
      )
    );
  } else if (command === 'field') {
    const value = read(args[0])[args[1]];
    console.log(Array.isArray(value) ? value.join('\n') : value || '');
  } else if (command === 'protect-ignored') {
    const paths = readFileSync(args[0], 'utf8').split('\0').filter(Boolean);
    const collisions = [...new Set(paths)].filter(path =>
      lstatSync(path, { throwIfNoEntry: false })
    );
    if (collisions.length)
      throw new Error(
        `Arquivos locais ignorados seriam sobrescritos: ${collisions.join(', ')}`
      );
  } else if (command === 'result') {
    const [
      current_version,
      tag,
      upstream_sha,
      branch,
      status,
      conflicts,
      path,
      base_sha,
    ] = args;
    const result = {
      current_version,
      tag,
      upstream_sha,
      base_sha,
      branch,
      status,
      conflicts: conflicts ? conflicts.split('\n') : [],
    };
    if (path) writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify(result));
  } else if (command === 'sync') {
    try {
      const result = await synchronize();
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `Sincronização: **${result.status}** (${result.current_version} / ${result.tag}).\n`
        );
    } catch (error) {
      const path = process.env.INPERA_SYNC_RESULT;
      if (path && existsSync(path)) {
        const result = read(path);
        result.status = 'error';
        writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
      }
      console.error(error.message);
      throw new Error(
        'Sincronização falhou. Consulte o erro da API/Git acima; nenhum sucesso foi presumido.'
      );
    }
  } else if (command === 'alert') {
    const path = process.env.INPERA_SYNC_RESULT;
    const result =
      path && existsSync(path)
        ? read(path)
        : {
            current_version: '',
            tag: '',
            upstream_sha: '',
            base_sha: '',
            branch: '',
            conflicts: [],
          };
    result.status = 'error';
    if (path) writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
    await slack(
      `INPERA ${result.current_version || '(versão não detectada)'}${result.tag ? ` → ${result.tag}` : ''}: falha operacional na sincronização. ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    );
  } else throw new Error(`Comando desconhecido: ${command}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
