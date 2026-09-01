import { describe, expect, it } from 'vitest';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
import { joinBody, renderMarkdown, splitBody } from './markdown.js';
import { collection, fields, frontmatterSchema, resolveLocale } from './schema.js';

describe('frontmatter', () => {
  it('round-trips data and body', () => {
    const raw = serializeFrontmatter({ title_ar: 'مرحبا', date: '2026-09-01' }, '# Hello');
    const parsed = parseFrontmatter(raw);
    expect(parsed.data.title_ar).toBe('مرحبا');
    expect(parsed.body.trim()).toBe('# Hello');
  });

  it('handles files without frontmatter', () => {
    expect(parseFrontmatter('just text')).toEqual({ data: {}, body: 'just text' });
  });
});

describe('bilingual body', () => {
  it('splits on tadween locale delimiters', () => {
    const body = 'نص عربي\n\n<!-- tadween:en -->\n\nEnglish text';
    expect(splitBody(body, 'ar')).toEqual({ ar: 'نص عربي', en: 'English text' });
  });

  it('joins sections back with delimiters', () => {
    const joined = joinBody({ ar: 'عربي', en: 'English' }, 'ar');
    expect(splitBody(joined, 'ar')).toEqual({ ar: 'عربي', en: 'English' });
  });
});

describe('markdown rendering', () => {
  it('renders markdown and escapes raw HTML', () => {
    const html = renderMarkdown('# Title\n\n<script>alert(1)</script>');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).not.toContain('<script>');
  });
});

describe('schema validation', () => {
  const blog = collection({
    label: { ar: 'المدونة', en: 'Blog' },
    slug: 'blog',
    fields: {
      title: fields.text({ bilingual: true, required: true }),
      date: fields.date(),
      body: fields.markdown({ bilingual: true }),
    },
  });

  it('validates bilingual frontmatter keys', () => {
    const schema = frontmatterSchema(blog, ['ar', 'en']);
    const result = schema.safeParse({ title_ar: 'مرحبا', title_en: 'Hello', date: '2026-09-01' });
    expect(result.success).toBe(true);
  });

  it('resolves locale with fallback', () => {
    const data = { title_ar: 'مرحبا', status: 'published' };
    expect(resolveLocale(data, blog, 'en', 'ar').title).toBe('مرحبا');
    expect(resolveLocale(data, blog, 'ar', 'ar').title).toBe('مرحبا');
  });
});
