CREATE TABLE IF NOT EXISTS link_folders (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS link_folders_is_public_idx ON link_folders(is_public);

CREATE TABLE IF NOT EXISTS redirects (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description TEXT,
  folder_id BIGINT REFERENCES link_folders(id) ON DELETE SET NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  release_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  click_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS redirects_slug_idx ON redirects(slug);
CREATE INDEX IF NOT EXISTS redirects_folder_id_idx ON redirects(folder_id);

CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  link_slug TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  metadata JSONB,
  handled_by_user_id TEXT,
  handled_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_comments (
  id BIGSERIAL PRIMARY KEY,
  report_id BIGINT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL,
  author_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);
CREATE INDEX IF NOT EXISTS report_comments_report_id_idx ON report_comments(report_id);

CREATE TABLE IF NOT EXISTS reporting_profiles (
  user_id TEXT PRIMARY KEY,
  report_ban_type TEXT NOT NULL DEFAULT 'none',
  banned_until TIMESTAMPTZ,
  limit_hourly INTEGER NOT NULL DEFAULT 0,
  limit_daily INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 0,
  last_strike_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_strikes (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_id BIGINT REFERENCES reports(id) ON DELETE SET NULL,
  reason TEXT,
  strike_type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  actor_user_id TEXT,
  actor_username TEXT,
  actor_has_discord_account BOOLEAN NOT NULL DEFAULT FALSE,
  actor_has_login_account BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reporting_profiles_user_id_idx ON reporting_profiles(user_id);
CREATE INDEX IF NOT EXISTS report_strikes_user_id_idx ON report_strikes(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

INSERT INTO redirects (slug, url, description)
VALUES
  ('enroll', 'https://www.cvsd.org/enroll', 'Enrollment Portal'),
  ('calendar', 'https://www.cvsd.org/calendar', 'District Calendar')
ON CONFLICT (slug) DO NOTHING;
