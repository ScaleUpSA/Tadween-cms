# Tadween Architecture

## Design principles

1. **Markdown files are the single source of truth.** No database of record for content. D1 is used only for auth/sessions/audit — never for content.
2. **The site must survive the CMS.** If the dashboard is deleted, the Astro site keeps serving from R2 + cache. Content is always exportable as a folder of `.md` files.
3. **Static-site economics, dynamic-site freshness.** Every page is served from Cloudflare's edge cache; the Worker only renders on cache miss (first hit after a publish). Clients see edits in seconds; hosting costs stay near zero.
4. **The developer defines structure; the client only fills it in.** All schemas live in code (`tadween.config.ts`), reviewed in git. The client can never change structure, only content.
5. **Arabic-first.** RTL layout, Arabic microcopy, Hijri-aware date display, bilingual field pairs as the default content model.

## System overview

```
                        ┌───────────────────────────────────────────┐
                        │              Cloudflare account            │
                        │                                            │
 Client (editor) ──────▶│  Dashboard Worker (@tadween/dashboard)      │
                        │   ├─ Hono + JSX/HTMX UI (RTL, ar/en)       │
                        │   ├─ D1: users, sessions, sites, audit log │
                        │   ├─ R2 (content bucket): read/write .md   │
                        │   ├─ R2 (media bucket): uploads            │
                        │   └─ CF API: purge cache on publish        │
                        │                                            │
 Visitor ──────────────▶│  Site Worker (Astro SSR + @tadween/astro)   │
                        │   ├─ Edge cache (Cache API + Cache Rules)  │
                        │   ├─ R2 binding: read published .md        │
                        │   └─ markdown → HTML at request time       │
                        └───────────────────────────────────────────┘
```

Two Workers, one R2 content bucket (shared, prefix-isolated per site), one media bucket, one D1 database. The dashboard is **multi-tenant**: one deployment serves every client site in the account; each site is isolated by an R2 key prefix and D1 row-level `site_id` scoping.

## Content model

### Storage layout (R2, content bucket)

```
<site>/
  content/
    blog/
      hello-world.md            # published
    projects/
      villa-al-noor.md
    singletons/
      home.md
      about.md
  drafts/
    blog/
      upcoming-post.md          # draft — invisible to the site worker
  revisions/
    blog/hello-world/
      2026-09-01T08-11-02Z.md   # automatic version history (last N kept)
  media-index.json
  schema.json                   # compiled snapshot of tadween.config.ts
```

### File format

Plain markdown + YAML frontmatter. Bilingual fields use suffixed keys; bilingual bodies use a delimiter:

```markdown
---
title_ar: 'مرحبا بالعالم'
title_en: 'Hello World'
date: 2026-09-01
cover: media/blog/hello-cover.jpg
status: published
---

النص العربي هنا...

<!-- tadween:en -->

English body here...
```

Rationale: one file per entry (not per locale) keeps ar/en in sync, makes the folder human-readable, and means a bilingual entry can never be half-missing.

### Schema

`tadween.config.ts` in the Astro repo defines collections (many entries), singletons (one entry — homepage, about, settings), and fields:

`text`, `textarea`, `markdown` (rich editor), `number`, `boolean`, `date`, `select`, `image`, `list` (repeatable groups), `reference` (link to another collection entry). Any field can be `bilingual: true` (rendered as paired ar/en inputs) and `required`.

On `astro build` / `tadween push-schema`, the config is compiled to `schema.json` and uploaded to R2. The dashboard reads `schema.json` to render forms — so the dashboard needs **zero redeploys** when a site's content model changes.

Frontmatter is validated with Zod (generated from the schema) on both write (dashboard) and read (site loader). A file that fails validation is skipped with a logged warning — malformed content can never take the site down.

## Dashboard Worker

**Stack:** Hono (router) + server-rendered JSX with HTMX for interactivity. Deliberately not a SPA: no client build step, tiny payloads, works flawlessly RTL, easy to theme. The markdown editor is a progressively-enhanced textarea with a formatting toolbar and live preview (using the same renderer as the site, so preview = truth).

**Auth (production-grade, self-contained — no third-party auth service):**

- Email + password (Argon2id via WebCrypto-compatible impl) and optional magic-link login (email via Resend/MailChannels)
- Sessions: httpOnly secure cookies, D1-backed, 30-day sliding expiry, revocable
- Rate limiting on login (Durable Object or KV counter), lockout after repeated failures
- Roles: `owner` (you — all sites, manage users), `editor` (per-site content only)
- Full audit log: who changed what file, when, with diff stored in revisions

**Editing flow:**

1. Editor opens a collection → list view from R2 `list()` (frontmatter parsed for titles/dates/status).
2. Opens an entry → form generated from `schema.json`.
3. **Save draft** → writes to `drafts/…`. Site is untouched. A preview link renders the draft through the site worker with a signed token (`?tadween-preview=<jwt>`).
4. **Publish** → current published file copied to `revisions/…`, draft moved to `content/…`, then cache purge (see below). The client refreshes the site and sees the change.
5. **Revert** → any revision can be restored in one click.

**Media:** uploads go to the media R2 bucket (`<site>/media/…`), served through Cloudflare Image Transformations (`/cdn-cgi/image/…`) for on-the-fly resizing. The image field stores the R2 key; `@tadween/astro` exposes `imageUrl(key, { width, format })`.

## Site Worker (`@tadween/astro`)

An Astro integration + runtime for `@astrojs/cloudflare` (SSR):

- **Content API:** `getCollection("blog", lang)`, `getEntry("blog", slug, lang)`, `getSingleton("home", lang)` — reads the R2 binding, parses frontmatter (typed from the same schema), renders markdown to HTML with `marked`/`markdown-it` + sanitization. Results are memoized per-isolate.
- **Edge caching:** middleware wraps every HTML response with `Cache-Control: public, s-maxage=31536000` + a Cache Rule (or Cache API `caches.default`) keyed by URL. Effectively a static site: R2 reads and markdown rendering happen only on the first request after a purge.
- **Preview mode:** a signed `?tadween-preview` token switches reads to `drafts/` and bypasses cache — editors see drafts on the real site before publishing.
- **Graceful degradation:** on R2 error, serve stale from cache; on missing entry, 404 as usual.

## Purge-on-publish

On publish, the dashboard:

1. Resolves affected URLs from the schema's route mapping (`blog` → `/ar/blog/<slug>`, `/en/blog/<slug>`, `/ar/blog`, `/en/blog`, plus configured extras like the homepage for singletons).
2. Calls the Cloudflare cache-purge API for those URLs (zone-scoped token). Fallback: purge-everything for the site's hostname.
3. Repeated saves are harmless: purge is free and instant — no build queue, no 5-builds-in-a-minute problem.

## Multi-tenancy & isolation

- One dashboard deployment; sites registered in D1 (`sites` table: id, name, hostnames, R2 prefix, purge zone).
- Every R2 operation is prefix-scoped server-side by the session's site grants — an editor for site A cannot list or read site B's keys.
- Each client site is its own Worker + hostname; only the shared content bucket connects them (read-only binding, own prefix).
- Optional single-tenant mode: deploy one dashboard per client with `SITE_ID` pinned (for clients who want it under their own Cloudflare account).

## Security checklist

- Argon2id password hashing; constant-time comparison; no password hints
- CSRF tokens on all mutating routes; SameSite=Lax cookies
- Signed preview JWTs, short-lived (15 min)
- Markdown HTML output sanitized (no raw `<script>` from content)
- Upload validation: MIME sniffing, size limits, image-only by default
- Zone API token scoped to cache-purge only, stored as a Worker secret
- Audit log is append-only

## Cost profile (per client site, typical marketing traffic)

| Resource         | Usage                        | Cost                 |
| ---------------- | ---------------------------- | -------------------- |
| Site Worker      | ~cache-miss-only invocations | Free tier / pennies  |
| Dashboard Worker | A few hundred req/day        | Free tier            |
| R2               | MBs of markdown + media      | ~$0 (no egress fees) |
| D1               | Auth + audit rows            | Free tier            |
| Cache purge      | Per publish                  | Free                 |

Effectively the same bill as a static site.

## Failure modes

| Failure                            | Effect                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Dashboard down                     | Site unaffected (serves from cache/R2)                                     |
| R2 read error                      | Site serves stale cached pages                                             |
| Bad content saved                  | Zod rejects at save time; if it slips through, loader skips the file       |
| Purge API fails                    | Retry with backoff; worst case content appears when cache TTL rule expires |
| Client deletes an entry by mistake | Restore from `revisions/` in one click                                     |
