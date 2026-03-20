import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';

export const dynamic = 'force-dynamic';

/**
 * POST /api/notifications/friend-request
 * 
 * Called after a friend request is sent. Sends an FCM push notification
 * to the recipient.
 * 
 * Body: { recipientUid, senderUid, senderName, senderPhoto, senderDept }
 */
export async function POST(request: Request) {
    try {
        const data = await request.json();
        const { recipientUid, senderUid, senderName, senderPhoto, senderDept } = data;

        if (!recipientUid || !senderUid) {
            return NextResponse.json({ error: 'Missing recipientUid or senderUid' }, { status: 400 });
        }

        // Get recipient's FCM tokens
        const recipientDoc = await adminDb.collection('students').doc(recipientUid).get();
        if (!recipientDoc.exists) {
            return NextResponse.json({ success: true, sent: 0, reason: 'Recipient not found' });
        }

        const recipientData = recipientDoc.data();
        const tokens: string[] = recipientData?.fcmTokens || [];

        if (tokens.length === 0) {
            console.log(`[FriendRequestNotif] No FCM tokens for recipient ${recipientUid}`);
            return NextResponse.json({ success: true, sent: 0 });
        }

        const adminApp = getApps()[0];
        const messaging = getMessaging(adminApp);

        const message = {
            notification: {
                title: `🤝 New Friend Request`,
                body: `${senderName} from ${senderDept} wants to connect with you.`,
            },
            data: {
                type: 'friend_request',
                url: '/social/friends?view=requests',
                title: `🤝 New Friend Request`,
                body: `${senderName} from ${senderDept} wants to connect with you.`,
                groupTag: 'friend-request'
            },
            android: {
                priority: 'high' as const,
                notification: {
                    channelId: 'system_default',
                    clickAction: 'FCM_PLUGIN_ACTIVITY',
                    defaultSound: true,
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    icon: senderPhoto || '/icons/icon-192x192.png',
                    badge: '/icons/icon-96x96.png'
                },
                fcm_options: {
                    link: '/social/friends?view=requests'
                }
            },
            tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`[FriendRequestNotif] ${senderName} → ${recipientUid}: ${response.successCount} sent`);

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

        return NextResponse.json({ success: true, sent: response.successCount });

    } catch (error) {
        console.error('[FriendRequestNotif] Error:', error);
        return NextResponse.json({ error: 'Failed to send friend request notification' }, { status: 500 });
    }
}
