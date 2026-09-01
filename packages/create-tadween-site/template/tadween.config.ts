import { collection, defineConfig, fields, seoFields, singleton } from '@tadween/astro';

export default defineConfig({
  site: '__PROJECT_NAME__',
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  content: {
    home: singleton({
      label: { ar: 'الصفحة الرئيسية', en: 'Homepage' },
      routes: ['/', '/:lang'],
      fields: {
        heroTitle: fields.text({
          label: { ar: 'عنوان الترحيب', en: 'Hero title' },
          bilingual: true,
          required: true,
        }),
        heroSubtitle: fields.text({
          label: { ar: 'النص الفرعي', en: 'Hero subtitle' },
          bilingual: true,
        }),
        heroImage: fields.image({ label: { ar: 'صورة الترحيب', en: 'Hero image' } }),
        services: fields.list({
          label: { ar: 'الخدمات', en: 'Services' },
          fields: {
            name: fields.text({ bilingual: true }),
            description: fields.textarea({ bilingual: true }),
          },
        }),
      },
    }),
    blog: collection({
      label: { ar: 'المدونة', en: 'Blog' },
      slug: 'blog',
      titleField: 'title',
      routes: ['/:lang/blog', '/:lang/blog/:slug'],
      fields: {
        title: fields.text({
          label: { ar: 'العنوان', en: 'Title' },
          bilingual: true,
          required: true,
        }),
        date: fields.date({ label: { ar: 'التاريخ', en: 'Date' } }),
        cover: fields.image({ label: { ar: 'صورة الغلاف', en: 'Cover image' } }),
        body: fields.markdown({ label: { ar: 'المحتوى', en: 'Content' }, bilingual: true }),
        ...seoFields(),
      },
    }),
  },
});
