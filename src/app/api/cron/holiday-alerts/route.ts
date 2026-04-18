/**
 * 🕐 VERCEL CRON JOB — Holiday Alert Notifications
 * 
 * This endpoint is called automatically by Vercel Cron at:
 *   - 2:00 AM UTC  (= 8:00 AM Bangladesh Time) → serves '8am' users
 *   - 2:00 PM UTC  (= 8:00 PM Bangladesh Time) → serves '8pm' users
 * 
 * Flow:
 *   1. Determine which time slot this run serves (8am or 8pm) based on current BD time.
 *   2. Fetch all holidays from Firestore.
 *   3. Check if there's a holiday today or tomorrow.
 *   4. Query all students who have:
 *        - holidayAlertPrefs.enabled === true
 *        - holidayAlertPrefs.engine === 'cloud'
 *        - holidayAlertPrefs.cloudTimeSlot matching the current slot
 *   5. Send FCM push notifications to those students' fcmTokens.
 * 
 * Security: Protected by CRON_SECRET to prevent unauthorized access.
 */

import { NextResponse } from 'next/server';
import { adminDb, adminMessaging } from '../../../../lib/firebaseAdmin';

// CORS headers for consistency
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

export async function GET(request: Request) {
    try {
        // Verify cron secret to prevent unauthorized triggers
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
        }

        // Determine current time slot based on Bangladesh Time (UTC+6)
        const now = new Date();
        const bdHour = (now.getUTCHours() + 6) % 24;
        
        // If called around 8 AM BD time (2 AM UTC), serve '8am' slot
        // If called around 8 PM BD time (2 PM UTC), serve '8pm' slot
        const currentSlot: '8am' | '8pm' = bdHour < 12 ? '8am' : '8pm';
        
        console.log(`[Holiday Cron] Running for slot: ${currentSlot} (BD hour: ${bdHour})`);

        // Get today and tomorrow's dates in YYYY-MM-DD format (BD timezone)
        const bdNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
        const today = bdNow.toISOString().split('T')[0]; // e.g. "2026-04-18"
        
        const tomorrowDate = new Date(bdNow);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];

        // Fetch all holidays from Firestore
        const holidaySnap = await adminDb.collection('holidays').get();
        const holidays = holidaySnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        if (holidays.length === 0) {
            return NextResponse.json({ message: 'No holidays in database', sent: 0 }, { headers: corsHeaders() });
        }

        // Check if there's a holiday today or tomorrow
        const matchingHolidays: any[] = [];

        for (const holiday of holidays) {
            const h = holiday as any;
            if (!h.startDate) continue;

            const startDate = h.startDate; // "YYYY-MM-DD"
            const endDate = h.endDate || h.startDate;

            // Check if today falls within this holiday range
            if (today >= startDate && today <= endDate) {
                matchingHolidays.push({ ...h, alertType: 'today' });
            }
            // Check if tomorrow falls within this holiday range  
            else if (tomorrow >= startDate && tomorrow <= endDate) {
                matchingHolidays.push({ ...h, alertType: 'tomorrow' });
            }
        }

        if (matchingHolidays.length === 0) {
            return NextResponse.json({ 
                message: `No holidays today or tomorrow. Slot: ${currentSlot}`, 
                sent: 0 
            }, { headers: corsHeaders() });
        }

        // Query students who opted into cloud notifications for this time slot
        const studentsSnap = await adminDb.collection('students')
            .where('holidayAlertPrefs.enabled', '==', true)
            .where('holidayAlertPrefs.engine', '==', 'cloud')
            .where('holidayAlertPrefs.cloudTimeSlot', '==', currentSlot)
            .get();

        if (studentsSnap.empty) {
            return NextResponse.json({ 
                message: `No students subscribed to ${currentSlot} slot`, 
                holidays: matchingHolidays.length,
                sent: 0 
            }, { headers: corsHeaders() });
        }

        // Collect all FCM tokens
        const allTokens: string[] = [];
        studentsSnap.docs.forEach((doc: any) => {
            const data = doc.data();
            if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                allTokens.push(...data.fcmTokens);
            }
        });

        if (allTokens.length === 0) {
            return NextResponse.json({ 
                message: 'Students found but no FCM tokens registered',
                students: studentsSnap.size,
                sent: 0 
            }, { headers: corsHeaders() });
        }

        // Build notification content from the first matching holiday
        const primaryHoliday = matchingHolidays[0];
        const isToday = primaryHoliday.alertType === 'today';
        
        let typeEmoji = '🎉';
        if (primaryHoliday.type === 'exam') typeEmoji = '📝';
        if (primaryHoliday.type === 'emergency') typeEmoji = '🚨';
        if (primaryHoliday.type === 'college') typeEmoji = '🏫';

        const title = isToday 
            ? `${typeEmoji} Today: ${primaryHoliday.name}`
            : `${typeEmoji} Tomorrow: ${primaryHoliday.name}`;
        
        const body = isToday
            ? `Today is ${primaryHoliday.name}. Enjoy your day off!`
            : `${primaryHoliday.name} is tomorrow. Get ready!`;

        // Send to all tokens in batches (FCM limit is 500 per multicast)
        const batchSize = 500;
        let totalSuccess = 0;
        let totalFailure = 0;
        const invalidTokens: string[] = [];

        for (let i = 0; i < allTokens.length; i += batchSize) {
            const batch = allTokens.slice(i, i + batchSize);
            const message = {
                notification: { title, body },
                data: { 
                    type: 'holiday_alert',
                    holidayId: primaryHoliday.id,
                    alertType: primaryHoliday.alertType 
                },
                tokens: batch,
            };

            const response = await adminMessaging.sendEachForMulticast(message);
            totalSuccess += response.successCount;
            totalFailure += response.failureCount;

            // Collect invalid tokens for cleanup
            response.responses.forEach((resp: any, idx: number) => {
                if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                    invalidTokens.push(batch[idx]);
                }
            });
        }

        // Clean up invalid tokens from Firestore
        if (invalidTokens.length > 0) {
            const { FieldValue } = await import('firebase-admin/firestore');
            const cleanupBatch = adminDb.batch();
            
            studentsSnap.docs.forEach((doc: any) => {
                const data = doc.data();
                if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
                    const cleaned = data.fcmTokens.filter((t: string) => !invalidTokens.includes(t));
                    if (cleaned.length !== data.fcmTokens.length) {
                        cleanupBatch.update(doc.ref, { fcmTokens: cleaned });
                    }
                }
            });
            
            await cleanupBatch.commit();
            console.log(`[Holiday Cron] Cleaned up ${invalidTokens.length} invalid tokens`);
        }

        return NextResponse.json({
            success: true,
            slot: currentSlot,
            holiday: primaryHoliday.name,
            alertType: primaryHoliday.alertType,
            students: studentsSnap.size,
            tokensSent: allTokens.length,
            successCount: totalSuccess,
            failureCount: totalFailure,
            invalidTokensCleaned: invalidTokens.length,
        }, { headers: corsHeaders() });

    } catch (e: any) {
        console.error('[Holiday Cron] Error:', e);
        return NextResponse.json({ error: e.message || 'Unknown server error' }, { status: 500, headers: corsHeaders() });
    }
}
