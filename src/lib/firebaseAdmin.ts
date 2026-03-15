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

function getAdminApp() {
    if (getApps().length > 0) {
        return getApps()[0];
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
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

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
