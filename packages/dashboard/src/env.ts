export interface Env {
  DB: D1Database;
  CONTENT: R2Bucket;
  MEDIA: R2Bucket;
  CF_API_TOKEN?: string;
  TADWEEN_PREVIEW_SECRET?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'editor';
}

export interface Site {
  id: string;
  name: string;
  prefix: string;
  base_url: string;
  zone_id: string;
}

export interface Session {
  id: string;
  user_id: string;
  csrf_token: string;
  expires_at: string;
}

export type Variables = {
  user: User;
  session: Session;
  site: Site;
  lang: 'ar' | 'en';
};
