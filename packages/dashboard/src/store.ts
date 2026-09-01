import {
  parseFrontmatter,
  serializeFrontmatter,
  paths,
  type CompiledSchema,
  type ContentType,
} from '@tadween/astro';
import type { Env, Site } from './env.js';

const MAX_REVISIONS = 20;

export async function loadSchema(env: Env, site: Site): Promise<CompiledSchema | null> {
  const object = await env.CONTENT.get(paths.schemaKey(site.prefix));
  if (!object) return null;
  return JSON.parse(await object.text()) as CompiledSchema;
}

export interface EntrySummary {
  slug: string;
  title: string;
  status: 'draft' | 'published';
  hasDraft: boolean;
}

function titleOf(data: Record<string, unknown>, type: ContentType, locales: string[]): string {
  const titleField =
    (type.type === 'collection' && type.titleField) ||
    Object.entries(type.fields).find(([, f]) => f.kind === 'text')?.[0] ||
    'title';
  for (const key of [...locales.map((l) => `${titleField}_${l}`), titleField]) {
    const value = data[key];
    if (typeof value === 'string' && value) return value;
  }
  return '(untitled)';
}

export async function listEntries(
  env: Env,
  site: Site,
  schema: CompiledSchema,
  typeKey: string,
  type: ContentType,
): Promise<EntrySummary[]> {
  const publishedPrefix = paths.collectionPrefix(site.prefix, typeKey);
  const draftPrefix = `${site.prefix}/drafts/${typeKey}/`;
  const [published, drafts] = await Promise.all([
    env.CONTENT.list({ prefix: publishedPrefix, limit: 1000 }),
    env.CONTENT.list({ prefix: draftPrefix, limit: 1000 }),
  ]);
  const draftSlugs = new Set(drafts.objects.map((o) => paths.slugFromKey(o.key)));
  const summaries = new Map<string, EntrySummary>();
  await Promise.all(
    published.objects.map(async (o) => {
      const object = await env.CONTENT.get(o.key);
      if (!object) return;
      const { data } = parseFrontmatter(await object.text());
      const slug = paths.slugFromKey(o.key);
      summaries.set(slug, {
        slug,
        title: titleOf(data, type, schema.locales),
        status: 'published',
        hasDraft: draftSlugs.has(slug),
      });
    }),
  );
  await Promise.all(
    [...draftSlugs]
      .filter((slug) => !summaries.has(slug))
      .map(async (slug) => {
        const object = await env.CONTENT.get(`${draftPrefix}${slug}.md`);
        if (!object) return;
        const { data } = parseFrontmatter(await object.text());
        summaries.set(slug, {
          slug,
          title: titleOf(data, type, schema.locales),
          status: 'draft',
          hasDraft: true,
        });
      }),
  );
  return [...summaries.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export interface LoadedEntry {
  data: Record<string, unknown>;
  body: string;
  isDraft: boolean;
  exists: boolean;
}

export async function loadEntry(
  env: Env,
  site: Site,
  typeKey: string,
  type: ContentType,
  slug?: string,
): Promise<LoadedEntry> {
  const draft = await env.CONTENT.get(paths.draftKey(site.prefix, typeKey, type, slug));
  if (draft) {
    const { data, body } = parseFrontmatter(await draft.text());
    return { data, body, isDraft: true, exists: true };
  }
  const published = await env.CONTENT.get(paths.entryKey(site.prefix, typeKey, type, slug));
  if (published) {
    const { data, body } = parseFrontmatter(await published.text());
    return { data, body, isDraft: false, exists: true };
  }
  return { data: {}, body: '', isDraft: false, exists: false };
}

export async function saveDraft(
  env: Env,
  site: Site,
  typeKey: string,
  type: ContentType,
  slug: string | undefined,
  data: Record<string, unknown>,
  body: string,
): Promise<void> {
  const raw = serializeFrontmatter({ ...data, status: 'draft' }, body);
  await env.CONTENT.put(paths.draftKey(site.prefix, typeKey, type, slug), raw);
}

export async function publishEntry(
  env: Env,
  site: Site,
  typeKey: string,
  type: ContentType,
  slug: string | undefined,
  data: Record<string, unknown>,
  body: string,
): Promise<void> {
  const key = paths.entryKey(site.prefix, typeKey, type, slug);
  const revSlug = type.type === 'singleton' ? typeKey : (slug ?? '');

  // Keep the previous published version as a revision.
  const existing = await env.CONTENT.get(key);
  if (existing) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await env.CONTENT.put(
      paths.revisionKey(site.prefix, typeKey, revSlug, timestamp),
      await existing.text(),
    );
    await pruneRevisions(env, site, typeKey, revSlug);
  }

  const raw = serializeFrontmatter({ ...data, status: 'published' }, body);
  await env.CONTENT.put(key, raw);
  await env.CONTENT.delete(paths.draftKey(site.prefix, typeKey, type, slug));
}

async function pruneRevisions(env: Env, site: Site, typeKey: string, slug: string): Promise<void> {
  const listed = await env.CONTENT.list({
    prefix: paths.revisionPrefix(site.prefix, typeKey, slug),
    limit: 1000,
  });
  const keys = listed.objects.map((o) => o.key).sort();
  const excess = keys.slice(0, Math.max(0, keys.length - MAX_REVISIONS));
  if (excess.length) await Promise.all(excess.map((k) => env.CONTENT.delete(k)));
}

export async function deleteEntry(
  env: Env,
  site: Site,
  typeKey: string,
  type: ContentType,
  slug: string,
): Promise<void> {
  // The published file is kept as a final revision so deletion is recoverable.
  const key = paths.entryKey(site.prefix, typeKey, type, slug);
  const existing = await env.CONTENT.get(key);
  if (existing) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await env.CONTENT.put(
      paths.revisionKey(site.prefix, typeKey, slug, timestamp),
      await existing.text(),
    );
  }
  await env.CONTENT.delete(key);
  await env.CONTENT.delete(paths.draftKey(site.prefix, typeKey, type, slug));
}
