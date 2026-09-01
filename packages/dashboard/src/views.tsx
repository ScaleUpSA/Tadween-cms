import type { FC, PropsWithChildren } from 'hono/jsx';
import { splitBody, type CompiledSchema, type ContentType, type Field } from '@tadween/astro';
import type { Site, User } from './env.js';
import { dir, t, type UiLang } from './i18n.js';
import type { AuditRow, ScheduledPublish, UserRow } from './db.js';
import type { EntrySummary, LoadedEntry, MediaFile, RevisionSummary } from './store.js';
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
  PropsWithChildren<{ lang: UiLang; title?: string; user?: User; site?: Site; brand?: string }>
> = ({ lang, title, user, site, brand, children }) => (
  <html lang={lang} dir={dir(lang)}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>
        {title ? `${title} — ${brand ?? t(lang, 'appName')}` : (brand ?? t(lang, 'appName'))}
      </title>
      <style>{CSS}</style>
      {site?.theme_accent ? <style>{`:root{--accent:${site.theme_accent}}`}</style> : null}
    </head>
    <body>
      <header>
        <div class="row">
          {site?.logo_url ? (
            <img src={site.logo_url} alt="" style="height:28px;border-radius:6px" />
          ) : null}
          <span class="brand">{brand ?? t(lang, 'appName')}</span>
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
              <button class="btn secondary" type="submit" name="all" value="1">
                {t(lang, 'logoutAll')}
              </button>
            </form>
          ) : null}
        </div>
      </header>
      <main>{children}</main>
    </body>
  </html>
);

export const LoginPage: FC<{ lang: UiLang; error?: string; notice?: string }> = ({
  lang,
  error,
  notice,
}) => (
  <Layout lang={lang} title={t(lang, 'login')}>
    <div class="card" style="max-width:26rem;margin:3rem auto">
      <h1>{t(lang, 'login')}</h1>
      {error ? <div class="flash error">{error}</div> : null}
      {notice ? <div class="flash">{notice}</div> : null}
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
        <div class="row" style="margin-top:1rem;justify-content:space-between">
          <button
            class="btn secondary"
            type="submit"
            formaction={`/login/magic?lang=${lang}`}
            formnovalidate
          >
            {t(lang, 'magicLink')}
          </button>
          <button
            class="btn secondary"
            type="submit"
            formaction={`/login/reset?lang=${lang}`}
            formnovalidate
          >
            {t(lang, 'forgotPassword')}
          </button>
        </div>
      </form>
    </div>
  </Layout>
);

export const ResetPasswordPage: FC<{ lang: UiLang; token: string; error?: string }> = ({
  lang,
  token,
  error,
}) => (
  <Layout lang={lang} title={t(lang, 'resetPassword')}>
    <div class="card" style="max-width:26rem;margin:3rem auto">
      <h1>{t(lang, 'resetPassword')}</h1>
      {error ? <div class="flash error">{error}</div> : null}
      <form method="post" action={`/login/reset/${token}?lang=${lang}`}>
        <label for="password">{t(lang, 'newPassword')}</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minlength={8}
          autocomplete="new-password"
        />
        <div class="actions">
          <button class="btn" type="submit">
            {t(lang, 'resetPassword')}
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
    {user.role === 'owner' ? (
      <div class="card row">
        <a href={`/admin/sites?lang=${lang}`}>{t(lang, 'manageSites')}</a>
        <a href={`/admin/users?lang=${lang}`}>{t(lang, 'manageUsers')}</a>
      </div>
    ) : null}
  </Layout>
);

const label = (l: { ar: string; en: string }, lang: UiLang) => l[lang] ?? l.ar;

export const SiteHome: FC<{
  lang: UiLang;
  user: User;
  site: Site;
  schema: CompiledSchema;
  scheduled: ScheduledPublish[];
  csrf: string;
}> = ({ lang, user, site, schema, scheduled, csrf }) => (
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
    <div class="card row">
      <a href={`/sites/${site.id}/_media?lang=${lang}`}>{t(lang, 'mediaLibrary')}</a>
      {user.role === 'owner' ? (
        <>
          <a href={`/sites/${site.id}/_audit?lang=${lang}`}>{t(lang, 'auditLog')}</a>
          <a href={`/sites/${site.id}/_transfer?lang=${lang}`}>{t(lang, 'transfer')}</a>
        </>
      ) : null}
    </div>
    <ScheduledSection lang={lang} site={site} scheduled={scheduled} csrf={csrf} />
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

const hijri = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { dateStyle: 'long' }).format(
      date,
    );
  } catch {
    return '';
  }
};

const FieldInput: FC<{
  name: string;
  inputName: string;
  field: Field;
  value: unknown;
  lang: UiLang;
  localeTag?: string;
  refOptions?: Record<string, { value: string; label: string }[]>;
}> = ({ name, inputName, field, value, localeTag, refOptions }) => {
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
    case 'date': {
      const hijriText = val ? hijri(val) : '';
      return (
        <>
          <input type="date" name={inputName} value={val.slice(0, 10)} />
          {hijriText ? <span class="muted">{hijriText}</span> : null}
        </>
      );
    }
    case 'reference':
      return (
        <select name={inputName}>
          <option value=""></option>
          {(refOptions?.[name] ?? []).map((o) => (
            <option value={o.value} selected={val === o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
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
  refOptions?: Record<string, { value: string; label: string }[]>;
}> = ({
  lang,
  user,
  site,
  schema,
  typeKey,
  type,
  slug,
  entry,
  csrf,
  flash,
  previewUrl,
  refOptions,
}) => {
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
          {entry.exists ? (
            <a
              class="btn secondary"
              href={`/sites/${site.id}/${typeKey}/${type.type === 'singleton' ? typeKey : slug}/revisions?lang=${lang}`}
            >
              {t(lang, 'revisions')}
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
                        refOptions={refOptions}
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
                  refOptions={refOptions}
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
        <div class="card">
          <label for="_publish_at">{t(lang, 'schedule')}</label>
          <div class="row">
            <input
              id="_publish_at"
              name="_publish_at"
              type="datetime-local"
              style="max-width:16rem"
            />
            <button class="btn secondary" type="submit" name="_action" value="schedule">
              {t(lang, 'schedule')}
            </button>
          </div>
        </div>
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

export const RevisionsPage: FC<{
  lang: UiLang;
  user: User;
  site: Site;
  typeKey: string;
  type: ContentType;
  slug?: string;
  revisions: RevisionSummary[];
  csrf: string;
}> = ({ lang, user, site, typeKey, type, slug, revisions, csrf }) => {
  const backPath =
    type.type === 'singleton'
      ? `/sites/${site.id}/${typeKey}?lang=${lang}`
      : `/sites/${site.id}/${typeKey}/${slug}?lang=${lang}`;
  const revertPath = `/sites/${site.id}/${typeKey}/${type.type === 'singleton' ? typeKey : slug}/revert?lang=${lang}`;
  return (
    <Layout lang={lang} title={t(lang, 'revisions')} user={user} site={site}>
      <div class="row" style="justify-content:space-between">
        <h1>{t(lang, 'revisions')}</h1>
        <a class="btn secondary" href={backPath}>
          {t(lang, 'edit')}
        </a>
      </div>
      <div class="card">
        {revisions.length === 0 ? (
          <p class="muted">{t(lang, 'noRevisions')}</p>
        ) : (
          <table>
            <tbody>
              {revisions.map((rev) => (
                <tr>
                  <td dir="ltr">{rev.timestamp}</td>
                  <td style="text-align:end">
                    <form method="post" action={revertPath}>
                      <input type="hidden" name="_csrf" value={csrf} />
                      <input type="hidden" name="rev" value={rev.key} />
                      <button
                        class="btn secondary"
                        type="submit"
                        onclick={`return confirm('${t(lang, 'revertConfirm')}')`}
                      >
                        {t(lang, 'revert')}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
};

export const MediaPage: FC<{
  lang: UiLang;
  user: User;
  site: Site;
  files: MediaFile[];
  csrf: string;
  flash?: { text: string; error?: boolean };
}> = ({ lang, user, site, files, csrf, flash }) => (
  <Layout lang={lang} title={t(lang, 'mediaLibrary')} user={user} site={site}>
    <h1>{t(lang, 'mediaLibrary')}</h1>
    {flash ? <div class={flash.error ? 'flash error' : 'flash'}>{flash.text}</div> : null}
    <div class="card">
      <form
        method="post"
        action={`/sites/${site.id}/_media?lang=${lang}`}
        enctype="multipart/form-data"
      >
        <input type="hidden" name="_csrf" value={csrf} />
        <div class="row">
          <input type="file" name="file" accept="image/*" required />
        </div>
        <label>
          {t(lang, 'altText')} <span class="locale-tag">ar</span>
        </label>
        <input type="text" name="alt__ar" dir="auto" />
        <label>
          {t(lang, 'altText')} <span class="locale-tag">en</span>
        </label>
        <input type="text" name="alt__en" dir="auto" />
        <div class="actions">
          <button class="btn" type="submit">
            {t(lang, 'upload')}
          </button>
        </div>
      </form>
    </div>
    <div class="card">
      <p class="muted">{t(lang, 'copyKey')}</p>
      {files.length === 0 ? (
        <p class="muted">{t(lang, 'noMedia')}</p>
      ) : (
        <table>
          <tbody>
            {files.map((file) => (
              <tr>
                <td style="width:72px">
                  {file.contentType.startsWith('image/') ? (
                    <img
                      src={`/sites/${site.id}/_media/file/${file.key}`}
                      alt={file.alt[lang] ?? ''}
                      style="width:64px;height:48px;object-fit:cover;border-radius:6px"
                    />
                  ) : null}
                </td>
                <td>
                  <code dir="ltr">{file.key}</code>
                  {file.alt.ar || file.alt.en ? (
                    <div class="muted">{file.alt[lang] ?? file.alt.ar ?? file.alt.en}</div>
                  ) : null}
                </td>
                <td class="muted" dir="ltr">
                  {(file.size / 1024).toFixed(0)} KB
                </td>
                <td style="text-align:end">
                  <form method="post" action={`/sites/${site.id}/_media/delete?lang=${lang}`}>
                    <input type="hidden" name="_csrf" value={csrf} />
                    <input type="hidden" name="key" value={file.key} />
                    <button
                      class="btn danger"
                      type="submit"
                      onclick={`return confirm('${t(lang, 'deleteConfirm')}')`}
                    >
                      {t(lang, 'delete')}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  </Layout>
);

export const AuditPage: FC<{ lang: UiLang; user: User; site: Site; rows: AuditRow[] }> = ({
  lang,
  user,
  site,
  rows,
}) => (
  <Layout lang={lang} title={t(lang, 'auditLog')} user={user} site={site}>
    <h1>{t(lang, 'auditLog')}</h1>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>{t(lang, 'when')}</th>
            <th>{t(lang, 'who')}</th>
            <th>{t(lang, 'action')}</th>
            <th>{t(lang, 'target')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr>
              <td class="muted" dir="ltr">
                {row.created_at.slice(0, 19).replace('T', ' ')}
              </td>
              <td dir="ltr">{row.email}</td>
              <td>{row.action}</td>
              <td dir="ltr">{row.target}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </Layout>
);

export const TransferPage: FC<{
  lang: UiLang;
  user: User;
  site: Site;
  csrf: string;
  flash?: { text: string; error?: boolean };
}> = ({ lang, user, site, csrf, flash }) => (
  <Layout lang={lang} title={t(lang, 'transfer')} user={user} site={site}>
    <h1>{t(lang, 'transfer')}</h1>
    {flash ? <div class={flash.error ? 'flash error' : 'flash'}>{flash.text}</div> : null}
    <div class="card">
      <a class="btn" href={`/sites/${site.id}/_export.json?lang=${lang}`} download>
        {t(lang, 'exportContent')}
      </a>
    </div>
    <div class="card">
      <form
        method="post"
        action={`/sites/${site.id}/_import?lang=${lang}`}
        enctype="multipart/form-data"
      >
        <input type="hidden" name="_csrf" value={csrf} />
        <input type="file" name="bundle" accept="application/json" required />
        <div class="actions">
          <button class="btn" type="submit">
            {t(lang, 'importContent')}
          </button>
        </div>
      </form>
    </div>
  </Layout>
);

export const AdminSitesPage: FC<{
  lang: UiLang;
  user: User;
  sites: Site[];
  csrf: string;
  flash?: { text: string; error?: boolean };
}> = ({ lang, user, sites, csrf, flash }) => (
  <Layout lang={lang} title={t(lang, 'manageSites')} user={user}>
    <h1>{t(lang, 'manageSites')}</h1>
    {flash ? <div class={flash.error ? 'flash error' : 'flash'}>{flash.text}</div> : null}
    {sites.map((site) => (
      <div class="card">
        <form method="post" action={`/admin/sites/${site.id}?lang=${lang}`}>
          <input type="hidden" name="_csrf" value={csrf} />
          <div class="row" style="justify-content:space-between">
            <strong>{site.prefix}</strong>
          </div>
          <label>{t(lang, 'siteName')}</label>
          <input type="text" name="name" value={site.name} required />
          <label>{t(lang, 'baseUrl')}</label>
          <input type="text" name="base_url" value={site.base_url} dir="ltr" />
          <label>{t(lang, 'zoneId')}</label>
          <input type="text" name="zone_id" value={site.zone_id} dir="ltr" />
          <label>{t(lang, 'themeAccent')}</label>
          <input
            type="text"
            name="theme_accent"
            value={site.theme_accent}
            dir="ltr"
            placeholder="#0f6b4f"
          />
          <label>{t(lang, 'logoUrl')}</label>
          <input type="text" name="logo_url" value={site.logo_url} dir="ltr" />
          <div class="actions">
            <button class="btn" type="submit">
              {t(lang, 'saveChanges')}
            </button>
          </div>
        </form>
      </div>
    ))}
    <div class="card">
      <h1>{t(lang, 'addSite')}</h1>
      <form method="post" action={`/admin/sites?lang=${lang}`}>
        <input type="hidden" name="_csrf" value={csrf} />
        <label>{t(lang, 'siteName')}</label>
        <input type="text" name="name" required />
        <label>{t(lang, 'sitePrefix')}</label>
        <input type="text" name="prefix" required pattern="[a-z0-9\-]+" dir="ltr" />
        <label>{t(lang, 'baseUrl')}</label>
        <input type="text" name="base_url" dir="ltr" />
        <label>{t(lang, 'zoneId')}</label>
        <input type="text" name="zone_id" dir="ltr" />
        <div class="actions">
          <button class="btn" type="submit">
            {t(lang, 'addSite')}
          </button>
        </div>
      </form>
    </div>
  </Layout>
);

export const AdminUsersPage: FC<{
  lang: UiLang;
  user: User;
  users: UserRow[];
  sites: Site[];
  csrf: string;
  flash?: { text: string; error?: boolean };
}> = ({ lang, user, users, sites, csrf, flash }) => (
  <Layout lang={lang} title={t(lang, 'manageUsers')} user={user}>
    <h1>{t(lang, 'manageUsers')}</h1>
    {flash ? <div class={flash.error ? 'flash error' : 'flash'}>{flash.text}</div> : null}
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>{t(lang, 'email')}</th>
            <th>{t(lang, 'role')}</th>
            <th>{t(lang, 'siteAccess')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((row) => (
            <tr>
              <td dir="ltr">{row.email}</td>
              <td>{row.role === 'owner' ? t(lang, 'roleOwner') : t(lang, 'roleEditor')}</td>
              <td>
                {row.role === 'owner' ? (
                  <span class="muted">—</span>
                ) : (
                  <>
                    {row.grants.map((grant) => (
                      <form
                        method="post"
                        action={`/admin/users/revoke?lang=${lang}`}
                        style="display:inline-block;margin-inline-end:.5rem"
                      >
                        <input type="hidden" name="_csrf" value={csrf} />
                        <input type="hidden" name="user_id" value={row.id} />
                        <input type="hidden" name="site_id" value={grant.site_id} />
                        <span class="badge">
                          {sites.find((s) => s.id === grant.site_id)?.name ?? grant.site_id} (
                          {grant.role === 'admin' ? t(lang, 'roleAdmin') : t(lang, 'roleEditor')})
                        </span>
                        <button class="btn secondary" type="submit" style="padding:.1rem .5rem">
                          {t(lang, 'revoke')}
                        </button>
                      </form>
                    ))}
                    <form
                      method="post"
                      action={`/admin/users/grant?lang=${lang}`}
                      style="display:inline-block"
                    >
                      <input type="hidden" name="_csrf" value={csrf} />
                      <input type="hidden" name="user_id" value={row.id} />
                      <select name="site_id" style="width:auto">
                        {sites.map((s) => (
                          <option value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <select name="role" style="width:auto">
                        <option value="editor">{t(lang, 'roleEditor')}</option>
                        <option value="admin">{t(lang, 'roleAdmin')}</option>
                      </select>
                      <button class="btn secondary" type="submit" style="padding:.1rem .5rem">
                        {t(lang, 'grant')}
                      </button>
                    </form>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div class="card">
      <h1>{t(lang, 'inviteUser')}</h1>
      <form method="post" action={`/admin/users?lang=${lang}`}>
        <input type="hidden" name="_csrf" value={csrf} />
        <label>{t(lang, 'email')}</label>
        <input type="email" name="email" required dir="ltr" />
        <label>{t(lang, 'name')}</label>
        <input type="text" name="name" />
        <label>{t(lang, 'role')}</label>
        <select name="role">
          <option value="editor">{t(lang, 'roleEditor')}</option>
          <option value="owner">{t(lang, 'roleOwner')}</option>
        </select>
        <div class="actions">
          <button class="btn" type="submit">
            {t(lang, 'inviteUser')}
          </button>
        </div>
      </form>
    </div>
  </Layout>
);

export const ScheduledSection: FC<{
  lang: UiLang;
  site: Site;
  scheduled: ScheduledPublish[];
  csrf: string;
}> = ({ lang, site, scheduled, csrf }) => (
  <div class="card">
    <h1>{t(lang, 'scheduledPublishes')}</h1>
    {scheduled.length === 0 ? (
      <p class="muted">{t(lang, 'noScheduled')}</p>
    ) : (
      <table>
        <tbody>
          {scheduled.map((row) => (
            <tr>
              <td dir="ltr">
                {row.type_key}
                {row.slug ? `/${row.slug}` : ''}
              </td>
              <td class="muted" dir="ltr">
                {row.publish_at.slice(0, 16).replace('T', ' ')}
              </td>
              <td style="text-align:end">
                <form method="post" action={`/sites/${site.id}/_scheduled/cancel?lang=${lang}`}>
                  <input type="hidden" name="_csrf" value={csrf} />
                  <input type="hidden" name="id" value={row.id} />
                  <button class="btn secondary" type="submit">
                    {t(lang, 'cancel')}
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);
