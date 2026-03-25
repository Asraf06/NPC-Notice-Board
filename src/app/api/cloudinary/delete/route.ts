import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { withCors, corsOptionsResponse } from '@/lib/cors';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
    return corsOptionsResponse();
}

export async function POST(request: Request) {
    try {
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

        const body = await request.json();
        const { fileId } = body;

        if (!fileId) {
            return withCors(NextResponse.json({ error: 'Missing fileId.' }, { status: 400 }));
        }

        // We fetch Cloudinary settings from env
        // The frontend actually grabs settings from Firestore if missing, but we'll prioritize ENV vars
        const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
        const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

        // If ENV is missing (very common for this project if they only store in Firestore "settings" collection),
        // we'll fetch from Firestore here!
        let cloudName = CLOUDINARY_CLOUD_NAME;
        let apiKey = CLOUDINARY_API_KEY;
        let apiSecret = CLOUDINARY_API_SECRET;

        // Optional: If you rely strictly on backend env let's just assert them
        if (!cloudName || !apiKey || !apiSecret) {
            // we will need firebaseAdmin to fetch from DB if needed, but let's assume they added it to .env
            const adminDb = (await import('@/lib/firebaseAdmin')).adminDb;
            const configDoc = await adminDb.collection('settings').doc('config').get();
            if (configDoc.exists) {
                const config = configDoc.data();
                cloudName = cloudName || config?.cloudName;
                apiKey = apiKey || config?.cloudinaryApiKey; // Just in case
                apiSecret = apiSecret || config?.cloudinaryApiSecret;
            }
            if(!cloudName || !apiSecret || !apiKey) {
                 return withCors(NextResponse.json({ error: "Cloudinary configuration is missing in environment variables or database" }, { status: 500 }));
            }
        }

        const timestamp = Math.round(new Date().getTime() / 1000);
        // Signature string: public_id=xxx&timestamp=xxx + apiSecret
        const signatureParamsStr = `public_id=${fileId}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(signatureParamsStr).digest('hex');

        const formData = new URLSearchParams();
        formData.append('public_id', fileId);
        formData.append('signature', signature);
        formData.append('api_key', apiKey!);
        formData.append('timestamp', timestamp.toString());
        formData.append('resource_type', 'raw'); 

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/destroy`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        const data = await res.json();
        if (data.result !== 'ok' && data.result !== 'not found') {
            console.error('Cloudinary destroy error:', data);
            return withCors(NextResponse.json({ error: `Cloudinary error: ${data.result}` }, { status: 500 }));
        }

        return withCors(NextResponse.json({ success: true }));
    } catch (err) {
        console.error("Error deleting file from Cloudinary:", err);
        return withCors(NextResponse.json({ error: "Failed to delete file" }, { status: 500 }));
    }
}
