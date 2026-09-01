#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
