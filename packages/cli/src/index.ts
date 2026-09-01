#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { createJiti } from 'jiti';
import { compileSchema, type TadweenConfig } from '@tadween/astro';

const CONTENT_BUCKET = 'tadween-content';
const MEDIA_BUCKET = 'tadween-media';
const D1_NAME = 'tadween';

function wrangler(args: string[], input?: string): string {
  const result = spawnSync('npx', ['wrangler', ...args], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  if (result.status !== 0) {
    throw new Error(`wrangler ${args.join(' ')} failed (exit ${result.status})`);
  }
  return result.stdout;
}

async function loadConfig(): Promise<TadweenConfig> {
  const jiti = createJiti(process.cwd());
  const mod = await jiti.import<{ default: TadweenConfig }>(
    resolve(process.cwd(), 'tadween.config.ts'),
  );
  return mod.default;
}

function hashPassword(password: string): string {
  const iterations = 210000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  return `pbkdf2$${iterations}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

function d1Execute(sql: string): void {
  wrangler(['d1', 'execute', D1_NAME, '--remote', '--command', sql]);
}

const sqlEscape = (value: string) => value.replace(/'/g, "''");

async function pushSchema(): Promise<void> {
  const config = await loadConfig();
  const schema = compileSchema(config);
  const dir = mkdtempSync(join(tmpdir(), 'tadween-'));
  const file = join(dir, 'schema.json');
  try {
    writeFileSync(file, JSON.stringify(schema, null, 2));
    wrangler([
      'r2',
      'object',
      'put',
      `${CONTENT_BUCKET}/${schema.site}/schema.json`,
      '--file',
      file,
      '--remote',
    ]);
    console.log(`Pushed schema for site "${schema.site}" to r2://${CONTENT_BUCKET}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function createUser(): Promise<void> {
  const email = (await prompt('Email: ')).toLowerCase();
  const name = await prompt('Name: ');
  const role = (await prompt('Role (owner/editor) [editor]: ')) || 'editor';
  const password = await prompt('Password: ');
  if (!email || !password) throw new Error('email and password are required');
  const id = randomUUID();
  d1Execute(
    `INSERT INTO users (id, email, password_hash, name, role) VALUES ('${id}', '${sqlEscape(email)}', '${hashPassword(password)}', '${sqlEscape(name)}', '${sqlEscape(role)}')`,
  );
  console.log(`Created ${role} ${email} (${id})`);
}

async function addSite(): Promise<void> {
  const config = await loadConfig();
  const name = (await prompt(`Site name [${config.site}]: `)) || config.site;
  const baseUrl = await prompt('Live site base URL (e.g. https://acme.com): ');
  const zoneId = await prompt('Cloudflare zone ID (for cache purge, optional): ');
  const id = randomUUID();
  d1Execute(
    `INSERT INTO sites (id, name, prefix, base_url, zone_id) VALUES ('${id}', '${sqlEscape(name)}', '${sqlEscape(config.site)}', '${sqlEscape(baseUrl)}', '${sqlEscape(zoneId)}')`,
  );
  console.log(`Registered site "${name}" (${id}) with prefix "${config.site}"`);
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

async function exportContent(): Promise<void> {
  const config = await loadConfig();
  const dir = resolve(process.argv[4] ?? 'content');
  const outFile = resolve(process.argv[3] ?? `tadween-${config.site}.json`);
  const files: Record<string, string> = {};
  for (const file of walkFiles(dir)) {
    files[`content/${relative(dir, file).split(sep).join('/')}`] = readFileSync(file, 'utf8');
  }
  const bundle = {
    version: 1,
    site: config.site,
    exportedAt: new Date().toISOString(),
    files,
  };
  writeFileSync(outFile, JSON.stringify(bundle, null, 2));
  console.log(`Exported ${Object.keys(files).length} files to ${outFile}`);
  console.log('Upload this bundle from the dashboard (Export / import) to push it to R2.');
}

async function importContent(): Promise<void> {
  const bundleFile = process.argv[3];
  if (!bundleFile) throw new Error('usage: tadween import <bundle.json> [dir]');
  const dir = resolve(process.argv[4] ?? '.');
  const bundle = JSON.parse(readFileSync(resolve(bundleFile), 'utf8')) as {
    version: number;
    files: Record<string, string>;
  };
  if (bundle.version !== 1 || typeof bundle.files !== 'object' || bundle.files === null) {
    throw new Error('invalid bundle');
  }
  let count = 0;
  for (const [rel, text] of Object.entries(bundle.files)) {
    if (rel.includes('..') || rel.startsWith('/')) continue;
    const target = join(dir, rel);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    count++;
  }
  console.log(`Wrote ${count} files under ${dir}`);
}

async function init(): Promise<void> {
  console.log('Provisioning Tadween resources (requires wrangler login)...');
  for (const bucket of [CONTENT_BUCKET, MEDIA_BUCKET]) {
    try {
      wrangler(['r2', 'bucket', 'create', bucket]);
    } catch {
      console.log(`Bucket ${bucket} already exists, skipping`);
    }
  }
  try {
    wrangler(['d1', 'create', D1_NAME]);
  } catch {
    console.log(`D1 database ${D1_NAME} already exists, skipping`);
  }
  console.log(`
Next steps:
  1. Apply the dashboard schema:   wrangler d1 execute ${D1_NAME} --remote --file node_modules/@tadween/dashboard/schema.sql
  2. Deploy the dashboard:         see packages/dashboard (fill database_id in wrangler.toml, wrangler deploy)
  3. Set secrets on the dashboard: wrangler secret put CF_API_TOKEN / TADWEEN_PREVIEW_SECRET
  4. Push your content schema:     npx tadween push-schema
  5. Register the site:            npx tadween add-site
  6. Create the first login:       npx tadween create-user
`);
}

const command = process.argv[2];
const commands: Record<string, () => Promise<void>> = {
  init,
  'push-schema': pushSchema,
  'create-user': createUser,
  'add-site': addSite,
  export: exportContent,
  import: importContent,
};

const run = commands[command ?? ''];
if (!run) {
  console.log(`tadween — usage: tadween <${Object.keys(commands).join('|')}>`);
  process.exit(command ? 1 : 0);
}
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
