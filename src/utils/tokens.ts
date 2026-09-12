import { neon } from "@neondatabase/serverless";

export const getCookie = async () => {
    try {
        const sql = neon(process.env.DATABASE_URL!);
        const tokens = await sql`
        SELECT * FROM tokens WHERE id = 1
        `;
        
        const accessToken = tokens[0].access_token;
        const refreshToken = tokens[0].refresh_token;


        // console.log(accessToken, refreshToken, "--------------");

        const response = await fetch(`https://${process.env.MOBBIN_SUPABASE}.supabase.co/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.MOBBIN_APIKEY!
            },
            body: JSON.stringify({
                refresh_token: refreshToken
            })
        });
        // console.log(response, "--------------");
        const data2 = await response.json();

        const newAccessToken = data2.access_token;
        const newRefreshToken = data2.refresh_token;

        const cookie = generateAuthCookies(data2, {
            prefix: `sb-${process.env.MOBBIN_SUPABASE}-auth-token`,
            chunkSize: 3600
        });
        // console.log(newRefreshToken, "--------------");

        if(!newAccessToken || !newRefreshToken || !cookie){
            throw new Error("Failed to get new tokens");
        }

        await sql`
        UPDATE tokens SET access_token = ${newAccessToken}, refresh_token = ${newRefreshToken}, cookie = ${cookie} WHERE id = 1
        `;

        return cookie;
    } catch (error) {
        console.error('Error calling API:', error);
        throw error;
    }
}


function generateAuthCookies(tokenObj: any, opts: any = {}) {
    const prefix    = opts.prefix    || 'sb-ujasntkfphywizsdaapi-auth-token';
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
