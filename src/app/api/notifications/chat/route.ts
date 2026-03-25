import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';
import { withCors, corsOptionsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

// Handle CORS preflight requests from Capacitor WebView
export async function OPTIONS() {
    return corsOptionsResponse();
}

/**
 * POST /api/notifications/chat
 * 
 * Called after a DM message is sent. Sends an FCM push notification
 * to the recipient.
 * 
 * Body: { recipientUid, senderUid, senderName, messagePreview }
 */
export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { recipientUid, senderUid, senderName, messagePreview } = data;

        if (!recipientUid || !senderUid) {
            return withCors(NextResponse.json({ error: 'Missing recipientUid or senderUid' }, { status: 400 }));
        }

        // Don't notify yourself
        if (recipientUid === senderUid) {
            return withCors(NextResponse.json({ success: true, sent: 0 }));
        }

        // Get recipient's FCM tokens
        const recipientDoc = await adminDb.collection('students').doc(recipientUid).get();
        if (!recipientDoc.exists) {
            return withCors(NextResponse.json({ success: true, sent: 0, reason: 'Recipient not found' }));
        }

        const recipientData = recipientDoc.data();
        const tokens: string[] = recipientData?.fcmTokens || [];

        if (tokens.length === 0) {
            console.log(`[ChatNotif] No FCM tokens for recipient ${recipientUid}`);
            return withCors(NextResponse.json({ success: true, sent: 0 }));
        }

        const body = messagePreview || 'New message';

        const adminApp = getApps()[0];
        const messaging = getMessaging(adminApp);
        const channelId = recipientData?.messageSound === 'message_alternate' ? 'message_alternate' : 'message_default';

        const message = {
            notification: {
                title: `💬 ${senderName || 'Someone'}`,
                body,
            },
            data: {
                type: 'chat',
                chatWith: senderUid,
                title: `💬 ${senderName || 'Someone'}`,
                body,
                groupTag: 'chat-message'
            },
            android: {
                priority: 'high' as const,
                notification: {
                    channelId: channelId,
                    defaultSound: false,
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high'
                }
            },
            tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`[ChatNotif] ${senderName} → ${recipientUid}: ${response.successCount} sent, ${response.failureCount} failed`);

        // Clean up invalid tokens
        if (response.failureCount > 0) {
            const invalidTokens: string[] = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    if (errorCode === 'messaging/invalid-registration-token' ||
                        errorCode === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });

            if (invalidTokens.length > 0) {
                const cleaned = tokens.filter(t => !invalidTokens.includes(t));
                await adminDb.collection('students').doc(recipientUid).update({ fcmTokens: cleaned });
            }
        }

        return withCors(NextResponse.json({ success: true, sent: response.successCount }));

    } catch (error) {
        console.error('[ChatNotif] Error:', error);
        return withCors(NextResponse.json({ error: 'Failed to send chat notification' }, { status: 500 }));
    }
}
