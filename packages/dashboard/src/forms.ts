import { joinBody, type CompiledSchema, type ContentType, type Field } from '@tadween/astro';

export interface FormResult {
  data: Record<string, unknown>;
  body: string;
  errors: string[];
}

/** The markdown field whose content becomes the file body (first markdown field). */
export function bodyField(type: ContentType): { name: string; field: Field } | null {
  for (const [name, field] of Object.entries(type.fields)) {
    if (field.kind === 'markdown') return { name, field };
  }
  return null;
}

function parseScalar(field: Field, raw: string): unknown {
  switch (field.kind) {
    case 'number':
      return raw === '' ? undefined : Number(raw);
    case 'boolean':
      return raw === 'on' || raw === 'true';
    default:
      return raw;
  }
}

/**
 * Converts a submitted entry form into frontmatter data + markdown body
 * according to the content type's schema. Bilingual fields arrive as
 * `<name>__<locale>` inputs and are stored as `<name>_<locale>` keys.
 */
export function parseEntryForm(
  form: FormData,
  type: ContentType,
  schema: CompiledSchema,
): FormResult {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  const body = bodyField(type);

  const get = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : '';
  };

  for (const [name, field] of Object.entries(type.fields)) {
    if (field.kind === 'markdown') continue;
    if (field.kind === 'list') {
      const raw = get(name).trim();
      if (!raw) continue;
      try {
        data[name] = JSON.parse(raw);
      } catch {
        errors.push(`${name}: invalid JSON`);
      }
      continue;
    }
    if (field.bilingual) {
      for (const locale of schema.locales) {
        const value = parseScalar(field, get(`${name}__${locale}`));
        if (value !== undefined && value !== '') data[`${name}_${locale}`] = value;
      }
      if (field.required && !schema.locales.some((l) => data[`${name}_${l}`])) {
        errors.push(name);
      }
    } else {
      const value = parseScalar(field, get(name));
      if (field.kind === 'boolean') {
        data[name] = value;
      } else if (value !== undefined && value !== '') {
        data[name] = value;
      } else if (field.required) {
        errors.push(name);
      }
    }
  }

  let bodyText = '';
  if (body) {
    if (body.field.bilingual) {
      const sections: Record<string, string> = {};
      for (const locale of schema.locales) {
        const value = get(`${body.name}__${locale}`);
        if (value.trim()) sections[locale] = value.trim();
      }
      bodyText = joinBody(sections, schema.defaultLocale);
    } else {
      bodyText = get(body.name).trim();
    }
  }

  return { data, body: bodyText, errors };
}

const ARABIC_TO_LATIN: Record<string, string> = {
  ا: 'a',
  أ: 'a',
  إ: 'i',
  آ: 'a',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'j',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'dh',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  و: 'w',
  ي: 'y',
  ى: 'a',
  ة: 'h',
  ء: '',
  ؤ: 'w',
  ئ: 'y',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

/** Transliterates Arabic text so slugs stay URL-safe Latin. */
export function transliterateArabic(input: string): string {
  return [...input].map((ch) => ARABIC_TO_LATIN[ch] ?? ch).join('');
}

export function slugify(input: string): string {
  return transliterateArabic(input)
    .toLowerCase()
    .trim()
    .replace(/[\u064b-\u065f\u0670]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
