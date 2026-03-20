import { NextResponse } from 'next/server';

/**
 * CORS headers for API routes.
 * Allows the Capacitor Android WebView (which runs on http://localhost or capacitor://localhost)
 * to call our Vercel-hosted API routes without being blocked by CORS.
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Adds CORS headers to an existing NextResponse.
 */
export function withCors(response: NextResponse): NextResponse {
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}

/**
 * Returns an OPTIONS preflight response with CORS headers.
 * Export this as the OPTIONS handler in any API route that needs CORS.
 */
export function corsOptionsResponse(): NextResponse {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}
