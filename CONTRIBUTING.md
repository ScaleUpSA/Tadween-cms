# Contributing to Tadween

Thanks for your interest in improving Tadween! Contributions of all kinds are welcome: bug reports, docs, translations, and code.

## Development setup

Requirements: Node 20+ and pnpm 10 (`corepack enable`).

```bash
git clone https://github.com/ScaleUpSA/Tadween-cms.git
cd Tadween-cms
pnpm install
pnpm build       # build all packages
pnpm test        # run tests
pnpm typecheck   # typecheck all workspaces
pnpm lint        # prettier --check
```

The repo is a pnpm monorepo:

| Path                           | Package                                       |
| ------------------------------ | --------------------------------------------- |
| `packages/astro`               | `@tadween/astro` — schema, loader, middleware |
| `packages/dashboard`           | `@tadween/dashboard` — the dashboard Worker   |
| `packages/cli`                 | `@tadween/cli` — provisioning CLI             |
| `packages/create-tadween-site` | `create-tadween-site` — project scaffolder    |
| `examples/marketing-site`      | Bilingual example site                        |

## Making changes

1. Fork and create a feature branch.
2. Keep changes focused; match the existing code style (Prettier enforces formatting — run `pnpm format`).
3. Add or update tests where it makes sense (`vitest`).
4. Make sure `pnpm lint && pnpm typecheck && pnpm build && pnpm test` all pass.
5. Open a pull request describing **what** changed and **why**.

## Arabic and RTL

Tadween is Arabic-first. UI strings live in `packages/dashboard/src/i18n.ts` and must always be provided in both Arabic and English. When touching dashboard UI, verify it renders correctly in RTL (`?lang=ar`) and LTR (`?lang=en`).

## Reporting bugs and requesting features

Please use the [issue templates](https://github.com/ScaleUpSA/Tadween-cms/issues/new/choose). For security issues, see [SECURITY.md](./SECURITY.md) — do **not** open a public issue.

## License

By contributing you agree that your contributions are licensed under the [MIT License](./LICENSE).
