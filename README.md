<div align="center">

# Tadween — تدوين

**The markdown-native CMS for Astro websites. Arabic-first, git-free, built for Cloudflare.**

_Tadween (تدوين) — the Arabic word for writing things down and recording them: exactly what this tool does._

[Documentation](#) · [Quick Start](#quick-start) · [Architecture](./ARCHITECTURE.md) · [العربية](#)

An open-source product by [ScaleUp](https://scaleup.sa)

</div>

---

## What is Tadween?

Tadween is **not a CMS** in the traditional sense. It is a minimal, production-grade content dashboard that lets non-technical clients edit the markdown files behind an Astro website — and see their changes live in seconds.

- **Markdown is the database.** Every piece of content — blog posts, portfolio projects, homepage sections — is a plain markdown file with frontmatter, stored in Cloudflare R2. No SQL schema, no migrations, no lock-in. Your content is always portable files.
- **Instant publishing, no rebuilds.** The Astro site runs in SSR mode on Cloudflare Workers, reading markdown from R2 at request time behind Cloudflare's edge cache. Saving a change purges the cache — the site reflects it on the next refresh. No build queues, no "why don't I see my edit?" support tickets.
- **Arabic-first, bilingual by design.** The dashboard UI is native RTL Arabic with full English support. Content fields are defined as `ar`/`en` pairs so bilingual sites are the default, not an afterthought.
- **Schema-driven forms, not a page builder.** You (the developer) define each content type's fields in a simple config file. Clients get clean, purpose-built forms — a title field, an image picker, a rich markdown editor — nothing they can break.
- **Git stays yours.** Clients never touch the repository. Code lives in git; content lives in R2. No GitHub accounts, no permissions headaches, no accidental force-pushes.

## Who is it for?

Agencies and freelancers who **sell Astro marketing sites** and need to hand clients a simple, safe way to edit content — especially in Arabic-speaking markets where existing git-based CMSs (Keystatic, Decap, Tina) fall short on RTL and bilingual support.

## How it works

```
 ┌─────────────┐   edits content    ┌──────────────────┐
 │   Client     │ ─────────────────▶ │  Tadween Dashboard │  (Cloudflare Worker)
 └─────────────┘   Arabic-first UI  └────────┬─────────┘
                                              │ writes .md files
                                              ▼
                                    ┌──────────────────┐
                                    │   Cloudflare R2   │  content/<site>/blog/hello.md
                                    └────────┬─────────┘
                                              │ reads at request time
                                              ▼
 ┌─────────────┐   cached at edge   ┌──────────────────┐
 │   Visitor    │ ◀───────────────── │   Astro site SSR  │  (Cloudflare Worker)
 └─────────────┘   purged on save   └──────────────────┘
```

1. Client logs into the Tadween dashboard (email + password or magic link).
2. They edit content through forms generated from your schema. Saving writes a markdown file to R2.
3. On save, Tadween purges the affected pages from the Cloudflare cache.
4. The Astro site — running SSR on Workers via `@tadween/astro` — renders the fresh markdown on the next request; every visit after that is served from cache at static-site speed.

## Packages

| Package               | What it is                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@tadween/dashboard`  | The content dashboard — a Cloudflare Worker app (auth, editor, media, publish). Deploy once, serve many sites. |
| `@tadween/astro`      | Astro integration: R2 content loader, collection helpers, image URLs, `tadween.config.ts` schema types.        |
| `@tadween/cli`        | `npx tadween init` — scaffolds config, provisions R2 bucket + Worker, creates the first admin user.            |
| `create-tadween-site` | Starter template: bilingual Astro marketing site pre-wired to Tadween.                                         |

## Quick start

```bash
# In your Astro project
npx tadween init          # provisions R2 + dashboard worker, writes tadween.config.ts
npm i @tadween/astro
```

```ts
// tadween.config.ts — define what your client can edit
import { defineConfig, collection, singleton, fields } from '@tadween/astro';

export default defineConfig({
  site: 'acme',
  locales: ['ar', 'en'],
  content: {
    blog: collection({
      label: { ar: 'المدونة', en: 'Blog' },
      slug: 'blog',
      fields: {
        title: fields.text({ bilingual: true, required: true }),
        cover: fields.image(),
        date: fields.date(),
        body: fields.markdown({ bilingual: true }),
      },
    }),
    home: singleton({
      label: { ar: 'الصفحة الرئيسية', en: 'Homepage' },
      fields: {
        heroTitle: fields.text({ bilingual: true }),
        heroImage: fields.image(),
        services: fields.list({
          fields: { name: fields.text({ bilingual: true }), icon: fields.text() },
        }),
      },
    }),
  },
});
```

```astro
---
// src/pages/[lang]/blog/[slug].astro
import { getEntry } from "@tadween/astro/content";
const post = await getEntry("blog", Astro.params.slug, Astro.params.lang);
---
<h1>{post.data.title}</h1>
<Fragment set:html={post.html} />
```

## Why not Keystatic / Decap / Payload / WordPress?

|                               | Tadween               | Keystatic / Decap                          | Payload / WordPress     |
| ----------------------------- | --------------------- | ------------------------------------------ | ----------------------- |
| Content storage               | Markdown files in R2  | Markdown in git                            | Database                |
| Client needs a GitHub account | No                    | Effectively yes (or complex OAuth proxies) | No                      |
| Publish latency               | Seconds (cache purge) | Minutes (rebuild)                          | Seconds                 |
| Arabic / RTL dashboard        | Native                | No                                         | Partial / plugins       |
| Bilingual fields              | First-class           | Manual                                     | Plugin-dependent        |
| Runtime footprint             | One Worker + R2       | None (but rebuild pipeline)                | Server + DB to maintain |
| Content portability           | Plain files           | Plain files                                | Export needed           |

## Production-ready

- Session-based auth with Argon2 password hashing, rate limiting, and optional magic-link login
- Per-site role isolation (multi-tenant: one dashboard, many client sites)
- Draft / published states with preview URLs
- Automatic content versioning (every save keeps the previous revision in R2)
- Media uploads to R2 with Cloudflare Image Transformations
- Zod-validated frontmatter — malformed content can never break the site
- Zero-downtime: the site serves cached pages even if the dashboard is down

## License

MIT © ScaleUp
