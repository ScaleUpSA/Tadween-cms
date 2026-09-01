#!/usr/bin/env node
/**
 * create-tadween-site — scaffold a new Astro marketing site wired to Tadween.
 *
 *   npm create tadween-site my-site
 */
import { cp, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'template');
const PLACEHOLDER = /__PROJECT_NAME__/g;
const TEXT_FILES = ['package.json', 'wrangler.toml', 'tadween.config.ts'];

function usage(): never {
  console.log('Usage: npm create tadween-site <project-name>');
  process.exit(1);
}

async function main(): Promise<void> {
  const rawName = process.argv[2];
  if (!rawName) usage();
  const target = resolve(process.cwd(), rawName);
  const name = basename(target)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!name) usage();
  if (existsSync(target) && (await readdir(target)).length > 0) {
    console.error(`Directory "${rawName}" already exists and is not empty.`);
    process.exit(1);
  }

  await mkdir(target, { recursive: true });
  await cp(TEMPLATE_DIR, target, { recursive: true });
  await rename(join(target, '_gitignore'), join(target, '.gitignore'));

  for (const file of TEXT_FILES) {
    const path = join(target, file);
    const contents = await readFile(path, 'utf8');
    await writeFile(path, contents.replace(PLACEHOLDER, name));
  }

  console.log(`\nCreated ${name} in ${target}\n`);
  console.log('Next steps:');
  console.log(`  cd ${rawName}`);
  console.log('  npm install');
  console.log('  npx tadween init        # provision R2/D1 and the dashboard');
  console.log('  npx tadween push-schema # upload the content schema');
  console.log('  npm run dev\n');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
