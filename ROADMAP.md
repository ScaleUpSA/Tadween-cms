# Tadween — Implementation Plan & Roadmap

## Repository layout (monorepo)

```
tadween/
  packages/
    dashboard/        # @tadween/dashboard — Hono + HTMX Worker app
    astro/            # @tadween/astro — integration, loaders, field/schema types
    cli/              # @tadween/cli — init, push-schema, user management, export/import
    create-tadween-site/  # bilingual Astro starter template
  examples/
    marketing-site/   # full demo: homepage singleton + blog + projects, ar/en
  docs/               # docs site (Astro Starlight, ar + en)
  README.md  README.ar.md  ARCHITECTURE.md  LICENSE (MIT)  CONTRIBUTING.md
```

Tooling: pnpm workspaces, TypeScript strict, Vitest + Miniflare for Worker tests, Playwright for dashboard e2e, ESLint + Prettier, Changesets for versioned npm releases, GitHub Actions CI (lint, typecheck, test, publish on tag).

## Milestones

### M1 — Core loop (MVP, ~1 session)

The full edit→publish→see-it-live loop working end to end.

- `@tadween/astro`: schema definition (`defineConfig`, `collection`, `singleton`, `fields.*`), R2 content loader (`getCollection`/`getEntry`/`getSingleton`), markdown rendering + sanitization, edge-cache middleware
- `@tadween/dashboard`: email+password auth (Argon2id, D1 sessions, rate limiting), collection list + entry form views generated from `schema.json`, markdown editor with preview, save→R2 write→cache purge
- `@tadween/cli`: `init` (wrangler provisioning: R2 buckets, D1, dashboard deploy, first admin user), `push-schema`
- Example site wired up; deploy guide
- **Exit criterion: a non-technical user can log in, edit the homepage hero in Arabic, hit publish, and see it on the live site within 10 seconds.**

### M2 — Production hardening (~1 session)

Everything needed before putting real clients on it.

- Drafts + signed preview mode on the live site
- Automatic revisions + one-click revert
- Media library: upload to R2, browse, image transformations, alt text (ar/en)
- Audit log UI; CSRF; upload validation; session revocation
- `list` (repeatable) and `reference` fields
- Full Arabic dashboard localization pass (RTL audit, Hijri date display, Arabic slug transliteration)
- `tadween export` / `tadween import` (content portability guarantee)

### M3 — Multi-tenant & polish (~1 session)

- Sites management UI (register site, hostnames, invite editors, per-site roles)
- Magic-link login; password reset via email
- Dashboard theming (logo/colors per agency — white-label)
- Scheduled publishing (Workers cron)
- SEO fields preset (meta title/description ar/en, OG image) as a reusable field group

### M4 — Open-source launch

- Docs site (English + Arabic) with quick start, field reference, deployment guide, "migrating from Keystatic/Decap" guide
- Demo video + hosted playground
- GitHub: issue templates, CONTRIBUTING, code of conduct, security policy
- Publish all packages to npm under the `@tadween` org; `npx create-tadween-site`
- Launch posts (Astro Discord/showcase, Arabic dev communities, X)

## Deliberate non-goals (keep it simple — this is the product)

- No page builder / drag-and-drop layout — structure lives in Astro code
- No content database or GraphQL API — files are the API
- No plugin system in v1
- No comments, forms, or e-commerce — out of scope for marketing sites
- No self-serve SaaS hosting in v1 (open-source, deploy-to-your-own-Cloudflare; a hosted offering can come later as the commercial layer)

## Open decisions for you

1. **Name** — **Tadween (تدوين)**, confirmed free on npm.
2. **npm scope** — `@tadween/*` vs `@scaleup/tadween-*`.
3. **GitHub org** — ScaleUpSA (recommended for the open-source brand) vs personal.
4. **Editor email delivery** (magic links / password reset) — Resend (needs API key) vs MailChannels (free from Workers).
