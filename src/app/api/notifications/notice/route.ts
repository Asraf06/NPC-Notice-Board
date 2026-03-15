import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { getMessaging } from 'firebase-admin/messaging';
import { getApps } from 'firebase-admin/app';

export const dynamic = 'force-dynamic';

// CORS headers for cross-origin requests (admin HTML panel)
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/notifications/notice
 * 
 * Called after a new notice is created. Sends FCM push notifications
 * to all students matching the notice's target dept/sem/section,
 * and creates notification history entries.
 * 
 * Body: { noticeId, title, body, author, authorUid, category, targetDept, targetSem, targetSection }
 */
export async function POST(request: Request) {
    try {
        const data = await request.json();
        const {
            noticeId,
            title,
            body,
            author,
            authorUid,
            category = 'general',
            targetDept = 'All',
            targetSem = 'All',
            targetSection = 'all',
        } = data;

        if (!noticeId || !title) {
            return NextResponse.json({ error: 'Missing noticeId or title' }, { status: 400, headers: corsHeaders });
        }

        const normalizedDept = (targetDept || 'All').toLowerCase();
        const normalizedSem = (targetSem || 'All').toLowerCase();
        const normalizedSection = (targetSection || 'all').toLowerCase();

        console.log(`[NoticeNotif] Notice "${title}" for dept=${normalizedDept}, sem=${normalizedSem}, section=${normalizedSection}`);

        // Get all students
        const studentsSnap = await adminDb.collection('students').get();

        const tokens: string[] = [];
        const batch = adminDb.batch();
        let notifCount = 0;

        studentsSnap.forEach((studentDoc) => {
            const student = studentDoc.data();
            const studentUid = studentDoc.id;
            const studentDept = (student.dept || '').toLowerCase();
            const studentSem = (student.sem || '').toLowerCase();
            const studentSection = (student.section || '').toLowerCase();

            // Skip the author
            if (student.uid === authorUid || studentUid === authorUid) return;

            // Department match
            if (normalizedDept !== 'all' && studentDept !== normalizedDept) return;

            // Semester match
            if (normalizedSem !== 'all' && studentSem !== normalizedSem) return;

            // Section match
            if (normalizedSection !== 'all' && studentSection !== normalizedSection) return;

            // Collect FCM tokens
            if (student.fcmTokens && Array.isArray(student.fcmTokens)) {
                tokens.push(...student.fcmTokens);
            }

            // Create notification history entry
            const notifRef = adminDb
                .collection('students').doc(studentUid)
                .collection('notifications').doc();

            batch.set(notifRef, {
                noticeId,
                title,
                body: (body || '').substring(0, 150),
                author: author || 'Unknown',
                category,
                timestamp: new Date(),
                viewed: false,
            });
            notifCount++;
        });

        // Commit notification history
        if (notifCount > 0) {
            await batch.commit();
            console.log(`[NoticeNotif] Created ${notifCount} notification history entries`);
        }

        // Send FCM push notifications
        if (tokens.length > 0) {
            const uniqueTokens = [...new Set(tokens)];
            console.log(`[NoticeNotif] Sending to ${uniqueTokens.length} FCM tokens`);

            const adminApp = getApps()[0];
            const messaging = getMessaging(adminApp);

            // FCM limit: 500 tokens per multicast
            const chunks: string[][] = [];
            for (let i = 0; i < uniqueTokens.length; i += 500) {
                chunks.push(uniqueTokens.slice(i, i + 500));
            }

            let totalSuccess = 0;
            let totalFailure = 0;

            for (const chunk of chunks) {
                const message = {
                    data: {
                        type: 'notice',
                        noticeId,
                        title: `📢 ${title}`,
                        body: (body || '').substring(0, 100),
                        category,
                        groupTag: (author || '').toLowerCase().includes('admin') ? 'admin-notice' : 'class-notice'
                    },
                    android: {
                        priority: 'high' as const,
                    },
                    webpush: {
                        headers: {
                            Urgency: 'high'
                        }
                    },
                    tokens: chunk,
                };

                const response = await messaging.sendEachForMulticast(message);
                totalSuccess += response.successCount;
                totalFailure += response.failureCount;

                // Clean up invalid tokens
                if (response.failureCount > 0) {
                    const invalidTokens: string[] = [];
                    response.responses.forEach((resp, idx) => {
                        if (!resp.success) {
                            const errorCode = resp.error?.code;
                            if (errorCode === 'messaging/invalid-registration-token' ||
                                errorCode === 'messaging/registration-token-not-registered') {
                                invalidTokens.push(chunk[idx]);
                            }
                        }
                    });

                    if (invalidTokens.length > 0) {
                        console.log(`[NoticeNotif] Removing ${invalidTokens.length} invalid tokens`);
                        const allStudents = await adminDb.collection('students').get();
                        const cleanupBatch = adminDb.batch();
                        allStudents.forEach((doc) => {
                            const d = doc.data();
                            if (d.fcmTokens && Array.isArray(d.fcmTokens)) {
                                const cleaned = d.fcmTokens.filter((t: string) => !invalidTokens.includes(t));
                                if (cleaned.length !== d.fcmTokens.length) {
                                    cleanupBatch.update(doc.ref, { fcmTokens: cleaned });
                                }
                            }
                        });
                        await cleanupBatch.commit();
                    }
                }
            }

            console.log(`[NoticeNotif] Done: ${totalSuccess} success, ${totalFailure} failures`);
            return NextResponse.json({ success: true, sent: totalSuccess, failed: totalFailure, notified: notifCount }, { headers: corsHeaders });
        }

        console.log('[NoticeNotif] No FCM tokens found for matching students');
        return NextResponse.json({ success: true, sent: 0, notified: notifCount }, { headers: corsHeaders });

    } catch (error) {
        console.error('[NoticeNotif] Error:', error);
        return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500, headers: corsHeaders });
    }
}
