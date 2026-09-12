CREATE TABLE IF NOT EXISTS source_sessions (
  source TEXT PRIMARY KEY,
  cookie TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  github_run_id TEXT,
  github_job TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  shard_index INTEGER NOT NULL,
  shard_count INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'partial', 'failed')),
  apps_discovered INTEGER NOT NULL DEFAULT 0,
  apps_processed INTEGER NOT NULL DEFAULT 0,
  apps_skipped INTEGER NOT NULL DEFAULT 0,
  apps_failed INTEGER NOT NULL DEFAULT 0,
  media_uploaded INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('logo', 'screen', 'video')),
  source_url TEXT NOT NULL UNIQUE,
  bucket TEXT,
  object_key TEXT UNIQUE,
  content_type TEXT,
  byte_size BIGINT,
  content_sha256 TEXT,
  etag TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed', 'restricted')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  name TEXT NOT NULL,
  slug TEXT,
  tagline TEXT,
  source_url TEXT NOT NULL,
  logo_source_url TEXT,
  logo_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  preview_screens JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, id)
);

CREATE TABLE IF NOT EXISTS app_versions (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  published_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  version_index INTEGER,
  version_count INTEGER,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_versions_app_id_idx ON app_versions(app_id);

CREATE TABLE IF NOT EXISTS screens (
  id TEXT PRIMARY KEY,
  app_version_id TEXT NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  position INTEGER,
  screen_type TEXT,
  width INTEGER,
  height INTEGER,
  is_key_screen BOOLEAN NOT NULL DEFAULT false,
  restricted BOOLEAN NOT NULL DEFAULT false,
  source_url TEXT,
  image_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  animation_id TEXT,
  ocr_text TEXT,
  ocr_regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS screens_app_version_id_idx ON screens(app_version_id);
CREATE INDEX IF NOT EXISTS screens_ocr_search_idx ON screens USING GIN (to_tsvector('simple', coalesce(ocr_text, '')));

CREATE TABLE IF NOT EXISTS screen_taxonomy (
  screen_id TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  taxonomy_type TEXT NOT NULL CHECK (taxonomy_type IN ('ui_element', 'screen_pattern', 'animation_ui_element', 'animation_screen_pattern')),
  taxonomy_key TEXT NOT NULL,
  name TEXT NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (screen_id, taxonomy_type, taxonomy_key)
);

CREATE INDEX IF NOT EXISTS screen_taxonomy_name_idx ON screen_taxonomy(taxonomy_type, name);

CREATE TABLE IF NOT EXISTS flows (
  id TEXT PRIMARY KEY,
  app_version_id TEXT NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INTEGER,
  popularity_metric DOUBLE PRECISION,
  restricted BOOLEAN NOT NULL DEFAULT false,
  source_video_url TEXT,
  video_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flows_app_version_id_idx ON flows(app_version_id);

CREATE TABLE IF NOT EXISTS flow_screens (
  flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  screen_id TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  hotspot_type TEXT,
  hotspot_x DOUBLE PRECISION,
  hotspot_y DOUBLE PRECISION,
  hotspot_width DOUBLE PRECISION,
  hotspot_height DOUBLE PRECISION,
  video_timestamp DOUBLE PRECISION,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (flow_id, screen_id, position)
);

CREATE INDEX IF NOT EXISTS flow_screens_screen_id_idx ON flow_screens(screen_id);

CREATE TABLE IF NOT EXISTS scrape_app_state (
  app_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_run_id BIGINT REFERENCES scrape_runs(id) ON DELETE SET NULL,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, app_id)
);

