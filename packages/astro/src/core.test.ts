import { describe, expect, it } from 'vitest';
import { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
import { joinBody, renderMarkdown, splitBody } from './markdown.js';
import { collection, fields, frontmatterSchema, resolveLocale, seoFields } from './schema.js';

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

describe('seo field group', () => {
  it('provides bilingual meta fields and an og image', () => {
    const group = seoFields();
    expect(Object.keys(group)).toEqual(['seo_title', 'seo_description', 'og_image']);
    expect(group.seo_title).toMatchObject({ kind: 'text', bilingual: true });
    expect(group.seo_description).toMatchObject({ kind: 'textarea', bilingual: true });
    expect(group.og_image).toMatchObject({ kind: 'image' });
  });

  it('resolves locale-suffixed seo values', () => {
    const type = collection({
      label: { ar: 'مدونة', en: 'Blog' },
      slug: 'blog',
      fields: { title: fields.text({ bilingual: true }), ...seoFields() },
    });
    const resolved = resolveLocale(
      { title_ar: 'عنوان', seo_title_ar: 'سيو', seo_title_en: 'seo', og_image: 'x.png' },
      type,
      'ar',
      'en',
    );
    expect(resolved.seo_title).toBe('سيو');
    expect(resolved.og_image).toBe('x.png');
  });
});
