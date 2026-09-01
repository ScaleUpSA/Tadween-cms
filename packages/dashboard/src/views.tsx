import type { FC, PropsWithChildren } from 'hono/jsx';
import { splitBody, type CompiledSchema, type ContentType, type Field } from '@tadween/astro';
import type { Site, User } from './env.js';
import { dir, t, type UiLang } from './i18n.js';
import type { EntrySummary, LoadedEntry } from './store.js';
import { bodyField } from './forms.js';

const CSS = `
:root{--bg:#f7f6f3;--card:#fff;--ink:#1a1a1a;--muted:#6b6b6b;--accent:#0f6b4f;--accent-ink:#fff;--border:#e4e2dc;--danger:#b3261e}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,'Segoe UI',Tahoma,sans-serif;line-height:1.6}
a{color:var(--accent);text-decoration:none}
header{background:var(--card);border-bottom:1px solid var(--border);padding:.75rem 1.25rem;display:flex;align-items:center;gap:1rem;justify-content:space-between}
header .brand{font-weight:700;font-size:1.1rem}
main{max-width:56rem;margin:1.5rem auto;padding:0 1rem}
.card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;margin-bottom:1rem}
h1{font-size:1.4rem;margin:.2rem 0 1rem}
table{width:100%;border-collapse:collapse}
td,th{padding:.6rem .4rem;border-bottom:1px solid var(--border);text-align:start}
label{display:block;font-weight:600;margin:.9rem 0 .25rem}
input[type=text],input[type=email],input[type=password],input[type=number],input[type=date],select,textarea{width:100%;padding:.55rem .7rem;border:1px solid var(--border);border-radius:8px;font:inherit;background:#fff}
textarea{min-height:8rem}
textarea.md{min-height:16rem;font-family:ui-monospace,Consolas,monospace}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);border:none;border-radius:8px;padding:.55rem 1.1rem;font:inherit;font-weight:600;cursor:pointer}
.btn.secondary{background:transparent;color:var(--accent);border:1px solid var(--accent)}
.btn.danger{background:var(--danger)}
.row{display:flex;gap:.75rem;align-items:center;flex-wrap:wrap}
.badge{font-size:.78rem;border-radius:99px;padding:.1rem .6rem;background:#e8f2ee;color:var(--accent)}
.badge.draft{background:#fdf1d6;color:#8a6100}
.muted{color:var(--muted);font-size:.9rem}
.flash{border-radius:8px;padding:.7rem 1rem;margin-bottom:1rem;background:#e8f2ee;color:#0d4f3b}
.flash.error{background:#fbeae9;color:var(--danger)}
.locale-tag{font-size:.75rem;font-weight:400;color:var(--muted);margin-inline-start:.4rem}
.actions{margin-top:1.25rem;display:flex;gap:.75rem}
`;

export const Layout: FC<
  PropsWithChildren<{ lang: UiLang; title?: string; user?: User; site?: Site }>
> = ({ lang, title, user, site, children }) => (
  <html lang={lang} dir={dir(lang)}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>{title ? `${title} — ${t(lang, 'appName')}` : t(lang, 'appName')}</title>
      <style>{CSS}</style>
    </head>
    <body>
      <header>
        <div class="row">
          <span class="brand">{t(lang, 'appName')}</span>
          {site ? <a href={`/sites/${site.id}?lang=${lang}`}>{site.name}</a> : null}
        </div>
        <div class="row">
          <a href={`?lang=${lang === 'ar' ? 'en' : 'ar'}`}>
            {lang === 'ar' ? 'English' : 'العربية'}
          </a>
          {user ? (
            <form method="post" action="/logout">
              <button class="btn secondary" type="submit">
                {t(lang, 'logout')}
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main>{children}</main>
    </body>
  </html>
);

export const LoginPage: FC<{ lang: UiLang; error?: string }> = ({ lang, error }) => (
  <Layout lang={lang} title={t(lang, 'login')}>
    <div class="card" style="max-width:26rem;margin:3rem auto">
      <h1>{t(lang, 'login')}</h1>
      {error ? <div class="flash error">{error}</div> : null}
      <form method="post" action={`/login?lang=${lang}`}>
        <label for="email">{t(lang, 'email')}</label>
        <input id="email" name="email" type="email" required autocomplete="email" />
        <label for="password">{t(lang, 'password')}</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
        />
        <div class="actions">
          <button class="btn" type="submit">
            {t(lang, 'login')}
          </button>
        </div>
      </form>
    </div>
  </Layout>
);

export const SitesPage: FC<{ lang: UiLang; user: User; sites: Site[] }> = ({
  lang,
  user,
  sites,
}) => (
  <Layout lang={lang} title={t(lang, 'sites')} user={user}>
    <h1>{t(lang, 'sites')}</h1>
    {sites.map((site) => (
      <div class="card row" style="justify-content:space-between">
        <a href={`/sites/${site.id}?lang=${lang}`} style="font-weight:600">
          {site.name}
        </a>
        {site.base_url ? (
          <a class="muted" href={site.base_url} target="_blank">
            {t(lang, 'openSite')} ↗
          </a>
        ) : null}
      </div>
    ))}
  </Layout>
);

const label = (l: { ar: string; en: string }, lang: UiLang) => l[lang] ?? l.ar;

export const SiteHome: FC<{ lang: UiLang; user: User; site: Site; schema: CompiledSchema }> = ({
  lang,
  user,
  site,
  schema,
}) => (
  <Layout lang={lang} title={site.name} user={user} site={site}>
    <h1>{t(lang, 'content')}</h1>
    {Object.entries(schema.content).map(([key, type]) => (
      <div class="card row" style="justify-content:space-between">
        <a href={`/sites/${site.id}/${key}?lang=${lang}`} style="font-weight:600">
          {label(type.label, lang)}
        </a>
        <span class="muted">{type.type === 'singleton' ? '—' : ''}</span>
      </div>
    ))}
  </Layout>
);

export const CollectionPage: FC<{
  lang: UiLang;
  user: User;
  site: Site;
  typeKey: string;
  type: ContentType;
  entries: EntrySummary[];
}> = ({ lang, user, site, typeKey, type, entries }) => (
  <Layout lang={lang} title={label(type.label, lang)} user={user} site={site}>
    <div class="row" style="justify-content:space-between">
      <h1>{label(type.label, lang)}</h1>
      <a class="btn" href={`/sites/${site.id}/${typeKey}/new?lang=${lang}`}>
        {t(lang, 'newEntry')}
      </a>
    </div>
    <div class="card">
      {entries.length === 0 ? (
        <p class="muted">{t(lang, 'noEntries')}</p>
      ) : (
        <table>
          <tbody>
            {entries.map((entry) => (
              <tr>
                <td>
                  <a href={`/sites/${site.id}/${typeKey}/${entry.slug}?lang=${lang}`}>
                    {entry.title}
                  </a>
                </td>
                <td class="muted">{entry.slug}</td>
                <td>
                  {entry.status === 'published' ? (
                    <span class="badge">{t(lang, 'published')}</span>
                  ) : null}{' '}
                  {entry.hasDraft ? <span class="badge draft">{t(lang, 'draft')}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </Layout>
);

const FieldInput: FC<{
  name: string;
  inputName: string;
  field: Field;
  value: unknown;
  lang: UiLang;
  localeTag?: string;
}> = ({ inputName, field, value, localeTag }) => {
  const val = value === undefined || value === null ? '' : String(value);
  switch (field.kind) {
    case 'textarea':
      return <textarea name={inputName}>{val}</textarea>;
    case 'markdown':
      return (
        <textarea class="md" name={inputName} dir="auto" placeholder={localeTag}>
          {val}
        </textarea>
      );
    case 'number':
      return <input type="number" name={inputName} value={val} />;
    case 'boolean':
      return <input type="checkbox" name={inputName} checked={value === true} />;
    case 'date':
      return <input type="date" name={inputName} value={val.slice(0, 10)} />;
    case 'select':
      return (
        <select name={inputName}>
          <option value=""></option>
          {field.options.map((o) => (
            <option value={o.value} selected={val === o.value}>
              {o.label.ar} / {o.label.en}
            </option>
          ))}
        </select>
      );
    case 'list':
      return <textarea name={inputName}>{value ? JSON.stringify(value, null, 2) : ''}</textarea>;
    case 'image':
    case 'text':
    default:
      return <input type="text" name={inputName} value={val} dir="auto" />;
  }
};

export const EntryForm: FC<{
  lang: UiLang;
  user: User;
  site: Site;
  schema: CompiledSchema;
  typeKey: string;
  type: ContentType;
  slug?: string;
  entry: LoadedEntry;
  csrf: string;
  flash?: { text: string; error?: boolean };
  previewUrl?: string;
}> = ({ lang, user, site, schema, typeKey, type, slug, entry, csrf, flash, previewUrl }) => {
  const isNew = type.type === 'collection' && !slug;
  const action = `/sites/${site.id}/${typeKey}/${isNew ? 'new' : (slug ?? '_singleton')}?lang=${lang}`;
  const body = bodyField(type);
  const bodySections = body ? splitBody(entry.body, schema.defaultLocale) : {};

  return (
    <Layout lang={lang} title={label(type.label, lang)} user={user} site={site}>
      <div class="row" style="justify-content:space-between">
        <h1>
          {label(type.label, lang)}
          {slug ? <span class="locale-tag">/{slug}</span> : null}
        </h1>
        <div class="row">
          {entry.hasOwnProperty('isDraft') && entry.isDraft ? (
            <span class="badge draft">{t(lang, 'draft')}</span>
          ) : null}
          {previewUrl ? (
            <a class="btn secondary" href={previewUrl} target="_blank">
              {t(lang, 'preview')}
            </a>
          ) : null}
        </div>
      </div>
      {flash ? <div class={flash.error ? 'flash error' : 'flash'}>{flash.text}</div> : null}
      <form method="post" action={action}>
        <input type="hidden" name="_csrf" value={csrf} />
        <div class="card">
          {isNew ? (
            <>
              <label for="_slug">{t(lang, 'slug')}</label>
              <input id="_slug" name="_slug" type="text" required pattern="[a-z0-9\-]+" dir="ltr" />
            </>
          ) : null}
          {Object.entries(type.fields).map(([name, field]) => {
            if (field.kind === 'markdown') return null;
            if (field.bilingual) {
              return (
                <>
                  {schema.locales.map((locale) => (
                    <>
                      <label>
                        {label(field.label ?? { ar: name, en: name }, lang)}
                        <span class="locale-tag">{locale}</span>
                      </label>
                      <FieldInput
                        name={name}
                        inputName={`${name}__${locale}`}
                        field={field}
                        value={entry.data[`${name}_${locale}`]}
                        lang={lang}
                      />
                    </>
                  ))}
                </>
              );
            }
            return (
              <>
                <label>{label(field.label ?? { ar: name, en: name }, lang)}</label>
                <FieldInput
                  name={name}
                  inputName={name}
                  field={field}
                  value={entry.data[name]}
                  lang={lang}
                />
              </>
            );
          })}
        </div>
        {body ? (
          <div class="card">
            {body.field.bilingual ? (
              schema.locales.map((locale) => (
                <>
                  <label>
                    {label(body.field.label ?? { ar: 'المحتوى', en: 'Content' }, lang)}
                    <span class="locale-tag">{locale}</span>
                  </label>
                  <FieldInput
                    name={body.name}
                    inputName={`${body.name}__${locale}`}
                    field={body.field}
                    value={bodySections[locale] ?? ''}
                    lang={lang}
                  />
                </>
              ))
            ) : (
              <>
                <label>{label(body.field.label ?? { ar: 'المحتوى', en: 'Content' }, lang)}</label>
                <FieldInput
                  name={body.name}
                  inputName={body.name}
                  field={body.field}
                  value={entry.body}
                  lang={lang}
                />
              </>
            )}
          </div>
        ) : null}
        <div class="actions">
          <button class="btn secondary" type="submit" name="_action" value="draft">
            {t(lang, 'save')}
          </button>
          <button class="btn" type="submit" name="_action" value="publish">
            {t(lang, 'publish')}
          </button>
          {!isNew && type.type === 'collection' ? (
            <button
              class="btn danger"
              type="submit"
              name="_action"
              value="delete"
              onclick={`return confirm('${t(lang, 'deleteConfirm')}')`}
            >
              {t(lang, 'delete')}
            </button>
          ) : null}
        </div>
      </form>
    </Layout>
  );
};
