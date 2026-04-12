import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    version?: string;
    t?: number;      // legacy timestamp field (ignored now)
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
 * Parse time strings like "09:45 AM" or "09:00 AM-09:45 AM" to minutes since midnight.
 * Returns start minutes. For ranges, returns { start, end }.
 */
function parseTimeRange(timeStr: string): { start: number; end: number } {
    const parseToMins = (tStr: string): number => {
        const parts = tStr.trim().split(/\s+/);
        const timePart = parts[0];
        const modifier = parts[1]?.toUpperCase();
        const [hoursStr, minsStr] = timePart.split(':');
        let hours = parseInt(hoursStr, 10);
        const mins = parseInt(minsStr || '0', 10);
        
        if (modifier) {
            if (hours === 12 && modifier === 'AM') hours = 0;
            if (hours < 12 && modifier === 'PM') hours += 12;
        }
        return hours * 60 + mins;
    };

    const rangeParts = timeStr.split('-').map(s => s.trim());
    if (rangeParts.length >= 2) {
        return { start: parseToMins(rangeParts[0]), end: parseToMins(rangeParts[1]) };
    }
    const mins = parseToMins(timeStr);
    return { start: mins, end: mins + 45 }; // Default 45-min period
}

/**
 * Detects the currently active period from the routine.
 * Returns the period time string and subject if a class is running now, or null if not.
 */
export async function detectActivePeriod(classId: string): Promise<{ periodKey: string; subject: string } | null> {
    try {
        const routineDoc = await getDoc(doc(db, 'routines', classId));
        if (!routineDoc.exists()) return null;
        
        const routine = routineDoc.data().schedule || {};
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const now = new Date();
        const currentDay = days[now.getDay()];
        
        const periods = routine[currentDay] || [];
        if (periods.length === 0) return null;

        const currentMins = now.getHours() * 60 + now.getMinutes();
        const BUFFER_MINS = 10; // Allow scanning 10 min before/after

        for (const period of periods) {
            const { start, end } = parseTimeRange(period.time);
            if (currentMins >= (start - BUFFER_MINS) && currentMins <= (end + BUFFER_MINS)) {
                return { periodKey: period.time, subject: period.subject || 'Unknown' };
            }
        }

        return null; // No active period right now
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
 * Validates QR, checks if class is running, checks location, and submits attendance.
 */
export async function processQRScan(
    qrText: string, 
    userProfile: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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

        // Validate class match
        if (payload.dept !== userProfile.dept || 
            payload.sem !== userProfile.sem || 
            payload.section !== userProfile.section) {
            return { success: false, message: "This QR code belongs to a different class. Check your department, semester, and section." };
        }

        // Check if a class is actively running right now
        onProgress("Checking class schedule...");
        const classId = `${userProfile.section}_${userProfile.dept}_${userProfile.sem}`.replace(/\s+/g, '_').toLowerCase();
        const activePeriod = await detectActivePeriod(classId);
        
        if (!activePeriod) {
            return { 
                success: false, 
                message: "No class is running right now. Attendance can only be recorded during active class periods."
            };
        }

        const { periodKey } = activePeriod;
        const todayStr = new Date().toISOString().split('T')[0];

        // Check for duplicate scan (already scanned for this period today)
        onProgress("Checking for existing record...");
        const cleanPeriod = periodKey.replace(/[^a-zA-Z0-9]/g, '');
        const recordId = `${userProfile.roll || userProfile.boardRoll}_${todayStr}_${cleanPeriod}`;
        const existingDoc = await getDoc(doc(db, 'attendance_sessions', recordId));
        
        if (existingDoc.exists()) {
            return { success: false, message: "You have already scanned for this period. Attendance is already recorded." };
        }

        // GPS validation
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
                message: `You are too far from the college campus (${Math.round(distance)}m away). You must be within ${gpsConfig.radius}m to scan.`
            };
        }

        onProgress("Recording attendance...");
        
        // Write to attendance_sessions (live buffer for CR to review)
        const sessionRef = doc(db, 'attendance_sessions', recordId);
        
        await setDoc(sessionRef, {
            uid: userProfile.uid,
            studentName: userProfile.name,
            boardRoll: (userProfile.roll || userProfile.boardRoll || "Unknown").toString(),
            dept: userProfile.dept,
            sem: userProfile.sem,
            section: userProfile.section,
            date: todayStr,
            period: periodKey,
            status: 'present',
            scannedAt: serverTimestamp(),
            manualEntry: false,
            scanMethod: 'qr',
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
