import { NextRequest, NextResponse } from 'next/server';

const querystring = require("querystring");

function parseCookies(cookieStr: string): Record<string, any> {
  const cookies: Record<string, any> = {};
  const pairs = cookieStr.split(/;\s*/);

  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;

    const key = pair.slice(0, idx);
    let value = pair.slice(idx + 1);

    try {
      // Try to decode URI component
      value = decodeURIComponent(value);

      // Try to parse JSON if applicable
      if (value.startsWith('{') || value.startsWith('[')) {
        value = JSON.parse(value);
      }
    } catch (e) {
      // Ignore JSON parse errors, just keep raw string
    }

    cookies[key] = value;
  }

  return cookies;
}

function generateAuthCookies(tokenObj: any, opts: any = {}) {
    const prefix    = opts.prefix    || `sb-${process.env.MOBBIN_SUPABASE}-auth-token`;
    const chunkSize = opts.chunkSize || 3600;
  
    // 1) stringify and URL‑encode the whole payload
    const json    = JSON.stringify(tokenObj);
    const encoded = encodeURIComponent(json);
  
    // 2) split into chunks with correct indexing
    let cookies = ""
    let chunkIndex = 0;
    for (let i = 0; i < encoded.length; i += chunkSize) {
      const chunk = encoded.slice(i, i + chunkSize);
      cookies += (`${prefix}.${chunkIndex}=${chunk}; `);
      chunkIndex++;
    }
  
    return cookies.trim();
  }

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();


  // URL-encode the string
  const encoded = generateAuthCookies(body, {
    prefix: `sb-${process.env.MOBBIN_SUPABASE}-auth-token`,
    chunkSize: 3800
  });
    
    return NextResponse.json(encoded);

  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }
}
