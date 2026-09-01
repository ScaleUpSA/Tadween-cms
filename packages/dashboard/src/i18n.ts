export type UiLang = 'ar' | 'en';

const strings = {
  appName: { ar: 'تدوين', en: 'Tadween' },
  login: { ar: 'تسجيل الدخول', en: 'Log in' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  logout: { ar: 'تسجيل الخروج', en: 'Log out' },
  invalidCredentials: { ar: 'بيانات الدخول غير صحيحة', en: 'Invalid email or password' },
  lockedOut: {
    ar: 'تم إيقاف تسجيل الدخول مؤقتًا بسبب محاولات متكررة. حاول بعد قليل.',
    en: 'Login temporarily locked after repeated attempts. Try again shortly.',
  },
  sites: { ar: 'المواقع', en: 'Sites' },
  content: { ar: 'المحتوى', en: 'Content' },
  newEntry: { ar: 'إضافة جديد', en: 'New entry' },
  edit: { ar: 'تعديل', en: 'Edit' },
  save: { ar: 'حفظ مسودة', en: 'Save draft' },
  publish: { ar: 'نشر', en: 'Publish' },
  published: { ar: 'منشور', en: 'Published' },
  draft: { ar: 'مسودة', en: 'Draft' },
  preview: { ar: 'معاينة', en: 'Preview' },
  delete: { ar: 'حذف', en: 'Delete' },
  slug: { ar: 'المعرّف في الرابط (لاتيني)', en: 'URL slug' },
  savedDraft: { ar: 'تم حفظ المسودة', en: 'Draft saved' },
  publishedOk: {
    ar: 'تم النشر — سيظهر التغيير على الموقع خلال ثوانٍ',
    en: 'Published — the change will appear on the site within seconds',
  },
  deleteConfirm: { ar: 'هل أنت متأكد من الحذف؟', en: 'Are you sure you want to delete this?' },
  noEntries: { ar: 'لا يوجد محتوى بعد', en: 'No entries yet' },
  backToSite: { ar: 'عودة إلى الموقع', en: 'Back to site' },
  media: { ar: 'الوسائط', en: 'Media' },
  upload: { ar: 'رفع ملف', en: 'Upload' },
  requiredField: { ar: 'هذا الحقل مطلوب', en: 'This field is required' },
  openSite: { ar: 'فتح الموقع', en: 'Open site' },
  errNotFound: { ar: 'غير موجود', en: 'Not found' },
} as const;

export type StringKey = keyof typeof strings;

export function t(lang: UiLang, key: StringKey): string {
  return strings[key][lang];
}

export function dir(lang: UiLang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
