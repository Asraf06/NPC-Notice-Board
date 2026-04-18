/**
 * 🔒 FIREBASE ADMIN SDK (SERVER-SIDE ONLY)
 * 
 * This file initializes Firebase Admin for server-side operations.
 * It uses a service account to authenticate, which is stored in env vars.
 * This code NEVER runs in the browser — only in API routes and server components.
 * 
 * Setup: Go to Firebase Console → Project Settings → Service Accounts → 
 *        Generate New Private Key → copy the values into .env.local
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

function getAdminApp() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    if (!process.env.FIREBASE_ADMIN_PROJECT_ID || !process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
        console.warn('⚠️ FIREBASE_ADMIN keys missing (expected during CAPACITOR_BUILD static export). Firebase Admin skipped.');
        return null;
    }

    const serviceAccount: ServiceAccount = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // The private key comes with literal \n characters from env vars — convert them
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    return initializeApp({
        credential: cert(serviceAccount),
    });
}

const adminApp = getAdminApp();

// Use a Proxy to mock the DB and Auth objects if adminApp is null (during static builds without secrets).
// This prevents the build from crashing during Next.js static analysis.
export const adminDb = adminApp ? getFirestore(adminApp) : new Proxy({}, { get: () => { throw new Error('Firebase Admin DB not initialized'); } }) as any;
export const adminAuth = adminApp ? getAuth(adminApp) : new Proxy({}, { get: () => { throw new Error('Firebase Admin Auth not initialized'); } }) as any;
export const adminMessaging = adminApp ? getMessaging(adminApp) : new Proxy({}, { get: () => { throw new Error('Firebase Admin Messaging not initialized'); } }) as any;

/**
 * Fetch upload API keys (ImgBB, Cloudinary) from Firestore using Admin SDK.
 * These keys NEVER leave the server.
 */
export async function getUploadKeys() {
    const doc = await adminDb.collection('settings').doc('api_keys').get();
    if (!doc.exists) {
        throw new Error('API keys not configured in Firestore (settings/api_keys)');
    }
    const config = doc.data()!;
    return {
        imgbbApiKey: config.imgbb || '',
        cloudName: config.cloudName || '',
        cloudPreset: config.cloudPreset || config.uploadPreset || 'npc_preset',
    };
}
