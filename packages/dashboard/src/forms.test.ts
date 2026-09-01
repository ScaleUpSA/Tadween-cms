import { describe, expect, it } from 'vitest';
import { slugify, transliterateArabic } from './forms.js';

describe('transliterateArabic', () => {
  it('maps Arabic letters to Latin', () => {
    expect(transliterateArabic('تدوين')).toBe('tdwyn');
    expect(transliterateArabic('مرحبا')).toBe('mrhba');
  });

  it('maps Arabic-Indic digits', () => {
    expect(transliterateArabic('٢٠٢٦')).toBe('2026');
  });

  it('passes Latin through unchanged', () => {
    expect(transliterateArabic('hello')).toBe('hello');
  });
});

describe('slugify', () => {
  it('produces URL-safe slugs from Arabic titles', () => {
    expect(slugify('فيلا النور')).toBe('fyla-alnwr');
    expect(slugify('مشروع ٢٠٢٦')).toBe('mshrwa-2026');
  });

  it('normalizes Latin input', () => {
    expect(slugify('  Hello,  World!  ')).toBe('hello-world');
  });

  it('caps slug length', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});
