import { NextResponse } from 'next/server';
import ImageKit from 'imagekit';
import { adminAuth } from '@/lib/firebaseAdmin';
import { withCors, corsOptionsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

// Handle CORS preflight requests from Capacitor WebView
export async function OPTIONS() {
    return corsOptionsResponse();
}

export async function POST(request: Request) {
    try {
        // Authenticate the user securely
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return withCors(NextResponse.json({ error: 'Unauthorized. Missing token.' }, { status: 401 }));
        }

        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Invalid ID token:', error);
            return withCors(NextResponse.json({ error: 'Unauthorized. Invalid token.' }, { status: 401 }));
        }

        const body = await request.json();
        const { fileId } = body;

        if (!fileId) {
            return withCors(NextResponse.json({ error: 'Missing fileId.' }, { status: 400 }));
        }

        const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
        const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
        const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

        if (!privateKey || !publicKey || !urlEndpoint) {
            return withCors(NextResponse.json({ error: "ImageKit configuration is missing in environment variables" }, { status: 500 }));
        }

        const imagekit = new ImageKit({
            publicKey,
            privateKey,
            urlEndpoint
        });

        // Delete from ImageKit
        await new Promise((resolve, reject) => {
            imagekit.deleteFile(fileId, function(error: any, result: any) {
                if(error) reject(error);
                else resolve(result);
            });
        });

        return withCors(NextResponse.json({ success: true }));
    } catch (err) {
        console.error("Error deleting file from ImageKit:", err);
        return withCors(NextResponse.json({ error: "Failed to delete file" }, { status: 500 }));
    }
}
