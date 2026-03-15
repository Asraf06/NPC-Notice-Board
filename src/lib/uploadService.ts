import { db, auth } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

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

async function uploadDirectly(file: File, onProgress?: (pct: number) => void): Promise<UploadResult | null> {
    const keys = await fetchUploadKeys();
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

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
                        if (serviceName === 'imagekit' && data.fileId) {
                            resolve({
                                type: isImage ? 'image' : isVideo ? 'video' : 'file',
                                url: data.url,
                                thumb: data.thumbnailUrl || data.url,
                                name: file.name,
                                service: 'imagekit',
                                fileId: data.fileId
                            });
                        } else if (serviceName === 'imgbb' && data.success) {
                            const thumb = data.data.thumb?.url || data.data.medium?.url || data.data.url;
                            resolve({
                                type: 'image',
                                url: data.data.url,
                                thumb: thumb,
                                name: file.name,
                                service: 'imgbb',
                                fileId: null
                            });
                        } else if (serviceName === 'cloudinary' && data.secure_url) {
                            resolve({
                                type: isImage ? 'image' : isVideo ? 'video' : 'file',
                                url: data.secure_url,
                                thumb: isImage ? (data.eager?.[0]?.secure_url || data.secure_url) : null,
                                name: file.name,
                                service: 'cloudinary',
                                fileId: data.public_id || null
                            });
                        } else {
                            console.error(`${serviceName} upload response invalid:`, data);
                            resolve(null);
                        }
                    } catch (err) {
                        console.error(`${serviceName} parse error:`, err);
                        resolve(null);
                    }
                } else {
                    console.error(`${serviceName} HTTP status ${xhr.status}`, xhr.responseText);
                    resolve(null);
                }
            };
            xhr.onerror = (err) => {
                console.error(`${serviceName} XHR network error`);
                resolve(null);
            };
            xhr.open('POST', url);
            xhr.send(formData);
        });
    };

    let result: UploadResult | null = null;

    // 1️⃣ ALWAYS Try ImageKit FIRST using secure Next.js Backend Authentication
    console.log('Trying ImageKit upload...');
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const idToken = await currentUser.getIdToken();
            const authResponse = await fetch('/api/imagekit/auth', {
                headers: {
                    Authorization: `Bearer ${idToken}`
                }
            });

            if (authResponse.ok) {
                const authData = await authResponse.json();

                if (authData && authData.token && authData.signature && authData.expire) {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('publicKey', authData.publicKey);
                    formData.append('signature', authData.signature);
                    formData.append('expire', authData.expire.toString());
                    formData.append('token', authData.token);
                    formData.append('fileName', file.name);
                    formData.append('useUniqueFileName', 'true');
                    formData.append('folder', '/uploads/client');

                    result = await doXhrUpload('https://upload.imagekit.io/api/v1/files/upload', formData, 'imagekit');
                }
            } else {
                console.error('ImageKit auth endpoint returned error:', await authResponse.text());
            }
        } else {
            console.error('Cannot securely use ImageKit: User is not logged in.');
        }
    } catch (error) {
        console.error('ImageKit API Error:', error);
    }

    // 2️⃣ Fallback to Cloudinary if ImageKit fails
    if (!result && keys?.cloudName && keys?.cloudPreset) {
        console.log('Trying Cloudinary upload...');
        let resourceType = 'auto';
        if (isImage) resourceType = 'image';
        else if (isVideo) resourceType = 'video';
        else resourceType = 'raw';

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', keys.cloudPreset);

        result = await doXhrUpload(`https://api.cloudinary.com/v1_1/${keys.cloudName}/${resourceType}/upload`, formData, 'cloudinary');
    }

    // 3️⃣ Use ImgBB ONLY as a last resort fallback for images.
    if (!result && isImage && keys?.imgbb) {
        console.log('Cloudinary failed. Falling back to ImgBB...');
        const formData = new FormData();
        formData.append('image', file);
        result = await doXhrUpload(`https://api.imgbb.com/1/upload?key=${keys.imgbb}`, formData, 'imgbb');
    }

    if (!result) {
        console.error('All upload methods failed or were unavailable.');
    }

    return result;
}

export async function secureUploadFile(file: File): Promise<UploadResult | null> {
    return uploadDirectly(file);
}

export async function secureUploadMaterial(file: File): Promise<UploadResult | null> {
    return uploadDirectly(file);
}

export function secureUploadWithProgress(
    file: File,
    onProgress: (percent: number) => void
): Promise<UploadResult | null> {
    return uploadDirectly(file, onProgress);
}

export async function deleteUploadedFiles(
    files: { service: string; fileId: string | null }[]
): Promise<void> {
    // Note: Cloudinary/ImageKit server-side deletion is ignored on static deployments 
    // since we do not have an API endpoint with server secrets to issue delete commands.
    console.debug('Client-side deletion bypassed for orphaned files:', files);
    return Promise.resolve();
}
