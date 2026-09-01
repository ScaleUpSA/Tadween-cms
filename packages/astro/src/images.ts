export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'json';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
}

/**
 * Returns a URL for an image field value (a media key like `blog/cover.jpg`),
 * routed through Cloudflare Image Transformations when options are given.
 */
export function imageUrl(mediaKey: string, options: ImageOptions = {}): string {
  const source = `/_tadween/media/${mediaKey}`;
  const params = Object.entries(options)
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return params ? `/cdn-cgi/image/${params}${source}` : source;
}
