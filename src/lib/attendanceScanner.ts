import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, query, collection, where, getDocs, serverTimestamp, runTransaction } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationCoords {
    latitude: number;
    longitude: number;
}

export interface CollegeGPSConfig {
    lat: number;
    lng: number;
    radius: number; // in meters
}

export interface QRPayload {
    type: string;    // "attendance"
    dept: string;
    sem: string;
    section: string;
    t: number;    // timestamp to prevent reuse
}

/**
 * Calculates the Haversine distance in meters between two GPS coordinates
 */
export function calculateDistanceMeters(coord1: LocationCoords, coord2: LocationCoords): number {
    const R = 6371e3; // Earth radius in meters
    const toRadians = (deg: number) => (deg * Math.PI) / 180;

    const lat1 = toRadians(coord1.latitude);
    const lat2 = toRadians(coord2.latitude);
    const deltaLat = toRadians(coord2.latitude - coord1.latitude);
    const deltaLng = toRadians(coord2.longitude - coord1.longitude);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

/**
 * Fetches the college GPS center and radius config
 */
export async function getCollegeGPSConfig(): Promise<CollegeGPSConfig | null> {
    try {
        const snap = await getDoc(doc(db, 'settings', 'gps_config'));
        if (snap.exists()) {
            const data = snap.data();
            return {
                lat: typeof data.lat === 'string' ? parseFloat(data.lat) : data.lat,
                lng: typeof data.lng === 'string' ? parseFloat(data.lng) : data.lng,
                radius: typeof data.radius === 'string' ? parseInt(data.radius, 10) : data.radius
            };
        }
    } catch (error) {
        console.error("Error fetching GPS config:", error);
    }
    return null; // Let the caller handle missing config
}

/**
 * Auto-detects the current period based on time and routine.
 * For simplicity, we just look up the routine for the given class and see what fits the current time.
 */
export async function detectCurrentPeriod(classId: string): Promise<string | null> {
    try {
        const routineDoc = await getDoc(doc(db, 'routines', classId));
        if (!routineDoc.exists()) return null;
        
        const routine = routineDoc.data().schedule || {};
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const currentDayIndex = new Date().getDay();
        const currentDay = days[currentDayIndex];
        
        const periods = routine[currentDay] || [];
        if (periods.length === 0) return null;

        return periods[0].time; // Fallback to first period if exact time matching isn't robust
    } catch (e) {
        console.error("Error detecting period:", e);
        return null;
    }
}

/**
 * Gets user's current location using Capacitor's native plugin on Android,
 * or the browser Geolocation API on the web. Handles runtime permission requests.
 */
async function getCurrentLocation(): Promise<LocationCoords> {
    if (Capacitor.isNativePlatform()) {
        // Native: Use Capacitor Geolocation plugin (handles Android runtime permissions)
        try {
            // First, check/request permission
            let permStatus = await Geolocation.checkPermissions();
            
            if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
                permStatus = await Geolocation.requestPermissions();
            }

            if (permStatus.location !== 'granted') {
                throw new Error('Location permission was denied. Please enable location access in your device settings.');
            }

            const position = await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000,
            });

            return {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            };
        } catch (e: any) {
            console.error('Capacitor Geolocation error:', e);
            if (e.message?.includes('denied') || e.message?.includes('permission')) {
                throw new Error('Location permission was denied. Please enable GPS in your device settings and grant location access to this app.');
            }
            throw new Error(`Unable to get location: ${e.message || 'Unknown GPS error'}`);
        }
    } else {
        // Web: Use browser Geolocation API
        return new Promise<LocationCoords>((resolve, reject) => {
            if (!navigator.geolocation) {
                return reject(new Error("Geolocation not supported by this browser."));
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                (err) => {
                    if (err.code === 1) {
                        reject(new Error('Location permission was denied. Please allow location access in your browser.'));
                    } else if (err.code === 2) {
                        reject(new Error('Location unavailable. Please check that GPS/location services are enabled.'));
                    } else {
                        reject(new Error(`Location request timed out. Please try again.`));
                    }
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }
}

/**
 * Validates QR, checks location, and submits attendance.
 */
export async function processQRScan(
    qrText: string, 
    userProfile: any, 
    onProgress: (msg: string) => void
): Promise<{ success: boolean; message: string }> {
    try {
        onProgress("Parsing QR code...");
        let payload: QRPayload;
        try {
            payload = JSON.parse(qrText);
        } catch (e) {
            return { success: false, message: "Invalid QR code format." };
        }

        if (payload.type !== "attendance") {
            return { success: false, message: "Not a valid attendance QR code." };
        }

        // Validate timestamp (e.g. valid for 60 minutes max)
        if (payload.t) {
            const ageMs = Date.now() - payload.t;
            if (ageMs > 60 * 60 * 1000) {
                return { success: false, message: "This QR code has expired." };
            }
        }

        // Validate class match
        if (payload.dept !== userProfile.dept || 
            payload.sem !== userProfile.sem || 
            payload.section !== userProfile.section) {
            return { success: false, message: "This QR code belongs to a different class." };
        }

        onProgress("Fetching location policy...");
        const gpsConfig = await getCollegeGPSConfig();
        
        if (!gpsConfig) {
            return { success: false, message: "College location is not configured by the admin yet." };
        }

        onProgress("Acquiring GPS location...");
        const studentLocation = await getCurrentLocation();

        onProgress("Calculating proximity...");
        const distance = calculateDistanceMeters(studentLocation, { latitude: gpsConfig.lat, longitude: gpsConfig.lng });
        
        if (distance > gpsConfig.radius) {
            return { 
                success: false, 
                message: `You are too far from the college campus (${Math.round(distance)}m). You must be within ${gpsConfig.radius}m.`
            };
        }

        onProgress("Detecting current class period...");
        const classId = `${userProfile.section}_${userProfile.dept}_${userProfile.sem}`.replace(/\s+/g, '_').toLowerCase();
        
        // Find current period, default to an generic period string if not found
        // The admin can merge it to the active class session
        const currentPeriodKey = await detectCurrentPeriod(classId) || "Live_Scan_Queue";
        
        const todayStr = new Date().toISOString().split('T')[0];
        
        onProgress("Recording attendance...");
        
        // We write to attendance_sessions (CR manager reads this as the live buffer)
        const sessionId = `${classId}_${todayStr}_${currentPeriodKey}`;
        
        const recordId = `${sessionId}_${userProfile.uid}`;
        
        // Read if already published
        // Check if attendance_publish has this date/period marked as published
        const publishDocRef = doc(db, 'attendance_publish', sessionId);
        const publishDoc = await getDoc(publishDocRef);
        if (publishDoc.exists() && publishDoc.data().published) {
             return { success: false, message: "Attendance for this period has already been finalized by the CR." };
        }

        // Add to active attendance_sessions buffer
        const sessionRef = doc(db, 'attendance_sessions', recordId);
        
        await setDoc(sessionRef, {
            id: recordId,
            sessionId: sessionId,
            uid: userProfile.uid,
            studentName: userProfile.name,
            boardRoll: userProfile.boardRoll || userProfile.roll || "Unknown",
            dept: userProfile.dept,
            sem: userProfile.sem,
            section: userProfile.section,
            date: todayStr,
            period: currentPeriodKey,
            status: 'present',
            scannedAt: serverTimestamp(),
            manualEntry: false,
            location: {
                latitude: studentLocation.latitude,
                longitude: studentLocation.longitude,
                distance: Math.round(distance)
            }
        });

        return { success: true, message: "Attendance successfully recorded!" };

    } catch (e: any) {
        console.error("QR Processing Error:", e);
        if (e.message && (e.message.includes("denied") || e.message.includes("permission"))) {
             return { success: false, message: e.message };
        }
        return { success: false, message: e.message || "An unexpected error occurred." };
    }
}

