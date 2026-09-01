import { parseFrontmatter } from './frontmatter.js';
import { renderMarkdown, splitBody } from './markdown.js';
import { collectionPrefix, draftKey, entryKey, slugFromKey } from './paths.js';
import { frontmatterSchema, resolveLocale, type TadweenConfig } from './schema.js';

export interface Entry {
  slug: string;
  /** Locale-resolved frontmatter. */
  data: Record<string, unknown>;
  /** Rendered HTML of the markdown body for the requested locale. */
  html: string;
  /** Raw markdown body for the requested locale. */
  body: string;
}

export interface TadweenContent {
  getCollection(typeKey: string, locale?: string): Promise<Entry[]>;
  getEntry(typeKey: string, slug: string, locale?: string): Promise<Entry | null>;
  getSingleton(typeKey: string, locale?: string): Promise<Entry | null>;
}

export interface CreateContentOptions {
  bucket: R2Bucket;
  config: TadweenConfig;
  /** When true, reads from drafts (falling back to published). Used by preview mode. */
  preview?: boolean;
}

export function createContent(options: CreateContentOptions): TadweenContent {
  const { bucket, config, preview = false } = options;
  const defaultLocale = config.defaultLocale ?? config.locales[0] ?? 'ar';

  async function readEntry(typeKey: string, slug?: string, locale?: string): Promise<Entry | null> {
    const type = config.content[typeKey];
    if (!type) throw new Error(`Unknown content type "${typeKey}"`);
    const lang = locale ?? defaultLocale;
    let object: R2ObjectBody | null = null;
    if (preview) {
      object = await bucket.get(draftKey(config.site, typeKey, type, slug));
    }
    if (!object) {
      object = await bucket.get(entryKey(config.site, typeKey, type, slug));
    }
    if (!object) return null;
    return toEntry(await object.text(), typeKey, slug ?? typeKey, lang);
  }

  function toEntry(raw: string, typeKey: string, slug: string, lang: string): Entry | null {
    const type = config.content[typeKey];
    if (!type) return null;
    const { data, body } = parseFrontmatter(raw);
    const parsed = frontmatterSchema(type, config.locales).safeParse(data);
    if (!parsed.success) {
      console.warn(
        `[tadween] skipping ${typeKey}/${slug}: invalid frontmatter`,
        parsed.error.issues,
      );
      return null;
    }
    if (!preview && parsed.data.status === 'draft') return null;
    const sections = splitBody(body, defaultLocale);
    const localizedBody = sections[lang] ?? sections[defaultLocale] ?? '';
    return {
      slug,
      data: resolveLocale(parsed.data, type, lang, defaultLocale),
      body: localizedBody,
      html: renderMarkdown(localizedBody),
    };
  }

  return {
    async getCollection(typeKey, locale) {
      const type = config.content[typeKey];
      if (!type || type.type !== 'collection') {
        throw new Error(`"${typeKey}" is not a collection`);
      }
      const lang = locale ?? defaultLocale;
      const prefix = collectionPrefix(config.site, typeKey);
      const entries: Entry[] = [];
      let cursor: string | undefined;
      do {
        const listed = await bucket.list({ prefix, cursor });
        const objects = await Promise.all(listed.objects.map((o) => bucket.get(o.key)));
        for (const object of objects) {
          if (!object) continue;
          const entry = toEntry(await object.text(), typeKey, slugFromKey(object.key), lang);
          if (entry) entries.push(entry);
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
      return entries;
    },
    getEntry(typeKey, slug, locale) {
      return readEntry(typeKey, slug, locale);
    },
    getSingleton(typeKey, locale) {
      return readEntry(typeKey, undefined, locale);
    },
  };
}

let activeContent: TadweenContent | null = null;

/** Called by the Tadween middleware on each request; can also be called manually in tests. */
export function setContent(content: TadweenContent): void {
  activeContent = content;
}

function content(): TadweenContent {
  if (!activeContent) {
    throw new Error(
      'Tadween content is not initialized. Add the tadween() middleware or call setContent().',
    );
  }
  return activeContent;
}

export const getCollection: TadweenContent['getCollection'] = (typeKey, locale) =>
  content().getCollection(typeKey, locale);
export const getEntry: TadweenContent['getEntry'] = (typeKey, slug, locale) =>
  content().getEntry(typeKey, slug, locale);
export const getSingleton: TadweenContent['getSingleton'] = (typeKey, locale) =>
  content().getSingleton(typeKey, locale);
