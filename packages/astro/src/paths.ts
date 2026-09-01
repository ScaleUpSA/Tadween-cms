import type { ContentType } from './schema.js';

export function entryKey(site: string, typeKey: string, type: ContentType, slug?: string): string {
  return type.type === 'singleton'
    ? `${site}/content/singletons/${typeKey}.md`
    : `${site}/content/${typeKey}/${slug}.md`;
}

export function draftKey(site: string, typeKey: string, type: ContentType, slug?: string): string {
  return type.type === 'singleton'
    ? `${site}/drafts/singletons/${typeKey}.md`
    : `${site}/drafts/${typeKey}/${slug}.md`;
}

export function collectionPrefix(site: string, typeKey: string): string {
  return `${site}/content/${typeKey}/`;
}

export function revisionKey(
  site: string,
  typeKey: string,
  slug: string,
  timestamp: string,
): string {
  return `${site}/revisions/${typeKey}/${slug}/${timestamp}.md`;
}

export function revisionPrefix(site: string, typeKey: string, slug: string): string {
  return `${site}/revisions/${typeKey}/${slug}/`;
}

export function schemaKey(site: string): string {
  return `${site}/schema.json`;
}

export function mediaKey(site: string, filename: string): string {
  return `${site}/media/${filename}`;
}

export function slugFromKey(key: string): string {
  const base = key.split('/').pop() ?? '';
  return base.replace(/\.md$/, '');
}
