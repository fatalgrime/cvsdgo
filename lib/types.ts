export type RedirectRow = {
  id: number;
  slug: string;
  url: string;
  description: string | null;
  click_count: number | null;
  is_locked?: boolean | null;
  release_at?: string | Date | null;
  expires_at?: string | Date | null;
  folder_id?: number | null;
  folder_name?: string | null;
  folder_is_public?: boolean | null;
};

export type LinkFolderRow = {
  id: number;
  name: string;
  is_public: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

export type ReportRow = {
  id: number;
  user_id: string;
  user_email: string | null;
  title: string;
  description: string;
  link_slug: string | null;
  priority: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string | Date;
  updated_at: string | Date;
};

export type ReportCommentRow = {
  id: number;
  report_id: number;
  author_user_id: string;
  author_name: string | null;
  body: string;
  created_at: string | Date;
};
