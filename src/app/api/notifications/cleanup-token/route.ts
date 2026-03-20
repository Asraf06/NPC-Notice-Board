import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { withCors, corsOptionsResponse } from '@/lib/cors';

export const dynamic = 'force-dynamic';

// Handle CORS preflight requests from Capacitor WebView
export async function OPTIONS() {
    return corsOptionsResponse();
}

/**
 * POST /api/notifications/cleanup-token
 * 
 * Ensures an FCM token belongs ONLY to the specified user.
 * Removes the token from all other users' fcmTokens arrays.
 * 
 * Body: { token: string, ownerUid: string }
 */
export async function POST(request: Request) {
    try {
        const { token, ownerUid } = await request.json();

        if (!token || !ownerUid) {
            return withCors(NextResponse.json({ error: 'Missing token or ownerUid' }, { status: 400 }));
        }

        // Find all students who have this token
        const studentsSnap = await adminDb.collection('students').get();
        const batch = adminDb.batch();
        let removedCount = 0;

        studentsSnap.forEach((studentDoc: any) => {
            const student = studentDoc.data();
            const studentUid = studentDoc.id;

            // Skip the rightful owner
            if (studentUid === ownerUid) return;

            // If this student has the token, remove it
            if (student.fcmTokens && Array.isArray(student.fcmTokens) && student.fcmTokens.includes(token)) {
                batch.update(studentDoc.ref, {
                    fcmTokens: FieldValue.arrayRemove(token),
                });
                removedCount++;
                console.log(`[TokenCleanup] Removing token from user ${studentUid} (${student.name || 'unnamed'})`);
            }
        });

        if (removedCount > 0) {
            await batch.commit();
            console.log(`[TokenCleanup] Cleaned up token from ${removedCount} other user(s), now exclusively owned by ${ownerUid}`);
        }

        return withCors(NextResponse.json({ success: true, removedFrom: removedCount }));
    } catch (error) {
        console.error('[TokenCleanup] Error:', error);
        return withCors(NextResponse.json({ error: 'Failed to cleanup token' }, { status: 500 }));
    }
}
