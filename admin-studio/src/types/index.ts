export interface AdminStats {
  users_count: number;
  videos_count: number;
  lessons_count: number;
  subtitles_count: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  central_auth_id?: string;
}

export interface AdminSettings {
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  AUTH_PROVIDER: 'local' | 'central';
  CENTRAL_AUTH_SERVER_ADDRESS: string;
  CENTRAL_AUTH_CLIENT_ID: string;
  CENTRAL_AUTH_CLIENT_SECRET: string;
}

export interface AdminVideo {
  id: number;
  title: string;
  visibility: 'private' | 'public' | 'unlisted' | 'pending_public';
  created_at: string;
  uploader_id: number;
}
