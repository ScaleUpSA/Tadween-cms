import type { CompiledSchema, ContentType } from '@tadween/astro';
import type { Site } from './env.js';

function routeUrls(
  base: string,
  type: ContentType,
  typeKey: string,
  locales: string[],
  slug: string,
): string[] {
  const patterns = type.routes ?? defaultRoutes(type, typeKey);
  const urls: string[] = [];
  for (const pattern of patterns) {
    for (const lang of locales) {
      urls.push(base + pattern.replace(':lang', lang).replace(':slug', slug));
    }
  }
  return [...new Set(urls)];
}

function defaultRoutes(type: ContentType, typeKey: string): string[] {
  if (type.type === 'singleton') return ['/', '/:lang'];
  return [`/:lang/${typeKey}`, `/:lang/${typeKey}/:slug`];
}

export interface PurgeResult {
  ok: boolean;
  detail?: string;
}

/**
 * Purges the pages affected by a publish from the Cloudflare edge cache.
 * Falls back to purging the whole hostname when specific URLs can't be
 * resolved. Failures are non-fatal: content is already live in R2 and will
 * appear when the cache entry expires.
 */
export async function purgePublish(
  apiToken: string | undefined,
  site: Site,
  schema: CompiledSchema,
  typeKey: string,
  slug: string,
): Promise<PurgeResult> {
  if (!apiToken || !site.zone_id || !site.base_url) {
    return { ok: false, detail: 'purge skipped: missing CF_API_TOKEN, zone_id, or base_url' };
  }
  const type = schema.content[typeKey];
  if (!type) return { ok: false, detail: `unknown type ${typeKey}` };
  const files = routeUrls(site.base_url.replace(/\/$/, ''), type, typeKey, schema.locales, slug);

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${site.zone_id}/purge_cache`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ files }),
    },
  );
  if (!response.ok) {
    return { ok: false, detail: `purge failed: ${response.status} ${await response.text()}` };
  }
  return { ok: true };
}
