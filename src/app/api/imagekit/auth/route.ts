import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminAuth } from '@/lib/firebaseAdmin';
import { withCors, corsOptionsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

// Handle CORS preflight requests from Capacitor WebView
export async function OPTIONS() {
    return corsOptionsResponse();
}

export async function GET(request: Request) {
    try {
        // Authenticate the user securely
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return withCors(NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 }));
        }

        const idToken = authHeader.split('Bearer ')[1];
        try {
            await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Invalid ID token:', error);
            return withCors(NextResponse.json({ error: 'Unauthorized. Invalid token.' }, { status: 401 }));
        }

        // Generate ImageKit Signature
        const token = crypto.randomUUID();
        const expire = Math.floor(Date.now() / 1000) + 60 * 30; // 30 minutes
        const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
        const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
        const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

        if (!privateKey || !publicKey || !urlEndpoint) {
            return withCors(NextResponse.json({ error: "ImageKit configuration is missing in environment variables" }, { status: 500 }));
        }

        const signature = crypto
            .createHmac('sha1', privateKey)
            .update(token + expire)
            .digest('hex');

        return withCors(NextResponse.json({
            token,
            expire,
            signature,
            publicKey,
            urlEndpoint,
        }));
    } catch (err) {
        console.error("Error generating ImageKit auth:", err);
        return withCors(NextResponse.json({ error: "Failed to generate auth signature" }, { status: 500 }));
    }
}
