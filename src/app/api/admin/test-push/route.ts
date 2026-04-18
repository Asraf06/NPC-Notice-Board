import { NextResponse } from 'next/server';
import { adminDb, adminMessaging, adminAuth } from '../../../../lib/firebaseAdmin';

// Helper to add CORS headers
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

// Handle preflight requests for Capacitor
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() });
}

export async function POST(request: Request) {
    try {
        // ── STEP 1: Verify Firebase Auth Token ──
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized: Missing auth token.' },
                { status: 401, headers: corsHeaders() }
            );
        }

        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (verifyError: any) {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid or expired token.' },
                { status: 401, headers: corsHeaders() }
            );
        }

        const authenticatedUid = decodedToken.uid;

        // ── STEP 2: Parse request body ──
        const body = await request.json();
        const { targetUid, messageContent } = body;

        if (!targetUid) {
            return NextResponse.json({ error: 'Missing targetUid' }, { status: 400, headers: corsHeaders() });
        }

        // ── STEP 3: Ensure user can only test-push to THEMSELVES ──
        if (authenticatedUid !== targetUid) {
            return NextResponse.json(
                { error: 'Forbidden: You can only send test pushes to your own device.' },
                { status: 403, headers: corsHeaders() }
            );
        }

        // Get the target student's document to find their FCM tokens
        const studentDoc = await adminDb.collection('students').doc(targetUid).get();
        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found.' }, { status: 404, headers: corsHeaders() });
        }

        const data = studentDoc.data()!;
        const fcmTokens: string[] = data.fcmTokens || [];

        if (fcmTokens.length === 0) {
            return NextResponse.json({ error: 'No FCM tokens found on device. App must be opened once with internet to register.' }, { status: 400, headers: corsHeaders() });
        }

        const title = "Cloud Push Successful! ☁️";
        const bodyText = messageContent || "Your Vercel FCM connection is working perfectly at extremely high speed.";

        const message = {
            notification: {
                title,
                body: bodyText
            },
            data: {
                type: 'system'
            },
            tokens: fcmTokens // Send specifically to the requester's devices array
        };

        const response = await adminMessaging.sendEachForMulticast(message);
        
        return NextResponse.json({ 
            success: true, 
            message: `Cloud test triggered successfully. Sent to ${response.successCount} devices.`
        }, { headers: corsHeaders() });

    } catch (e: any) {
        console.error("Test Push Error:", e);
        return NextResponse.json({ error: e.message || 'Unknown server error.' }, { status: 500, headers: corsHeaders() });
    }
}

