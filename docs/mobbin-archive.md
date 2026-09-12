# Mobbin archive pipeline

This project includes a GitHub Actions–only pipeline that archives Mobbin metadata in PostgreSQL and permitted media in Tigris Object Storage. The scraper is intentionally not invoked by the local development workflow.

## Architecture

1. Each job fetches Mobbin's searchable app index for one platform.
2. Eight deterministic shards divide apps by their position in that index.
3. Each app page is parsed for its richest screen and flow payload.
4. Images and videos are streamed directly from their source to Tigris—nothing is buffered on the GitHub runner's disk.
5. Media is deduplicated by the SHA-256 hash of its source URL. A content hash is recorded after upload.
6. PostgreSQL stores normalized app, version, screen, taxonomy, flow, hotspot, OCR, media, and run-state records. The original source objects are retained in `raw_data` JSONB columns.
7. Successful apps can be skipped for a configurable freshness window. Failed apps remain resumable on the next run.

Restricted media is recorded but not downloaded. HTTP 401/403 responses and unrecoverable rate limits fail the affected app; the pipeline does not attempt to circumvent access controls.

## Required GitHub Actions secrets

Configure these under **Repository settings → Secrets and variables → Actions**:

| Secret | Purpose |
| --- | --- |
| `SCRAPER_DATABASE_URL` | PostgreSQL pooler connection URL for archive metadata |
| `TIGRIS_ACCESS_KEY_ID` | Tigris S3-compatible access key |
| `TIGRIS_SECRET_ACCESS_KEY` | Tigris S3-compatible secret key |
| `TIGRIS_BUCKET` | Existing destination bucket name |
| `TIGRIS_ENDPOINT` | Tigris S3 endpoint, normally `https://fly.storage.tigris.dev` |
| `MOBBIN_COOKIE` | Initial authenticated Mobbin cookie header |
| `MOBBIN_ACCESS_TOKEN` | Initial Supabase access token used by Mobbin |
| `MOBBIN_REFRESH_TOKEN` | Initial Supabase refresh token used by Mobbin |
| `MOBBIN_SUPABASE_PROJECT_REF` | Mobbin's Supabase project reference |
| `MOBBIN_SUPABASE_ANON_KEY` | Mobbin's public Supabase anonymous key |
| `MOBBIN_IMAGE_HEAD` | Bytescale delivery prefix used to resolve Mobbin screen-image paths |

The initial Mobbin credentials seed `source_sessions` once. Rotated access/refresh tokens are then stored in PostgreSQL. Do not use the same refresh-token chain simultaneously in a browser and the workflow: Supabase rotates refresh tokens and concurrent owners can invalidate one another.

## Database model

- `source_sessions`: encrypted-at-rest provider session material used only by Actions.
- `scrape_runs`: one audit/checkpoint row per platform shard.
- `scrape_app_state`: retry and freshness state for each app.
- `apps`: canonical app identity and index metadata.
- `app_versions`: captured Mobbin versions.
- `screens`: dimensions, type, OCR, source URL, restriction state, and image reference.
- `screen_taxonomy`: UI elements and screen/animation patterns.
- `flows`: action hierarchy, popularity, restriction state, and video reference.
- `flow_screens`: ordered screen membership, hotspots, and video timestamps.
- `media_assets`: source-to-Tigris mapping, hashes, MIME type, size, ETag, and upload state.

The schema is idempotent and is applied by the workflow's `migrate` job before any scraper shards start.

## First run

Use **Actions → Archive Mobbin metadata and media → Run workflow**. A safer rollout is:

1. Choose `ios`, `1` shard, `max_apps=2`, and keep media enabled.
2. Confirm the Action, database rows, and Tigris objects look correct.
3. Run `all`, `8` shards, and `max_apps=0` for the complete archive.

The scheduled Sunday run skips apps successfully archived within the last 168 hours. Manual runs default to a complete refresh.

## Tigris object layout

Objects use deterministic keys:

```text
mobbin/{logo|screen|video}/{first-two-hash-chars}/{sha256(source-url)}.{extension}
```

This lets retries safely overwrite the same object and deduplicates repeated media across flows and apps. Keep the bucket private; application delivery should use signed URLs or a controlled proxy.
