import { createHash } from 'node:crypto';
import { connectDatabase, migrate, type Database } from './db';
import { fetchAppDetails, fetchApps, type Platform, type SourceApp } from './source';
import { markRestrictedMedia, storeMedia, type MediaKind } from './storage';

type Options = {
  platforms: Platform[];
  shardIndex: number;
  shardCount: number;
  maxApps: number;
  freshHours: number;
  downloadMedia: boolean;
  mediaConcurrency: number;
};

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function integerArgument(name: string, fallback: number): number {
  const value = Number(argument(name) ?? fallback);
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${name} must be a non-negative integer`);
  return value;
}

function parseOptions(): Options {
  const platforms = (argument('platforms') || 'ios,android,web').split(',') as Platform[];
  if (platforms.some((platform) => !['ios', 'android', 'web'].includes(platform))) {
    throw new Error('--platforms must contain only ios, android, or web');
  }
  const shardCount = integerArgument('shard-count', 1);
  const shardIndex = integerArgument('shard-index', 0);
  if (shardCount < 1 || shardIndex >= shardCount) throw new Error('Invalid shard index/count');
  return {
    platforms,
    shardIndex,
    shardCount,
    maxApps: integerArgument('max-apps', 0),
    freshHours: integerArgument('fresh-hours', 0),
    mediaConcurrency: Math.max(1, integerArgument('media-concurrency', 3)),
    downloadMedia: argument('download-media') !== 'false',
  };
}

function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function date(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function taxonomyName(value: any): string {
  if (typeof value === 'string') return value;
  return value?.name || value?.title || value?.label || value?.slug || 'Unknown';
}

function taxonomyKey(value: any): string {
  if (typeof value === 'string') return value;
  return String(value?.id || value?.slug || value?.name ||
    createHash('sha256').update(json(value)).digest('hex').slice(0, 24));
}

function extractOcrText(regions: unknown): string {
  const text: string[] = [];
  const walk = (value: unknown, key = '') => {
    if (typeof value === 'string' && /text|value|label|content/i.test(key)) text.push(value);
    else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
    else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => walk(child, childKey));
    }
  };
  walk(regions);
  return [...new Set(text.map((value) => value.trim()).filter(Boolean))].join('\n');
}

function resolveMediaUrl(sourceUrl: string): string {
  const imageHead = process.env.MOBBIN_IMAGE_HEAD;
  if (!imageHead) return sourceUrl;
  try {
    const pathname = new URL(sourceUrl).pathname;
    const contentIndex = pathname.indexOf('content/');
    if (contentIndex >= 0) {
      return `${imageHead}${pathname.slice(contentIndex + 'content/'.length)}`;
    }
  } catch {
    // The storage layer will report malformed source URLs.
  }
  return sourceUrl;
}

async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  }));
}

async function shouldScrape(sql: Database, platform: Platform, appId: string, freshHours: number) {
  if (freshHours === 0) return true;
  const [row] = await sql<{ fresh: boolean }[]>`
    SELECT status = 'complete' AND last_success_at > now() - (${freshHours} * interval '1 hour') AS fresh
    FROM scrape_app_state WHERE platform = ${platform} AND app_id = ${appId}
  `;
  return !row?.fresh;
}

async function saveApp(
  sql: Database,
  runId: number,
  platform: Platform,
  app: SourceApp,
  options: Options,
): Promise<number> {
  await sql`
    INSERT INTO scrape_app_state (app_id, platform, status, attempts, last_run_id)
    VALUES (${app.id}, ${platform}, 'running', 1, ${runId})
    ON CONFLICT (platform, app_id) DO UPDATE
    SET status = 'running', attempts = scrape_app_state.attempts + 1,
        last_run_id = EXCLUDED.last_run_id, last_error = NULL, updated_at = now()
  `;

  try {
    const details = await fetchAppDetails(sql, platform, app.id);
    const firstScreen = details.screens[0] || {};
    const firstFlow = details.flows[0] || {};
    const versionId = String(firstScreen.appVersionId || firstFlow.appVersionId || `${app.id}:latest`);
    const logoUrl = app.appLogoCdnImgSources?.src || app.appLogoUrl || null;
    const assetIds = new Map<string, string>();
    const mediaErrors: string[] = [];
    let uploaded = 0;

    const assets: Array<{ url: string; sourceUrl: string; kind: MediaKind; restricted: boolean }> = [];
    const addAsset = (sourceUrl: string, kind: MediaKind, restricted: boolean) => {
      assets.push({ url: resolveMediaUrl(sourceUrl), sourceUrl, kind, restricted });
    };
    if (logoUrl) addAsset(logoUrl, 'logo', false);
    for (const screen of details.screens) {
      if (screen.screenUrl) addAsset(screen.screenUrl, 'screen', Boolean(screen.restricted));
    }
    for (const flow of details.flows) {
      const url = flow.videoCdnVideoSources?.src;
      if (url) addAsset(url, 'video', Boolean(flow.restricted));
    }

    const uniqueAssets = [...new Map(assets.map((asset) => [asset.url, asset])).values()];
    await mapLimit(uniqueAssets, options.mediaConcurrency, async (asset) => {
      try {
        if (asset.restricted) {
          assetIds.set(asset.sourceUrl, await markRestrictedMedia(sql, asset.url, asset.kind));
        } else if (options.downloadMedia) {
          const stored = await storeMedia(sql, asset.url, asset.kind);
          assetIds.set(asset.sourceUrl, stored.id);
          if (stored.uploaded) uploaded++;
        }
      } catch (error) {
        mediaErrors.push(`${asset.kind}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    const screenIds = new Set(details.screens.map((screen) => screen.id));
    await sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO apps (
          id, platform, name, slug, tagline, source_url, logo_source_url,
          logo_asset_id, preview_screens, raw_data
        ) VALUES (
          ${app.id}, ${platform}, ${app.appName || firstScreen.appName || 'Unknown'},
          ${app.slug || null}, ${app.appTagline || null}, ${details.sourceUrl}, ${logoUrl},
          ${logoUrl ? assetIds.get(logoUrl) || null : null},
          ${json(app.previewScreens || [])}::jsonb, ${json(app)}::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, slug = EXCLUDED.slug, tagline = EXCLUDED.tagline,
          source_url = EXCLUDED.source_url, logo_source_url = EXCLUDED.logo_source_url,
          logo_asset_id = COALESCE(EXCLUDED.logo_asset_id, apps.logo_asset_id),
          preview_screens = EXCLUDED.preview_screens, raw_data = EXCLUDED.raw_data, last_seen_at = now()
      `;
      await transaction`
        INSERT INTO app_versions (
          id, app_id, platform, published_at, captured_at, version_index, version_count, raw_data
        ) VALUES (
          ${versionId}, ${app.id}, ${platform},
          ${date(firstScreen.appVersionPublishedAt || firstFlow.appVersionPublishedAt)},
          ${date(firstScreen.createdAt)}, ${firstScreen.versionIndex ?? null},
          ${firstScreen.versionCount ?? null}, ${json({ firstScreen, firstFlow })}::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          published_at = EXCLUDED.published_at, captured_at = EXCLUDED.captured_at,
          version_index = EXCLUDED.version_index, version_count = EXCLUDED.version_count,
          raw_data = EXCLUDED.raw_data, scraped_at = now()
      `;

      for (const [position, screen] of details.screens.entries()) {
        const ocrRegions = screen.ocrBoundingBoxes || [];
        await transaction`
          INSERT INTO screens (
            id, app_version_id, position, screen_type, width, height, is_key_screen,
            restricted, source_url, image_asset_id, animation_id, ocr_text,
            ocr_regions, raw_data, created_at
          ) VALUES (
            ${screen.id}, ${versionId}, ${position}, ${screen.type || null},
            ${screen.width || null}, ${screen.height || null}, ${Boolean(screen.isAppKeyScreen)},
            ${Boolean(screen.restricted)}, ${screen.screenUrl || null},
            ${screen.screenUrl ? assetIds.get(screen.screenUrl) || null : null},
            ${screen.animation_id || null}, ${extractOcrText(ocrRegions)},
            ${json(ocrRegions)}::jsonb, ${json(screen)}::jsonb, ${date(screen.createdAt)}
          )
          ON CONFLICT (id) DO UPDATE SET
            app_version_id = EXCLUDED.app_version_id, position = EXCLUDED.position,
            screen_type = EXCLUDED.screen_type, width = EXCLUDED.width, height = EXCLUDED.height,
            is_key_screen = EXCLUDED.is_key_screen, restricted = EXCLUDED.restricted,
            source_url = EXCLUDED.source_url,
            image_asset_id = COALESCE(EXCLUDED.image_asset_id, screens.image_asset_id),
            animation_id = EXCLUDED.animation_id, ocr_text = EXCLUDED.ocr_text,
            ocr_regions = EXCLUDED.ocr_regions, raw_data = EXCLUDED.raw_data, updated_at = now()
        `;

        await transaction`DELETE FROM screen_taxonomy WHERE screen_id = ${screen.id}`;
        const taxonomies: Array<[string, any[]]> = [
          ['ui_element', screen.screenElements || []],
          ['screen_pattern', screen.screenPatterns || []],
          ['animation_ui_element', screen.animation_ui_elements || []],
          ['animation_screen_pattern', screen.animation_screen_patterns || []],
        ];
        for (const [type, values] of taxonomies) {
          for (const value of values) {
            await transaction`
              INSERT INTO screen_taxonomy (screen_id, taxonomy_type, taxonomy_key, name, raw_data)
              VALUES (${screen.id}, ${type}, ${taxonomyKey(value)}, ${taxonomyName(value)}, ${json(value)}::jsonb)
              ON CONFLICT (screen_id, taxonomy_type, taxonomy_key) DO UPDATE
              SET name = EXCLUDED.name, raw_data = EXCLUDED.raw_data
            `;
          }
        }
      }

      for (const flow of details.flows) {
        const videoUrl = flow.videoCdnVideoSources?.src || null;
        await transaction`
          INSERT INTO flows (
            id, app_version_id, name, actions, position, popularity_metric,
            restricted, source_video_url, video_asset_id, raw_data
          ) VALUES (
            ${flow.id}, ${versionId}, ${flow.name || 'Unnamed flow'},
            ${json(flow.actions || [])}::jsonb, ${flow.order ?? null},
            ${flow.popularityMetric ?? null}, ${Boolean(flow.restricted)}, ${videoUrl},
            ${videoUrl ? assetIds.get(videoUrl) || null : null}, ${json(flow)}::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            app_version_id = EXCLUDED.app_version_id, name = EXCLUDED.name,
            actions = EXCLUDED.actions, position = EXCLUDED.position,
            popularity_metric = EXCLUDED.popularity_metric, restricted = EXCLUDED.restricted,
            source_video_url = EXCLUDED.source_video_url,
            video_asset_id = COALESCE(EXCLUDED.video_asset_id, flows.video_asset_id),
            raw_data = EXCLUDED.raw_data, updated_at = now()
        `;
        await transaction`DELETE FROM flow_screens WHERE flow_id = ${flow.id}`;
        for (const [position, flowScreen] of (flow.screens || []).entries()) {
          if (!flowScreen.screenId || !screenIds.has(flowScreen.screenId)) continue;
          await transaction`
            INSERT INTO flow_screens (
              flow_id, screen_id, position, hotspot_type, hotspot_x, hotspot_y,
              hotspot_width, hotspot_height, video_timestamp, raw_data
            ) VALUES (
              ${flow.id}, ${flowScreen.screenId}, ${flowScreen.order ?? position},
              ${flowScreen.hotspotType || null}, ${flowScreen.hotspotX ?? null},
              ${flowScreen.hotspotY ?? null}, ${flowScreen.hotspotWidth ?? null},
              ${flowScreen.hotspotHeight ?? null}, ${flowScreen.videoTimestamp ?? null},
              ${json(flowScreen)}::jsonb
            ) ON CONFLICT (flow_id, screen_id, position) DO UPDATE SET
              hotspot_type = EXCLUDED.hotspot_type, hotspot_x = EXCLUDED.hotspot_x,
              hotspot_y = EXCLUDED.hotspot_y, hotspot_width = EXCLUDED.hotspot_width,
              hotspot_height = EXCLUDED.hotspot_height,
              video_timestamp = EXCLUDED.video_timestamp, raw_data = EXCLUDED.raw_data
          `;
        }
      }

      await transaction`
        UPDATE scrape_app_state SET status = ${mediaErrors.length ? 'failed' : 'complete'},
          last_success_at = ${mediaErrors.length ? null : new Date()},
          last_error = ${mediaErrors.length ? mediaErrors.slice(0, 5).join('\n').slice(0, 2_000) : null},
          updated_at = now()
        WHERE platform = ${platform} AND app_id = ${app.id}
      `;
    });
    if (mediaErrors.length) {
      throw new Error(`${mediaErrors.length} media upload(s) failed; metadata was saved and the app remains resumable`);
    }
    return uploaded;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      UPDATE scrape_app_state SET status = 'failed', last_error = ${message.slice(0, 2_000)}, updated_at = now()
      WHERE platform = ${platform} AND app_id = ${app.id}
    `;
    throw error;
  }
}

async function main() {
  const options = parseOptions();
  const sql = connectDatabase();
  let totalFailures = 0;

  try {
    await migrate(sql);
    for (const platform of options.platforms) {
      const apps = await fetchApps(sql, platform);
      let selected = apps.filter((_app, index) => index % options.shardCount === options.shardIndex);
      if (options.maxApps > 0) selected = selected.slice(0, options.maxApps);
      const [run] = await sql<{ id: number }[]>`
        INSERT INTO scrape_runs (
          github_run_id, github_job, platform, shard_index, shard_count, status, apps_discovered
        ) VALUES (
          ${process.env.GITHUB_RUN_ID || null}, ${process.env.GITHUB_JOB || null},
          ${platform}, ${options.shardIndex}, ${options.shardCount}, 'running', ${apps.length}
        ) RETURNING id
      `;
      let processed = 0;
      let skipped = 0;
      let failed = 0;
      let mediaUploaded = 0;

      for (const app of selected) {
        if (!(await shouldScrape(sql, platform, app.id, options.freshHours))) {
          skipped++;
          continue;
        }
        try {
          mediaUploaded += await saveApp(sql, run.id, platform, app, options);
          processed++;
          console.log(`[${platform} ${options.shardIndex}/${options.shardCount}] saved ${app.appName || app.id}`);
        } catch (error) {
          failed++;
          console.error(`[${platform}] failed ${app.appName || app.id}:`, error);
        }
        await sql`
          UPDATE scrape_runs SET apps_processed = ${processed}, apps_skipped = ${skipped},
            apps_failed = ${failed}, media_uploaded = ${mediaUploaded}
          WHERE id = ${run.id}
        `;
      }

      const status = failed > 0 ? 'partial' : 'complete';
      await sql`
        UPDATE scrape_runs SET status = ${status}, apps_processed = ${processed},
          apps_skipped = ${skipped}, apps_failed = ${failed}, media_uploaded = ${mediaUploaded},
          finished_at = now() WHERE id = ${run.id}
      `;
      totalFailures += failed;
    }
  } finally {
    await sql.end();
  }

  if (totalFailures > 0) {
    throw new Error(`${totalFailures} app(s) failed; rerun the workflow to resume them.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
