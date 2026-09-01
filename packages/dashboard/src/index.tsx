import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { createPreviewToken, type CompiledSchema, type ContentType } from '@tadween/astro';
import { verifyPassword } from './auth.js';
import {
  audit,
  clearLoginFailures,
  createSession,
  deleteAllSessions,
  deleteSession,
  findUserByEmail,
  getSessionUser,
  getSiteForUser,
  isLockedOut,
  listAudit,
  recordLoginFailure,
  sitesForUser,
} from './db.js';
import type { Env, Site, Variables } from './env.js';
import { parseEntryForm, slugify } from './forms.js';
import { t, type UiLang } from './i18n.js';
import { purgePublish } from './purge.js';
import {
  deleteEntry,
  exportContent,
  importContent,
  listEntries,
  listMedia,
  listRevisions,
  loadEntry,
  loadSchema,
  publishEntry,
  revertToRevision,
  saveDraft,
  type ContentBundle,
} from './store.js';
import {
  AuditPage,
  CollectionPage,
  EntryForm,
  Layout,
  LoginPage,
  MediaPage,
  RevisionsPage,
  SiteHome,
  SitesPage,
  TransferPage,
} from './views.js';

const SESSION_COOKIE = 'tadween_session';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const uiLang = (c: { req: { query: (k: string) => string | undefined } }): UiLang =>
  c.req.query('lang') === 'en' ? 'en' : 'ar';

// --- security headers ---
app.use('*', async (c, next) => {
  await next();
  c.res.headers.set('X-Frame-Options', 'DENY');
  c.res.headers.set('X-Content-Type-Options', 'nosniff');
  c.res.headers.set('Referrer-Policy', 'same-origin');
  c.res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:",
  );
});

// --- auth routes ---
app.get('/login', (c) => c.html(<LoginPage lang={uiLang(c)} />));

app.post('/login', async (c) => {
  const lang = uiLang(c);
  const form = await c.req.formData();
  const email = String(form.get('email') ?? '')
    .toLowerCase()
    .trim();
  const password = String(form.get('password') ?? '');

  if (await isLockedOut(c.env.DB, email)) {
    return c.html(<LoginPage lang={lang} error={t(lang, 'lockedOut')} />, 429);
  }
  const user = email ? await findUserByEmail(c.env.DB, email) : null;
  const valid = user ? await verifyPassword(password, user.password_hash) : false;
  if (!user || !valid) {
    if (email) await recordLoginFailure(c.env.DB, email);
    return c.html(<LoginPage lang={lang} error={t(lang, 'invalidCredentials')} />, 401);
  }
  await clearLoginFailures(c.env.DB, email);
  const session = await createSession(c.env.DB, user.id);
  setCookie(c, SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    expires: new Date(session.expires_at),
  });
  return c.redirect(`/sites?lang=${lang}`);
});

// --- session middleware (everything below requires auth) ---
app.use('*', async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  const found = sessionId ? await getSessionUser(c.env.DB, sessionId) : null;
  if (!found) return c.redirect(`/login?lang=${uiLang(c)}`);
  c.set('user', found.user);
  c.set('session', found.session);
  c.set('lang', uiLang(c));

  if (c.req.method === 'POST') {
    const form = await c.req.raw.clone().formData();
    if (form.get('_csrf') !== found.session.csrf_token && c.req.path !== '/logout') {
      return c.text('Invalid CSRF token', 403);
    }
  }
  await next();
});

app.post('/logout', async (c) => {
  const form = await c.req.formData();
  if (form.get('all')) {
    await deleteAllSessions(c.env.DB, c.get('user').id);
  } else {
    await deleteSession(c.env.DB, c.get('session').id);
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.redirect('/login');
});

app.get('/', (c) => c.redirect(`/sites?lang=${c.get('lang')}`));

app.get('/sites', async (c) => {
  const sites = await sitesForUser(c.env.DB, c.get('user'));
  if (sites.length === 1 && sites[0])
    return c.redirect(`/sites/${sites[0].id}?lang=${c.get('lang')}`);
  return c.html(<SitesPage lang={c.get('lang')} user={c.get('user')} sites={sites} />);
});

// --- site scoping middleware ---
app.use('/sites/:siteId/*', async (c, next) => {
  const site = await getSiteForUser(c.env.DB, c.get('user'), c.req.param('siteId'));
  if (!site) return c.notFound();
  c.set('site', site);
  await next();
});

app.get('/sites/:siteId', async (c) => {
  const site = c.get('site');
  const schema = await loadSchema(c.env, site);
  if (!schema) {
    return c.html(
      <Layout lang={c.get('lang')} user={c.get('user')} site={site}>
        <div class="card">
          <p>
            No schema found for this site. Run <code>npx tadween push-schema</code> from the Astro
            project.
          </p>
        </div>
      </Layout>,
    );
  }
  return c.html(<SiteHome lang={c.get('lang')} user={c.get('user')} site={site} schema={schema} />);
});

interface TypeContext {
  site: Site;
  schema: CompiledSchema;
  typeKey: string;
  type: ContentType;
}

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

async function typeContext(c: AppContext): Promise<TypeContext | null> {
  const site = c.get('site');
  const schema = await loadSchema(c.env, site);
  if (!schema) return null;
  const typeKey = c.req.param('typeKey') ?? '';
  const type = schema.content[typeKey];
  if (!type) return null;
  return { site, schema, typeKey, type };
}

async function previewUrl(env: Env, site: Site, type: ContentType, typeKey: string, slug?: string) {
  if (!site.base_url || !env.TADWEEN_PREVIEW_SECRET) return undefined;
  const token = await createPreviewToken(env.TADWEEN_PREVIEW_SECRET);
  const route =
    type.type === 'singleton'
      ? (type.routes?.[0] ?? '/')
      : (type.routes?.[1] ?? `/:lang/${typeKey}/:slug`);
  const path = route.replace(':lang', 'ar').replace(':slug', slug ?? '');
  return `${site.base_url.replace(/\/$/, '')}${path}?tadween-preview=${token}`;
}

async function referenceOptions(
  c: AppContext,
  schema: CompiledSchema,
  type: ContentType,
): Promise<Record<string, { value: string; label: string }[]>> {
  const site = c.get('site');
  const out: Record<string, { value: string; label: string }[]> = {};
  for (const [name, field] of Object.entries(type.fields)) {
    if (field.kind !== 'reference') continue;
    const target = schema.content[field.to];
    if (!target || target.type !== 'collection') continue;
    const entries = await listEntries(c.env, site, schema, field.to, target);
    out[name] = entries.map((e) => ({ value: e.slug, label: e.title || e.slug }));
  }
  return out;
}

// --- media library ---
app.get('/sites/:siteId/_media', async (c) => {
  const site = c.get('site');
  const files = await listMedia(c.env, site);
  return c.html(
    <MediaPage
      lang={c.get('lang')}
      user={c.get('user')}
      site={site}
      files={files}
      csrf={c.get('session').csrf_token}
    />,
  );
});

app.post('/sites/:siteId/_media', async (c) => {
  const site = c.get('site');
  const lang = c.get('lang');
  const form = await c.req.formData();
  const file = form.get('file') as unknown as File | string | null;
  if (!file || typeof file === 'string') return c.text('no file', 400);
  if (!file.type.startsWith('image/')) return c.text('images only', 415);
  if (file.size > 10 * 1024 * 1024) return c.text('max 10MB', 413);
  const safeName = file.name.replace(/[^\w.\-\u0600-\u06ff]+/g, '-');
  const key = `${Date.now()}-${safeName}`;
  const customMetadata: Record<string, string> = {};
  const altAr = String(form.get('alt__ar') ?? '').trim();
  const altEn = String(form.get('alt__en') ?? '').trim();
  if (altAr) customMetadata.alt_ar = altAr;
  if (altEn) customMetadata.alt_en = altEn;
  await c.env.MEDIA.put(`${site.prefix}/media/${key}`, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata,
  });
  await audit(c.env, c.get('user').id, site.id, 'upload', key);
  return c.redirect(`/sites/${site.id}/_media?lang=${lang}`);
});

app.post('/sites/:siteId/_media/delete', async (c) => {
  const site = c.get('site');
  const form = await c.req.formData();
  const key = String(form.get('key') ?? '');
  if (!key || key.includes('..') || key.includes('/')) return c.text('bad key', 400);
  await c.env.MEDIA.delete(`${site.prefix}/media/${key}`);
  await audit(c.env, c.get('user').id, site.id, 'delete-media', key);
  return c.redirect(`/sites/${site.id}/_media?lang=${c.get('lang')}`);
});

app.get('/sites/:siteId/_media/file/:key', async (c) => {
  const site = c.get('site');
  const key = c.req.param('key');
  if (!key || key.includes('..')) return c.notFound();
  const object = await c.env.MEDIA.get(`${site.prefix}/media/${key}`);
  if (!object) return c.notFound();
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

// --- audit log (owners only) ---
app.get('/sites/:siteId/_audit', async (c) => {
  if (c.get('user').role !== 'owner') return c.notFound();
  const site = c.get('site');
  const rows = await listAudit(c.env.DB, site.id);
  return c.html(<AuditPage lang={c.get('lang')} user={c.get('user')} site={site} rows={rows} />);
});

// --- export / import (owners only) ---
app.get('/sites/:siteId/_transfer', (c) => {
  if (c.get('user').role !== 'owner') return c.notFound();
  return c.html(
    <TransferPage
      lang={c.get('lang')}
      user={c.get('user')}
      site={c.get('site')}
      csrf={c.get('session').csrf_token}
    />,
  );
});

app.get('/sites/:siteId/_export.json', async (c) => {
  if (c.get('user').role !== 'owner') return c.notFound();
  const site = c.get('site');
  const bundle = await exportContent(c.env, site);
  await audit(c.env, c.get('user').id, site.id, 'export', site.prefix);
  return c.body(JSON.stringify(bundle, null, 2), 200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="tadween-${site.prefix}.json"`,
  });
});

app.post('/sites/:siteId/_import', async (c) => {
  if (c.get('user').role !== 'owner') return c.notFound();
  const site = c.get('site');
  const lang = c.get('lang');
  const form = await c.req.formData();
  const file = form.get('bundle') as unknown as File | string | null;
  const fail = (text: string) =>
    c.html(
      <TransferPage
        lang={lang}
        user={c.get('user')}
        site={site}
        csrf={c.get('session').csrf_token}
        flash={{ text, error: true }}
      />,
      400,
    );
  if (!file || typeof file === 'string') return fail('no file');
  let bundle: ContentBundle;
  try {
    bundle = JSON.parse(await file.text()) as ContentBundle;
  } catch {
    return fail('invalid JSON');
  }
  if (bundle.version !== 1 || typeof bundle.files !== 'object' || bundle.files === null) {
    return fail('invalid bundle');
  }
  const count = await importContent(c.env, site, bundle);
  await audit(c.env, c.get('user').id, site.id, 'import', `${count} files`);
  return c.html(
    <TransferPage
      lang={lang}
      user={c.get('user')}
      site={site}
      csrf={c.get('session').csrf_token}
      flash={{ text: `${t(lang, 'importDone')} (${count})` }}
    />,
  );
});

app.get('/sites/:siteId/:typeKey', async (c) => {
  const ctx = await typeContext(c);
  if (!ctx) return c.notFound();
  const { site, schema, typeKey, type } = ctx;
  if (type.type === 'singleton') {
    const entry = await loadEntry(c.env, site, typeKey, type);
    return c.html(
      <EntryForm
        lang={c.get('lang')}
        user={c.get('user')}
        site={site}
        schema={schema}
        typeKey={typeKey}
        type={type}
        entry={entry}
        csrf={c.get('session').csrf_token}
        previewUrl={await previewUrl(c.env, site, type, typeKey)}
        refOptions={await referenceOptions(c, schema, type)}
      />,
    );
  }
  const entries = await listEntries(c.env, site, schema, typeKey, type);
  return c.html(
    <CollectionPage
      lang={c.get('lang')}
      user={c.get('user')}
      site={site}
      typeKey={typeKey}
      type={type}
      entries={entries}
    />,
  );
});

app.get('/sites/:siteId/:typeKey/:slug', async (c) => {
  const ctx = await typeContext(c);
  if (!ctx || ctx.type.type !== 'collection') return c.notFound();
  const { site, schema, typeKey, type } = ctx;
  const slug = c.req.param('slug');
  const entry =
    slug === 'new'
      ? { data: {}, body: '', isDraft: false, exists: false }
      : await loadEntry(c.env, site, typeKey, type, slug);
  if (slug !== 'new' && !entry.exists) return c.notFound();
  return c.html(
    <EntryForm
      lang={c.get('lang')}
      user={c.get('user')}
      site={site}
      schema={schema}
      typeKey={typeKey}
      type={type}
      slug={slug === 'new' ? undefined : slug}
      entry={entry}
      csrf={c.get('session').csrf_token}
      previewUrl={slug === 'new' ? undefined : await previewUrl(c.env, site, type, typeKey, slug)}
      refOptions={await referenceOptions(c, schema, type)}
    />,
  );
});

// --- revisions ---
app.get('/sites/:siteId/:typeKey/:slug/revisions', async (c) => {
  const ctx = await typeContext(c);
  if (!ctx) return c.notFound();
  const { site, typeKey, type } = ctx;
  const slugParam = c.req.param('slug');
  const revSlug = type.type === 'singleton' ? typeKey : slugParam;
  const revisions = await listRevisions(c.env, site, typeKey, revSlug);
  return c.html(
    <RevisionsPage
      lang={c.get('lang')}
      user={c.get('user')}
      site={site}
      typeKey={typeKey}
      type={type}
      slug={type.type === 'singleton' ? undefined : slugParam}
      revisions={revisions}
      csrf={c.get('session').csrf_token}
    />,
  );
});

app.post('/sites/:siteId/:typeKey/:slug/revert', async (c) => {
  const ctx = await typeContext(c);
  if (!ctx) return c.notFound();
  const { site, schema, typeKey, type } = ctx;
  const lang = c.get('lang');
  const slugParam = c.req.param('slug');
  const slug = type.type === 'singleton' ? undefined : slugParam;
  const form = await c.req.formData();
  const revisionKey = String(form.get('rev') ?? '');
  const ok = await revertToRevision(c.env, site, typeKey, type, slug, revisionKey);
  if (!ok) return c.text('Invalid revision', 400);
  const target = type.type === 'singleton' ? typeKey : `${typeKey}/${slug}`;
  await audit(c.env, c.get('user').id, site.id, 'revert', target);
  const purge = await purgePublish(
    c.env.CF_API_TOKEN,
    site,
    schema,
    typeKey,
    type.type === 'singleton' ? typeKey : (slug ?? ''),
  );
  if (!purge.ok && purge.detail) console.warn(`[tadween] ${purge.detail}`);
  const editPath =
    type.type === 'singleton'
      ? `/sites/${site.id}/${typeKey}?lang=${lang}`
      : `/sites/${site.id}/${typeKey}/${slug}?lang=${lang}`;
  return c.redirect(editPath);
});

async function handleWrite(c: AppContext, slugParam?: string): Promise<Response> {
  const ctx = await typeContext(c);
  if (!ctx) return c.notFound();
  const { site, schema, typeKey, type } = ctx;
  const lang = c.get('lang');
  const form = await c.req.formData();
  const action = String(form.get('_action') ?? 'draft');

  let slug = slugParam;
  if (type.type === 'collection' && !slug) {
    slug = slugify(String(form.get('_slug') ?? ''));
    if (!slug) return c.text('Missing slug', 400);
  }

  if (action === 'delete' && type.type === 'collection' && slug) {
    await deleteEntry(c.env, site, typeKey, type, slug);
    await audit(c.env, c.get('user').id, site.id, 'delete', `${typeKey}/${slug}`);
    await purgePublish(c.env.CF_API_TOKEN, site, schema, typeKey, slug);
    return c.redirect(`/sites/${site.id}/${typeKey}?lang=${lang}`);
  }

  const { data, body, errors } = parseEntryForm(form, type, schema);
  const entry = { data, body, isDraft: action !== 'publish', exists: true };
  const csrf = c.get('session').csrf_token;

  if (errors.length) {
    return c.html(
      <EntryForm
        lang={lang}
        user={c.get('user')}
        site={site}
        schema={schema}
        typeKey={typeKey}
        type={type}
        slug={slugParam}
        entry={entry}
        csrf={csrf}
        flash={{ text: `${t(lang, 'requiredField')}: ${errors.join(', ')}`, error: true }}
      />,
      400,
    );
  }

  const target = type.type === 'singleton' ? typeKey : `${typeKey}/${slug}`;
  if (action === 'publish') {
    await publishEntry(c.env, site, typeKey, type, slug, data, body);
    await audit(c.env, c.get('user').id, site.id, 'publish', target);
    const purge = await purgePublish(
      c.env.CF_API_TOKEN,
      site,
      schema,
      typeKey,
      type.type === 'singleton' ? typeKey : (slug ?? ''),
    );
    if (!purge.ok && purge.detail) console.warn(`[tadween] ${purge.detail}`);
  } else {
    await saveDraft(c.env, site, typeKey, type, slug, data, body);
    await audit(c.env, c.get('user').id, site.id, 'save-draft', target);
  }

  const editPath =
    type.type === 'singleton'
      ? `/sites/${site.id}/${typeKey}?lang=${lang}`
      : `/sites/${site.id}/${typeKey}/${slug}?lang=${lang}`;
  return c.redirect(editPath);
}

app.post('/sites/:siteId/:typeKey', (c) => handleWrite(c));
app.post('/sites/:siteId/:typeKey/new', (c) => handleWrite(c));
app.post('/sites/:siteId/:typeKey/:slug', (c) =>
  c.req.param('slug') === 'new' ? handleWrite(c) : handleWrite(c, c.req.param('slug')),
);

// --- media upload (image fields store the returned key) ---
app.post('/sites/:siteId/upload', async (c) => {
  const site = c.get('site');
  const form = await c.req.formData();
  const file = form.get('file') as unknown as File | string | null;
  if (!file || typeof file === 'string') return c.json({ error: 'no file' }, 400);
  if (!file.type.startsWith('image/')) return c.json({ error: 'images only' }, 415);
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'max 10MB' }, 413);
  const safeName = file.name.replace(/[^\w.\-\u0600-\u06ff]+/g, '-');
  const key = `${Date.now()}-${safeName}`;
  await c.env.MEDIA.put(`${site.prefix}/media/${key}`, file.stream(), {
    httpMetadata: { contentType: file.type },
  });
  await audit(c.env, c.get('user').id, site.id, 'upload', key);
  return c.json({ key, url: `/_tadween/media/${key}` });
});

export default app;
