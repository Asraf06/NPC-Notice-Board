export function parseFirebaseError(error: any, defaultMessage: string = 'An unexpected error occurred.'): string {
    const isDev = process.env.NODE_ENV === 'development';
    
    // Extract the Firebase error code if available
    const errorCode = error?.code || '';
    const originalMessage = error?.message || defaultMessage;

    // A mapping of common Firebase Auth error codes to user-friendly messages
    let friendlyMessage = defaultMessage;

    switch (errorCode) {
        case 'auth/popup-closed-by-user':
            friendlyMessage = 'Sign-in popup was closed before completing.\n\n💡 Please click the button and finish the sign-in process.';
            break;
        case 'auth/cancelled-popup-request':
            friendlyMessage = 'Only one sign-in popup can be opened at a time.\n\n💡 Wait a moment or refresh the page.';
            break;
        case 'auth/user-not-found':
            friendlyMessage = 'No account found with this email.\n\n💡 Please register first or check for typos.';
            break;
        case 'auth/wrong-password':
            friendlyMessage = 'Incorrect password.\n\n💡 If you forgot it, use the "Forgot Password" link.';
            break;
        case 'auth/email-already-in-use':
            friendlyMessage = 'An account already exists with this email address.\n\n💡 Please log in instead or use "Forgot Password".';
            break;
        case 'auth/network-request-failed':
            friendlyMessage = 'Network error.\n\n💡 Please check your internet connection and try again.';
            break;
        case 'auth/invalid-email':
            friendlyMessage = 'The email address is badly formatted.\n\n💡 Please use a valid email format (e.g., student@gmail.com).';
            break;
        case 'auth/user-disabled':
            friendlyMessage = 'This account has been disabled.\n\n💡 Please contact an Admin to reactivate your account.';
            break;
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            friendlyMessage = 'Invalid login credentials.\n\n💡 Please check your email and password, or register if you haven\'t.';
            break;
        case 'auth/too-many-requests':
            friendlyMessage = 'Too many failed login attempts.\n\n💡 Please wait a few minutes and try again, or reset your password.';
            break;
        case 'auth/requires-recent-login':
            friendlyMessage = 'We need to verify it\'s you.\n\n💡 For your security, please log out and log back in to perform this action.';
            break;
        case 'auth/credential-already-in-use':
            friendlyMessage = 'This account is already linked to another user.\n\n💡 Please sign in with a different account.';
            break;
        default:
            // If it's a known non-Firebase custom error thrown by us (like our Board Roll checks), keep it exactly as is
            if (!errorCode && error?.message) {
                friendlyMessage = error.message;
            } else {
                friendlyMessage = 'An unexpected error occurred.\n\n💡 Please check your internet connection or try again later.';
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

    // In production (Vercel website + APK), only show the user-friendly message
    return friendlyMessage;
}
