import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getCookie } from '@/utils/tokens';

function transformImageUrl(originalUrl: string, imageHead: string): string {
  try {
    const pathname = new URL(originalUrl).pathname;
    const contentIndex = pathname.indexOf('content/');
    if (contentIndex !== -1) {
      return `${imageHead}${pathname.substring(contentIndex + 'content/'.length)}`;
    }
  } catch (error) {
    console.error('Error transforming image URL:', error);
  }
  return originalUrl;
}

function extractFlightData(html: string): string {
  let flightData = '';
  const chunks = html.matchAll(/<script[^>]*>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g);

  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk[1]);
      if (typeof parsed[1] === 'string') flightData += parsed[1];
    } catch {
      // Ignore unrelated or incomplete RSC chunks.
    }
  }

  return flightData;
}

function extractJsonArrays(flightData: string, marker: string): any[][] {
  const arrays: any[][] = [];
  const needle = `"${marker}":`;
  let searchFrom = 0;

  while (searchFrom < flightData.length) {
    const markerIndex = flightData.indexOf(needle, searchFrom);
    if (markerIndex < 0) break;

    const start = flightData.indexOf('[', markerIndex + needle.length);
    if (start < 0) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let index = start; index < flightData.length; index++) {
      const character = flightData[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }

      if (character === '"') inString = true;
      else if (character === '[') depth++;
      else if (character === ']' && --depth === 0) {
        end = index;
        break;
      }
    }

    if (end < 0) break;
    try {
      const value = JSON.parse(flightData.slice(start, end + 1));
      if (Array.isArray(value)) arrays.push(value);
    } catch {
      // Keep scanning when a similarly named field is not plain JSON.
    }
    searchFrom = markerIndex + needle.length;
  }

  return arrays;
}

function selectScreens(flightData: string): any[] | null {
  return extractJsonArrays(flightData, 'screens')
    .filter((candidate) => candidate.some((screen) => screen?.id && screen?.screenUrl))
    .sort((left, right) => right.length - left.length)[0] || null;
}

function selectFlows(flightData: string): any[] | null {
  const score = (flows: any[]) => flows.reduce(
    (total, flow) => total + (Array.isArray(flow?.screens) ? flow.screens.length : 0),
    0,
  );

  return extractJsonArrays(flightData, 'partialFlows')
    .filter((candidate) => candidate.some((flow) => flow?.id && flow?.name))
    .sort((left, right) => score(right) - score(left) || right.length - left.length)[0] || null;
}

export async function POST(request: NextRequest) {
  try {
    const { filterAppVersionId: appId, platform = 'ios' } = await request.json();
    if (!appId || typeof appId !== 'string') {
      return NextResponse.json({ error: 'An app ID is required' }, { status: 400 });
    }

    const safePlatform = ['ios', 'android', 'web'].includes(platform) ? platform : 'ios';
    const sql = neon(process.env.DATABASE_URL!);
    const cookieRows = await sql`SELECT cookie FROM tokens WHERE id = 1`;
    let cookie = cookieRows[0]?.cookie as string | undefined;
    if (!cookie) throw new Error('No Mobbin session is saved');

    const mobbinUrl = `https://mobbin.com/apps/app-${safePlatform}-${appId}/_/flows`;
    const fetchPage = (sessionCookie: string) => fetch(mobbinUrl, {
      headers: { Cookie: sessionCookie, Accept: 'text/html' },
      signal: AbortSignal.timeout(30000),
    });

    let response = await fetchPage(cookie);
    let html = await response.text();
    let flightData = extractFlightData(html);
    let screens = selectScreens(flightData);
    let partialFlows = selectFlows(flightData);

    if (!response.ok || !screens || !partialFlows) {
      cookie = await getCookie();
      response = await fetchPage(cookie);
      html = await response.text();
      flightData = extractFlightData(html);
      screens = selectScreens(flightData);
      partialFlows = selectFlows(flightData);
    }

    if (!response.ok || !screens || !partialFlows) {
      throw new Error('Mobbin did not return its screen and flow metadata');
    }

    const imageHead = process.env.IMAGE_HEAD || '';
    const normalizedScreens = screens.map((screen: any, index: number) => ({
      id: screen.id,
      order: index,
      createdAt: screen.createdAt || null,
      pageUrl: null,
      hotspotX: null,
      hotspotY: null,
      metadata: { width: screen.width || 0, height: screen.height || 0 },
      pageType: screen.type || null,
      screenId: screen.id,
      screenUrl: screen.screenUrl ? transformImageUrl(screen.screenUrl, imageHead) : '',
      hotspotType: null,
      hotspotWidth: null,
      pagePatterns: [],
      hotspotHeight: null,
      screenElements: screen.screenElements || [],
      screenPatterns: screen.screenPatterns || [],
      isAppKeyScreen: Boolean(screen.isAppKeyScreen),
      ocrBoundingBoxes: screen.ocrBoundingBoxes || [],
      restricted: Boolean(screen.restricted),
      animationId: screen.animation_id || null,
      animationScreenPatterns: screen.animation_screen_patterns || [],
      animationUiElements: screen.animation_ui_elements || [],
      videoTimestamp: null,
    }));

    const screenMap = new Map(normalizedScreens.map((screen: any) => [screen.id, screen]));
    const firstScreen = screens[0] || {};
    const publishedAt = firstScreen.appVersionPublishedAt || null;
    const common = {
      appName: firstScreen.appName || 'App',
      platform: firstScreen.platform || safePlatform,
      createdAt: firstScreen.createdAt || null,
      publishedAt,
      versionIndex: 0,
      versionCount: 1,
    };

    const allScreensFlow = {
      id: 'all-screens',
      name: 'All screens & UI elements',
      ...common,
      actions: ['All screens & UI elements'],
      order: -1,
      popularityMetric: null,
      videoUrl: null,
      parentAppSectionId: null,
      screens: normalizedScreens,
    };

    const flows = partialFlows.map((flow: any) => ({
      id: flow.id,
      name: flow.name,
      ...common,
      publishedAt: flow.appVersionPublishedAt || publishedAt,
      actions: flow.actions || [flow.name],
      order: flow.order ?? 0,
      popularityMetric: flow.popularityMetric ?? null,
      videoUrl: flow.videoCdnVideoSources?.src || null,
      parentAppSectionId: null,
      restricted: Boolean(flow.restricted),
      screens: (flow.screens || []).flatMap((flowScreen: any) => {
        const screen = screenMap.get(flowScreen.screenId) as any;
        if (!screen) return [];
        return [{
          ...screen,
          order: flowScreen.order ?? screen.order,
          hotspotType: flowScreen.hotspotType || null,
          hotspotX: flowScreen.hotspotX ?? null,
          hotspotY: flowScreen.hotspotY ?? null,
          hotspotWidth: flowScreen.hotspotWidth ?? null,
          hotspotHeight: flowScreen.hotspotHeight ?? null,
          videoTimestamp: flowScreen.videoTimestamp == null
            ? null
            : String(flowScreen.videoTimestamp),
        }];
      }),
    }));

    return NextResponse.json([allScreensFlow, ...flows]);
  } catch (error) {
    console.error('Error fetching Mobbin metadata:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Mobbin metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
