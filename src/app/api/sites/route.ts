import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getCookie } from '@/utils/tokens';

// Helper function to extract slug from URL
function extractSlugFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Find the index of "content/" in the path
    const contentIndex = pathname.indexOf('content/');
    if (contentIndex !== -1) {
      // Extract everything after "content/"
      const contentPath = pathname.substring(contentIndex + 'content/'.length);
      // Remove file extension to get the slug
      return contentPath
    }
    
    // Fallback to original logic if "content/" is not found
    const pathParts = pathname.split('/');
    const filename = pathParts[pathParts.length - 1];
    return filename.split('.')[0];
  } catch (error) {
    console.error('Error extracting slug from URL:', url, error);
    return null;
  }
}

// Helper function to transform image URLs
function transformImageUrl(originalUrl: string, imageHead: string): string {
  const slug = extractSlugFromUrl(originalUrl);
  if (slug) {
    return `${imageHead}${slug}`;
  }
  return originalUrl; // Fallback to original URL if slug extraction fails
}

export async function POST(request: NextRequest) {
  try {
    const {
      platform = 'ios',
      filterOperator = 'or',
      appCategories = [],
      screenElements = [],
      screenPatterns = [],
      isSubsequentRequest = false,
      pageIndex = 0,
      pageSize = 10,
      sortBy = 'popularity',
      freeTextSearchQuery = null
    } = await request.json();

    const sql = neon(process.env.DATABASE_URL!);
    const cookieRows = await sql`SELECT cookie FROM tokens WHERE id = 1`;
    let cookie = cookieRows[0]?.cookie as string | undefined;

    if (!cookie) {
      throw new Error('No Mobbin session is saved');
    }

    const fetchApps = (sessionCookie: string) => fetch(
      'https://mobbin.com/api/search-bar/fetch-searchable-apps',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': sessionCookie,
        },
        body: JSON.stringify({ platform }),
        signal: AbortSignal.timeout(30000),
      }
    );

    let response = await fetchApps(cookie);
    let mobbinData = await response.json();

    // Mobbin reports an expired session as a JSON error with HTTP 200.
    if (mobbinData?.error?.message === 'unauthenticated') {
      cookie = await getCookie();
      response = await fetchApps(cookie);
      mobbinData = await response.json();
    }

    if (!response.ok || mobbinData?.error) {
      throw new Error(
        mobbinData?.error?.message || `Mobbin API responded with status ${response.status}`
      );
    }

    // Get image head from environment variable
    const imageHead = process.env.IMAGE_HEAD || '';
    
    // Check if we have valid data
    if (!Array.isArray(mobbinData?.value)) {
      console.error('Invalid response structure from Mobbin API:', mobbinData);
      throw new Error('Invalid response structure from Mobbin API');
    }

    const query = typeof freeTextSearchQuery === 'string'
      ? freeTextSearchQuery.trim().toLowerCase()
      : '';
    const matchingApps = mobbinData.value.filter((app: any) =>
      !query || app.appName?.toLowerCase().includes(query) || app.appTagline?.toLowerCase().includes(query)
    );
    const start = pageIndex * pageSize;

    // The replacement endpoint returns apps with four preview screens each.
    const transformedSites = matchingApps.slice(start, start + pageSize).map((app: any) => {
      const previewScreens = Array.isArray(app.previewScreens)
        ? app.previewScreens.map((screen: any) => ({
            ...screen,
            screenUrl: screen.screenUrl
              ? transformImageUrl(screen.screenUrl, imageHead)
              : screen.screenUrl,
          }))
        : [];

      return {
        ...app,
        appVersionId: app.id,
        appLogoUrl: app.appLogoCdnImgSources?.src,
        previewScreens,
        screenUrl: previewScreens[0]?.screenUrl,
        fullpageScreenUrl: previewScreens[0]?.screenUrl,
      };
    });

    const result = {
      sites: transformedSites,
      totalCount: matchingApps.length,
      pageIndex,
      pageSize,
      hasMore: start + transformedSites.length < matchingApps.length,
      filterCriteria: {
        filterOperator,
        appCategories,
        screenElements,
        screenPatterns,
        isSubsequentRequest,
        pageIndex,
        pageSize,
        sortBy
      }
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in sites POST route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
