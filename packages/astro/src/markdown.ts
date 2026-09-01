import { Marked } from 'marked';

const LOCALE_DELIMITER = /<!--\s*tadween:(\w+)\s*-->/g;

/**
 * Splits a bilingual markdown body into per-locale sections. The body starts
 * in the default locale; `<!-- tadween:xx -->` comments switch locale.
 */
export function splitBody(body: string, defaultLocale: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let current = defaultLocale;
  let lastIndex = 0;
  for (const match of body.matchAll(LOCALE_DELIMITER)) {
    sections[current] = ((sections[current] ?? '') + body.slice(lastIndex, match.index)).trim();
    current = match[1] ?? defaultLocale;
    lastIndex = match.index + match[0].length;
  }
  sections[current] = ((sections[current] ?? '') + body.slice(lastIndex)).trim();
  return sections;
}

export function joinBody(sections: Record<string, string>, defaultLocale: string): string {
  const locales = Object.keys(sections);
  const ordered = [defaultLocale, ...locales.filter((l) => l !== defaultLocale)];
  return ordered
    .filter((l) => sections[l] !== undefined)
    .map((l, i) => (i === 0 ? sections[l] : `<!-- tadween:${l} -->\n\n${sections[l]}`))
    .join('\n\n');
}

const escapeHtml = (html: string) =>
  html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Renders markdown to HTML. Raw HTML in content is escaped so editor content
 * can never inject scripts into the site.
 */
const md = new Marked({
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
});

export function renderMarkdown(markdown: string): string {
  return md.parse(markdown, { async: false }) as string;
}
