import { z } from 'zod';

export type Locale = string;

export interface Label {
  ar: string;
  en: string;
}

interface BaseFieldOptions {
  label?: Label;
  required?: boolean;
  bilingual?: boolean;
  help?: Label;
}

export type Field =
  | ({ kind: 'text' } & BaseFieldOptions)
  | ({ kind: 'textarea' } & BaseFieldOptions)
  | ({ kind: 'markdown' } & BaseFieldOptions)
  | ({ kind: 'number'; min?: number; max?: number } & BaseFieldOptions)
  | ({ kind: 'boolean' } & BaseFieldOptions)
  | ({ kind: 'date' } & BaseFieldOptions)
  | ({ kind: 'select'; options: { value: string; label: Label }[] } & BaseFieldOptions)
  | ({ kind: 'image' } & BaseFieldOptions)
  | ({ kind: 'reference'; to: string } & BaseFieldOptions)
  | ({ kind: 'list'; fields: Record<string, Field> } & BaseFieldOptions);

export const fields = {
  text: (opts: BaseFieldOptions = {}): Field => ({ kind: 'text', ...opts }),
  textarea: (opts: BaseFieldOptions = {}): Field => ({ kind: 'textarea', ...opts }),
  markdown: (opts: BaseFieldOptions = {}): Field => ({ kind: 'markdown', ...opts }),
  number: (opts: BaseFieldOptions & { min?: number; max?: number } = {}): Field => ({
    kind: 'number',
    ...opts,
  }),
  boolean: (opts: BaseFieldOptions = {}): Field => ({ kind: 'boolean', ...opts }),
  date: (opts: BaseFieldOptions = {}): Field => ({ kind: 'date', ...opts }),
  select: (opts: BaseFieldOptions & { options: { value: string; label: Label }[] }): Field => ({
    kind: 'select',
    ...opts,
  }),
  image: (opts: BaseFieldOptions = {}): Field => ({ kind: 'image', ...opts }),
  /** A link to an entry in another collection; stores the referenced entry's slug. */
  reference: (opts: BaseFieldOptions & { to: string }): Field => ({ kind: 'reference', ...opts }),
  list: (opts: BaseFieldOptions & { fields: Record<string, Field> }): Field => ({
    kind: 'list',
    ...opts,
  }),
};

export interface Collection {
  type: 'collection';
  label: Label;
  slug: string;
  titleField?: string;
  fields: Record<string, Field>;
  /** URL patterns rendered from this collection, used for cache purging. `:slug` and `:lang` are substituted. */
  routes?: string[];
}

export interface Singleton {
  type: 'singleton';
  label: Label;
  fields: Record<string, Field>;
  routes?: string[];
}

export type ContentType = Collection | Singleton;

export function collection(def: Omit<Collection, 'type'>): Collection {
  return { type: 'collection', ...def };
}

export function singleton(def: Omit<Singleton, 'type'>): Singleton {
  return { type: 'singleton', ...def };
}

export interface TadweenConfig {
  site: string;
  locales: Locale[];
  defaultLocale?: Locale;
  content: Record<string, ContentType>;
}

export function defineConfig(config: TadweenConfig): TadweenConfig {
  return config;
}

/** Compiled, JSON-serializable schema snapshot stored in R2 as `schema.json`. */
export interface CompiledSchema {
  version: 1;
  site: string;
  locales: Locale[];
  defaultLocale: Locale;
  content: Record<string, ContentType>;
}

export function compileSchema(config: TadweenConfig): CompiledSchema {
  return {
    version: 1,
    site: config.site,
    locales: config.locales,
    defaultLocale: config.defaultLocale ?? config.locales[0] ?? 'ar',
    content: config.content,
  };
}

function fieldZod(field: Field, locales: Locale[]): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (field.kind) {
    case 'text':
    case 'textarea':
    case 'markdown':
    case 'image':
    case 'reference':
      base = z.string();
      break;
    case 'number':
      base = z.coerce.number();
      break;
    case 'boolean':
      base = z.coerce.boolean();
      break;
    case 'date':
      base = z.union([z.string(), z.date()]).transform((v) => new Date(v));
      break;
    case 'select':
      base = z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
      break;
    case 'list': {
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [name, f] of Object.entries(field.fields)) {
        shape[name] = fieldZod(f, locales);
      }
      base = z.array(z.object(shape));
      break;
    }
  }
  return field.required ? base : base.optional();
}

/**
 * Builds a zod schema for an entry's frontmatter. Bilingual fields are stored
 * with locale-suffixed keys (`title_ar`, `title_en`).
 */
export function frontmatterSchema(
  type: ContentType,
  locales: Locale[],
): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [name, field] of Object.entries(type.fields)) {
    if (field.kind === 'markdown') continue; // markdown fields live in the body
    if (field.bilingual) {
      for (const locale of locales) {
        shape[`${name}_${locale}`] = fieldZod({ ...field, required: false }, locales);
      }
    } else {
      shape[name] = fieldZod(field, locales);
    }
  }
  shape.status = z.enum(['draft', 'published']).default('published');
  return z.object(shape).passthrough();
}

/** Resolves a bilingual frontmatter object into a flat, locale-resolved one. */
export function resolveLocale(
  data: Record<string, unknown>,
  type: ContentType,
  locale: Locale,
  fallback: Locale,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(type.fields)) {
    if (field.kind === 'markdown') continue;
    if (field.bilingual) {
      out[name] = data[`${name}_${locale}`] ?? data[`${name}_${fallback}`];
    } else {
      out[name] = data[name];
    }
  }
  if ('status' in data) out.status = data.status;
  return out;
}
