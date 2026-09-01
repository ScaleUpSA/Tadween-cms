import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export interface ParsedFile {
  data: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(raw: string): ParsedFile {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  const data = (parseYaml(match[1] ?? '') ?? {}) as Record<string, unknown>;
  return { data, body: raw.slice(match[0].length).replace(/^\r?\n/, '') };
}

export function serializeFrontmatter(data: Record<string, unknown>, body: string): string {
  return `---\n${stringifyYaml(data).trimEnd()}\n---\n\n${body.trim()}\n`;
}
