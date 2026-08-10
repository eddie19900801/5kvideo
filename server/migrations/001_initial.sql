CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY, account text NOT NULL DEFAULT '', password_hash text NOT NULL DEFAULT '', username text NOT NULL,
  role text NOT NULL CHECK (role IN ('user','admin')), status text NOT NULL CHECK (status IN ('active','disabled')),
  is_guest boolean, visit_count integer, total_watch_seconds double precision, last_seen_at timestamptz, created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_account_unique ON users (lower(account)) WHERE account <> '';
CREATE TABLE IF NOT EXISTS videos (
  id text PRIMARY KEY, title text NOT NULL, description text NOT NULL, thumbnail text NOT NULL, playback_url text NOT NULL,
  duration double precision NOT NULL, tags jsonb NOT NULL DEFAULT '[]', chapters jsonb NOT NULL DEFAULT '[]', views integer NOT NULL DEFAULT 0,
  aspect_ratio text NOT NULL CHECK (aspect_ratio IN ('landscape','portrait')), is_adult boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','processing','published','offline')), created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS videos_status_adult_created ON videos(status,is_adult,created_at DESC);
CREATE TABLE IF NOT EXISTS tags (id text PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unique ON tags(lower(name));
CREATE TABLE IF NOT EXISTS favorites (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id text NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal','adult')), created_at timestamptz NOT NULL,
  PRIMARY KEY(user_id,video_id,mode)
);
CREATE TABLE IF NOT EXISTS progress (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, video_id text NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal','adult')), progress double precision NOT NULL,
  duration double precision NOT NULL, completed boolean NOT NULL, updated_at timestamptz NOT NULL,
  PRIMARY KEY(user_id,video_id,mode)
);
CREATE TABLE IF NOT EXISTS analytics_events (
  id text PRIMARY KEY, event_name text NOT NULL, event_time timestamptz NOT NULL, user_id text, install_id text NOT NULL,
  session_id text NOT NULL, platform text NOT NULL, app_version text NOT NULL, channel text NOT NULL,
  video_id text, value double precision, metadata jsonb
);
CREATE INDEX IF NOT EXISTS analytics_time_name ON analytics_events(event_time,event_name);
CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY, admin_id text NOT NULL, action text NOT NULL, target_id text NOT NULL, created_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS media_jobs (
  id text PRIMARY KEY, type text NOT NULL, status text NOT NULL, admin_id text NOT NULL, source_path text NOT NULL,
  original_name text NOT NULL, attempts integer NOT NULL DEFAULT 0, error text, output jsonb,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS media_jobs_queue ON media_jobs(status,created_at);
