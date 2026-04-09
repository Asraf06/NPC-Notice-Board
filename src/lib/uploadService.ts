import { db, auth } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { apiUrl } from './apiBase';
import { Capacitor } from '@capacitor/core';

/**
 * 🚀 CLIENT-SIDE UPLOAD SERVICE (Vercel Edition)
 * 
 * 1️⃣ ImageKit (Primary: Fast, secure via Next.js API route)
 * 2️⃣ Cloudinary (Fallback: via public preset)
 * 3️⃣ ImgBB (Fallback 2: Images only, public key)
 */

export interface UploadResult {
    type: string;          // 'image' | 'video' | 'file'
    url: string;           // The uploaded file URL
    thumb: string | null;  // Thumbnail URL (for images)
    name: string;          // Original filename
    service: string;       // 'imagekit' | 'cloudinary' | 'imgbb'
    fileId: string | null; // Cloudinary/ImageKit public_id (for deletion)
}

let cachedKeys: { imgbb: string; cloudName: string; cloudPreset: string } | null = null;

async function fetchUploadKeys() {
    if (cachedKeys) return cachedKeys;

    try {
        let snap = await getDoc(doc(db, 'settings', 'config'));
        if (!snap.exists() || (!snap.data().imgbbKey && !snap.data().cloudName)) {
            snap = await getDoc(doc(db, 'settings', 'api_keys'));
        }

        if (snap.exists()) {
            const data = snap.data();
            cachedKeys = {
                imgbb: data.imgbbKey || data.imgbb || '',
                cloudName: data.cloudName || '',
                cloudPreset: data.cloudPreset || data.uploadPreset || ''
            };
            return cachedKeys;
        }
    } catch (err) {
        console.error('Failed to fetch upload keys from Firestore', err);
    }
    return null;
}

function showGlobalAlert(title: string, message: string) {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('global-alert', {
            detail: { title, message, type: 'error' }
        }));
    } else {
        console.error(`[ALERT: ${title}]`, message);
    }
}

/**
 * On Capacitor Android WebView, File objects from <input type="file">
 * often fail to serialize in FormData for cross-origin XHR/fetch uploads.
 * This reads the file bytes into memory as a plain Blob, which works reliably.
 */
async function fileToBlob(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(new Blob([reader.result as ArrayBuffer], { type: file.type || 'application/octet-stream' }));
        };
        reader.onerror = () => reject(new Error('FileReader failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

async function uploadDirectly(file: File, onProgress?: (pct: number) => void, folderPath: string = '/uploads/client'): Promise<UploadResult | null> {
    const keys = await fetchUploadKeys();
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isNative = Capacitor.isNativePlatform();
    const fileName = file.name;

    // On native, convert File to in-memory Blob for WebView compatibility
    let uploadBlob: Blob | File = file;
    if (isNative) {
        try {
            uploadBlob = await fileToBlob(file);
            console.log(`[Upload] Converted File to Blob: ${uploadBlob.size} bytes, type: ${uploadBlob.type}`);
        } catch (e) {
            console.error('[Upload] fileToBlob conversion failed, using raw File:', e);
        }
    }

    /** Parse upload response JSON into UploadResult */
    const parseResponse = (data: any, serviceName: string): UploadResult | null => {
        if (serviceName === 'imagekit' && data.fileId) {
            return { type: isImage ? 'image' : isVideo ? 'video' : 'file', url: data.url, thumb: data.thumbnailUrl || data.url, name: fileName, service: 'imagekit', fileId: data.fileId };
        } else if (serviceName === 'imgbb' && data.success) {
            const thumb = data.data.thumb?.url || data.data.medium?.url || data.data.url;
            return { type: 'image', url: data.data.url, thumb, name: fileName, service: 'imgbb', fileId: null };
        } else if (serviceName === 'cloudinary' && data.secure_url) {
            return { type: isImage ? 'image' : isVideo ? 'video' : 'file', url: data.secure_url, thumb: isImage ? (data.eager?.[0]?.secure_url || data.secure_url) : null, name: fileName, service: 'cloudinary', fileId: data.public_id || null };
        }
        return null;
    };

    /** fetch-based upload fallback (no progress, but more reliable on native WebViews) */
    const doFetchUpload = async (url: string, formData: FormData, serviceName: string): Promise<UploadResult | null> => {
        try {
            console.log(`[Upload] Trying fetch fallback for ${serviceName}...`);
            const resp = await fetch(url, { method: 'POST', body: formData });
            if (resp.ok) {
                const data = await resp.json();
                const parsed = parseResponse(data, serviceName);
                if (parsed) return parsed;
                console.error(`${serviceName} fetch response invalid:`, data);
            } else {
                console.error(`${serviceName} fetch HTTP ${resp.status}`, await resp.text().catch(() => ''));
            }
        } catch (err: any) {
            console.error(`${serviceName} fetch error:`, err?.message);
        }
        return null;
    };

    const doXhrUpload = (url: string, formData: FormData, serviceName: string): Promise<UploadResult | null> => {
        return new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };
            xhr.onload = () => {
                if (xhr.status === 200 || xhr.status === 201) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        const parsed = parseResponse(data, serviceName);
                        if (parsed) {
                            resolve(parsed);
                        } else {
                            console.error(`${serviceName} upload response invalid:`, data);
                            resolve(null);
                        }
                    } catch (err: any) {
                        console.error(`${serviceName} parse error:`, err);
                        resolve(null);
                    }
                } else {
                    console.error(`${serviceName} HTTP status ${xhr.status}`, xhr.responseText);
                    resolve(null);
                }
            };
            xhr.onerror = () => {
                console.error(`${serviceName} XHR network error — will try fetch fallback`);
                resolve(null); // will fall through to fetch fallback
            };
            xhr.open('POST', url);
            xhr.send(formData);
        });
    };

    /** Try XHR first (supports progress), then fetch fallback */
    const doUpload = async (url: string, formData: FormData, serviceName: string): Promise<UploadResult | null> => {
        let res = await doXhrUpload(url, formData, serviceName);
        if (!res && isNative) {
            // On native, XHR often fails — retry with fetch
            res = await doFetchUpload(url, formData, serviceName);
        }
        return res;
    };

    let result: UploadResult | null = null;

    // 1️⃣ ALWAYS Try ImageKit FIRST using secure Next.js Backend Authentication
    console.log('Trying ImageKit upload...');
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const idToken = await currentUser.getIdToken();
            const authUrl = apiUrl('/api/imagekit/auth');
            const authResponse = await fetch(authUrl, {
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            }).catch(err => {
                showGlobalAlert('Auth Fetch Error', `Fetch to ${authUrl} failed: ${err.message}`);
                return null;
            });

            if (authResponse) {
                if (authResponse.ok) {
                    const authData = await authResponse.json();

                    if (authData && authData.token && authData.signature && authData.expire) {
                        const formData = new FormData();
                        formData.append('file', uploadBlob, fileName);
                        formData.append('publicKey', authData.publicKey);
                        formData.append('signature', authData.signature);
                        formData.append('expire', authData.expire.toString());
                        formData.append('token', authData.token);
                        formData.append('fileName', fileName);
                        formData.append('useUniqueFileName', 'true');
                        formData.append('folder', folderPath);

                        result = await doUpload('https://upload.imagekit.io/api/v1/files/upload', formData, 'imagekit');
                    } else {
                        showGlobalAlert('ImageKit Config Error', `Auth JSON missing fields. Data: ${JSON.stringify(authData).substring(0, 100)}`);
                    }
                } else {
                    const errText = await authResponse.text();
                    console.error('ImageKit auth endpoint returned error:', errText);
                    showGlobalAlert('ImageKit Auth Error', `Status ${authResponse.status}: ${errText.substring(0, 100)}`);
                }
            }
        } else {
            console.error('Cannot securely use ImageKit: User is not logged in.');
            showGlobalAlert('Auth Error', `Cannot securely use ImageKit: User is not logged in.`);
        }
    } catch (error: any) {
        console.error('ImageKit API Error:', error);
        showGlobalAlert('ImageKit Runtime Error', error?.message || 'Unknown catch error.');
    }

    // 2️⃣ Fallback to Cloudinary if ImageKit fails
    if (!result && keys?.cloudName && keys?.cloudPreset) {
        console.log('Trying Cloudinary upload...');
        let resourceType = 'auto';
        if (isImage) resourceType = 'image';
        else if (isVideo) resourceType = 'video';
        else resourceType = 'raw';

        const formData = new FormData();
        formData.append('file', uploadBlob, fileName);
        formData.append('upload_preset', keys.cloudPreset);

        result = await doUpload(`https://api.cloudinary.com/v1_1/${keys.cloudName}/${resourceType}/upload`, formData, 'cloudinary');
    }

    // 3️⃣ Use ImgBB ONLY as a last resort fallback for images.
    if (!result && isImage && keys?.imgbb) {
        console.log('Cloudinary failed. Falling back to ImgBB...');
        const formData = new FormData();
        formData.append('image', uploadBlob, fileName);
        result = await doUpload(`https://api.imgbb.com/1/upload?key=${keys.imgbb}`, formData, 'imgbb');
    }

    if (!result) {
        console.error('All upload methods failed or were unavailable.');
        showGlobalAlert('Upload Failed Completely', `Failed all methods (ImageKit, Cloudinary). File size: ${file.size}b.`);
    }

    return result;
}

export async function secureUploadFile(file: File, folderPath?: string): Promise<UploadResult | null> {
    return uploadDirectly(file, undefined, folderPath);
}

export async function secureUploadMaterial(file: File, folderPath?: string): Promise<UploadResult | null> {
    return uploadDirectly(file, undefined, folderPath);
}

export function secureUploadWithProgress(
    file: File,
    onProgress: (percent: number) => void,
    folderPath?: string
): Promise<UploadResult | null> {
    return uploadDirectly(file, onProgress, folderPath);
}

export async function deleteUploadedFiles(
    files: { service: string; fileId: string | null }[]
): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.log('No user logged in, cannot delete files.');
        return;
    }

    try {
        const idToken = await currentUser.getIdToken();
        for (const file of files) {
            if (file.service === 'imagekit' && file.fileId) {
                const res = await fetch(apiUrl('/api/imagekit/delete'), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fileId: file.fileId })
                });

                if (!res.ok) {
                    console.error('Failed to delete ImageKit file:', await res.text());
                } else {
                    console.log('Successfully deleted ImageKit file:', file.fileId);
                }
            } else {
                console.debug('Deletion specifically for imagekit. Ignored for:', file);
            }
        }
    } catch (err) {
        console.error('Error during file deletion:', err);
    }
}
