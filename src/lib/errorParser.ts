export function parseFirebaseError(error: any, defaultMessage: string = 'An unexpected error occurred.'): string {
    const isDev = process.env.NODE_ENV === 'development';
    
    // Extract the Firebase error code if available
    const errorCode = error?.code || '';
    const originalMessage = error?.message || defaultMessage;

    // A mapping of common Firebase Auth error codes to user-friendly messages
    let friendlyMessage = defaultMessage;

    switch (errorCode) {
        case 'auth/popup-closed-by-user':
            friendlyMessage = 'Sign-in popup was closed before completing. Please try again.';
            break;
        case 'auth/cancelled-popup-request':
            friendlyMessage = 'Only one sign-in popup can be opened at a time.';
            break;
        case 'auth/user-not-found':
            friendlyMessage = 'No account found with this email. Please register first.';
            break;
        case 'auth/wrong-password':
            friendlyMessage = 'Incorrect password. Please try again.';
            break;
        case 'auth/email-already-in-use':
            friendlyMessage = 'An account already exists with this email address.';
            break;
        case 'auth/network-request-failed':
            friendlyMessage = 'Network error. Please check your internet connection.';
            break;
        case 'auth/invalid-email':
            friendlyMessage = 'The email address is badly formatted.';
            break;
        case 'auth/user-disabled':
            friendlyMessage = 'This account has been disabled. Please contact an admin.';
            break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            friendlyMessage = 'Invalid login credentials. Please check your email and password.';
            break;
        case 'auth/too-many-requests':
            friendlyMessage = 'Too many failed login attempts. Please try again later or reset your password.';
            break;
        case 'auth/requires-recent-login':
            friendlyMessage = 'For your security, please log out and log back in to perform this action.';
            break;
        case 'auth/credential-already-in-use':
            friendlyMessage = 'This account is already linked to another user.';
            break;
        default:
            // If it's a known non-Firebase custom error thrown by us (like our Board Roll checks), keep it exactly as is
            if (!errorCode && error?.message) {
                friendlyMessage = error.message;
            } else {
                friendlyMessage = 'An error occurred during authentication. Please try again.';
            }
            break;
    }

    // In development mode (localhost), we show the friendly message PLUS the raw developer error
    if (isDev) {
        // If there's an error code, it's a firebase error
        if (errorCode) {
            return `[DEV: ${errorCode}] ${friendlyMessage}\n\nOriginal: ${originalMessage}`;
        }
        return `[DEV] ${friendlyMessage}`;
    }

    // Show BOTH the friendly message and the raw error briefly so the user can show us exactly what it says
    return `${friendlyMessage}\n\n[RAW DEBUG ALERTS BELOW]\n${errorCode ? `Code: ${errorCode}` : 'No Error Code'}\nMsg: ${originalMessage}`;
}
