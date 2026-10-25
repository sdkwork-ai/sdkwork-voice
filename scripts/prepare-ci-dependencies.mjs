#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = path.join(repoRoot, 'agent.workflow.json');
const dependencyRoot = path.resolve(repoRoot, '..');
const args = new Set(process.argv.slice(2));
const jsonOutput = args.has('--json');
const dryRun = args.has('--dry-run');
const mode = args.has('--apply') || process.env.GITHUB_ACTIONS === 'true'
  ? 'apply'
  : 'check';

const staticDependencies = [
  {
    id: 'sdkwork-specs',
    repository: 'sdkwork-ai/sdkwork-specs',
    ref: 'main',
    refInput: 'SDKWORK_SPECS_REF',
    tokenSecret: 'SDKWORK_RELEASE_TOKEN',
  },
];

function readWorkflow() {
  return JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
}

function assertSafeRef(ref, dependencyId) {
  if (typeof ref !== 'string' || ref.trim() !== ref || ref.length === 0) {
    throw new Error(`${dependencyId} dependency ref must be a non-empty trimmed string`);
  }
  if (/[\u0000-\u001f\u007f\s\\~^:?*[{]/u.test(ref)) {
    throw new Error(`${dependencyId} dependency ref contains unsafe characters: ${ref}`);
  }
  if (
    ref.startsWith('-')
    || ref.startsWith('/')
    || ref.endsWith('/')
    || ref.includes('..')
    || ref.includes('@{')
    || ref.endsWith('.lock')
  ) {
    throw new Error(`${dependencyId} dependency ref is unsafe: ${ref}`);
  }
}

function resolveRef(dependency, env = process.env) {
  const override = dependency.refInput ? String(env[dependency.refInput] ?? '').trim() : '';
  const ref = override || String(dependency.ref ?? '').trim();
  assertSafeRef(ref, dependency.id);
  return ref;
}

function resolveRepoUrl(dependency) {
  if (!/^sdkwork-ai\/sdkwork-[a-z0-9-]+$/u.test(dependency.repository || '')) {
    throw new Error(`${dependency.id} must use an owner/repo SDKWork repository`);
  }
  return `https://github.com/${dependency.repository}.git`;
}

function tokenEnv(repositoryUrl, tokenSecret, env = process.env) {
  const token = String(env[tokenSecret] ?? env.GITHUB_TOKEN ?? env.GH_TOKEN ?? '').trim();
  if (!token || !repositoryUrl.startsWith('https://github.com/')) {
    return env;
  }
  const index = Number.parseInt(String(env.GIT_CONFIG_COUNT ?? '0'), 10);
  const baseIndex = Number.isFinite(index) && index >= 0 ? index : 0;
  return {
    ...env,
    GIT_CONFIG_COUNT: String(baseIndex + 1),
    [`GIT_CONFIG_KEY_${baseIndex}`]: 'http.https://github.com/.extraheader',
    [`GIT_CONFIG_VALUE_${baseIndex}`]: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64')}`,
  };
}

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error) {
    throw new Error(`git ${args.join(' ')} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    throw new Error(`git ${args.join(' ')} failed with exit code ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }
  return String(result.stdout ?? '').trim();
}

function isGitCheckout(targetPath) {
  if (!fs.existsSync(path.join(targetPath, '.git'))) {
    return false;
  }
  try {
    return runGit(['-C', targetPath, 'rev-parse', '--is-inside-work-tree'], { capture: true }) === 'true';
  } catch {
    return false;
  }
}

function directoryHasEntries(targetPath) {
  return fs.existsSync(targetPath)
    && fs.statSync(targetPath).isDirectory()
    && fs.readdirSync(targetPath).length > 0;
}

function materializeDependency(dependency) {
  const targetPath = path.join(dependencyRoot, dependency.id);
  const repoUrl = resolveRepoUrl(dependency);
  const ref = resolveRef(dependency);
  const env = tokenEnv(repoUrl, dependency.tokenSecret);

  if (mode === 'check') {
    const ok = isGitCheckout(targetPath) || directoryHasEntries(targetPath);
    return { id: dependency.id, targetPath, ref, ok, action: ok ? 'verified' : 'missing' };
  }

  if (dryRun) {
    return { id: dependency.id, targetPath, ref, ok: true, action: fs.existsSync(targetPath) ? 'would-update' : 'would-clone' };
  }

  if (!fs.existsSync(targetPath)) {
    runGit(['clone', '--no-checkout', repoUrl, targetPath], { env });
  } else if (!isGitCheckout(targetPath)) {
    if (directoryHasEntries(targetPath)) {
      throw new Error(`Refusing to overwrite non-git dependency target: ${targetPath}`);
    }
    runGit(['clone', '--no-checkout', repoUrl, targetPath], { env });
  }

  runGit(['-C', targetPath, 'remote', 'set-url', 'origin', repoUrl], { env });
  runGit(['-C', targetPath, 'fetch', '--depth', '1', 'origin', ref], { env });
  runGit(['-C', targetPath, 'checkout', '--force', 'FETCH_HEAD'], { env });
  return { id: dependency.id, targetPath, ref, ok: true, action: 'materialized' };
}

const workflow = readWorkflow();
if (!Array.isArray(workflow.dependencies)) {
  throw new Error('agent.workflow.json must declare dependencies[]');
}

const dependencies = [...workflow.dependencies, ...staticDependencies];
const results = dependencies.map(materializeDependency);
if (jsonOutput) {
  process.stdout.write(`${JSON.stringify({
    mode,
    dryRun,
    workspaceRoot: path.relative(repoRoot, dependencyRoot).replaceAll('\\', '/'),
    dependencies: results.map((result) => ({
      ...result,
      targetPath: path.relative(repoRoot, result.targetPath).replaceAll('\\', '/'),
    })),
  }, null, 2)}\n`);
} else {
  for (const result of results) {
    process.stdout.write(`[prepare-ci-dependencies] ${result.action} ${result.id} -> ${path.relative(repoRoot, result.targetPath)}#${result.ref}\n`);
  }
}

if (results.some((result) => !result.ok)) {
  process.exitCode = 1;
}
