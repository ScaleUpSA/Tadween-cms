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
  revisions: { ar: 'الإصدارات السابقة', en: 'Revisions' },
  revert: { ar: 'استرجاع', en: 'Revert' },
  revertConfirm: {
    ar: 'سيتم نشر هذا الإصدار مكان النسخة الحالية. متابعة؟',
    en: 'This revision will be published in place of the current version. Continue?',
  },
  noRevisions: { ar: 'لا توجد إصدارات سابقة', en: 'No previous revisions' },
  mediaLibrary: { ar: 'مكتبة الوسائط', en: 'Media library' },
  altText: { ar: 'النص البديل', en: 'Alt text' },
  copyKey: {
    ar: 'انسخ المعرّف لاستخدامه في حقول الصور',
    en: 'Copy the key to use in image fields',
  },
  noMedia: { ar: 'لا توجد ملفات بعد', en: 'No files yet' },
  auditLog: { ar: 'سجل النشاط', en: 'Activity log' },
  who: { ar: 'المستخدم', en: 'User' },
  action: { ar: 'الإجراء', en: 'Action' },
  target: { ar: 'العنصر', en: 'Item' },
  when: { ar: 'الوقت', en: 'When' },
  transfer: { ar: 'تصدير / استيراد', en: 'Export / import' },
  exportContent: { ar: 'تصدير المحتوى', en: 'Export content' },
  importContent: { ar: 'استيراد المحتوى', en: 'Import content' },
  importDone: { ar: 'تم الاستيراد', en: 'Import complete' },
  logoutAll: { ar: 'تسجيل الخروج من كل الأجهزة', en: 'Log out of all devices' },
} as const;

export type StringKey = keyof typeof strings;

export function t(lang: UiLang, key: StringKey): string {
  return strings[key][lang];
}

export function dir(lang: UiLang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}
