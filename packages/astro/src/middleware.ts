import { createContent, setContent } from './content.js';
import { verifyPreviewToken } from './preview.js';
import type { TadweenConfig } from './schema.js';

interface RuntimeEnv {
  CONTENT: R2Bucket;
  MEDIA?: R2Bucket;
  TADWEEN_PREVIEW_SECRET?: string;
}

const MEDIA_ROUTE = '/_tadween/media/';

async function serveMedia(env: RuntimeEnv, site: string, pathname: string): Promise<Response> {
  const key = `${site}/media/${pathname.slice(MEDIA_ROUTE.length)}`;
  const object = await env.MEDIA?.get(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers({ 'Cache-Control': 'public, max-age=31536000, immutable' });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

interface MiddlewareContext {
  request: Request;
  locals: { runtime?: { env: RuntimeEnv } } & Record<string, unknown>;
}

type Next = () => Promise<Response>;

export interface TadweenMiddlewareOptions {
  /** Seconds pages stay in the edge cache. Publishing purges early. Default: 1 year. */
  maxAge?: number;
  /** Disable the edge cache entirely (e.g. in dev). */
  cache?: boolean;
}

const PREVIEW_PARAM = 'tadween-preview';

/**
 * Astro middleware: initializes the Tadween content API from the request's R2
 * binding, handles signed preview tokens, and serves HTML through the
 * Cloudflare edge cache so pages render only on the first hit after a publish.
 */
export function tadween(config: TadweenConfig, options: TadweenMiddlewareOptions = {}) {
  const { maxAge = 31536000, cache = true } = options;

  return async function onRequest(context: MiddlewareContext, next: Next): Promise<Response> {
    const env = context.locals.runtime?.env;
    if (!env?.CONTENT) {
      throw new Error(
        'Tadween: R2 binding "CONTENT" not found. Add it to wrangler config and ensure the Cloudflare adapter is used.',
      );
    }

    const url = new URL(context.request.url);
    if (url.pathname.startsWith(MEDIA_ROUTE)) {
      return serveMedia(env, config.site, url.pathname);
    }
    const previewToken = url.searchParams.get(PREVIEW_PARAM);
    let preview = false;
    if (previewToken && env.TADWEEN_PREVIEW_SECRET) {
      preview = await verifyPreviewToken(env.TADWEEN_PREVIEW_SECRET, previewToken);
    }

    setContent(createContent({ bucket: env.CONTENT, config, preview }));
    context.locals.tadweenPreview = preview;

    const cacheable =
      cache && !preview && context.request.method === 'GET' && typeof caches !== 'undefined';
    if (!cacheable) {
      const response = await next();
      if (preview) response.headers.set('Cache-Control', 'no-store');
      return response;
    }

    const edgeCache = (caches as unknown as { default: Cache }).default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });
    const hit = await edgeCache.match(cacheKey);
    if (hit) return hit;

    const response = await next();
    if (response.status === 200) {
      const toStore = new Response(response.clone().body, response);
      toStore.headers.set('Cache-Control', `public, s-maxage=${maxAge}`);
      await edgeCache.put(cacheKey, toStore.clone());
      return toStore;
    }
    return response;
  };
}
