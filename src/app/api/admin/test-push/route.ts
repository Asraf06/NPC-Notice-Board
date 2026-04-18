import { NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '../../../../lib/firebaseAdmin';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { targetUid, messageContent } = body;

        if (!targetUid) {
            return NextResponse.json({ error: 'Missing targetUid' }, { status: 400 });
        }

        // Get the target student's document to find their FCM tokens
        const studentDoc = await adminDb.collection('students').doc(targetUid).get();
        if (!studentDoc.exists) {
            return NextResponse.json({ error: 'Student not found.' }, { status: 404 });
        }

        const data = studentDoc.data()!;
        const fcmTokens: string[] = data.fcmTokens || [];

        if (fcmTokens.length === 0) {
            return NextResponse.json({ error: 'No FCM tokens found on device. App must be opened once with internet to register.' }, { status: 400 });
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
        });

    } catch (e: any) {
        console.error("Test Push Error:", e);
        return NextResponse.json({ error: e.message || 'Unknown server error.' }, { status: 500 });
    }
}
