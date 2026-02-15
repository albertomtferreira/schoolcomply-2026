import { FirebaseError } from "firebase/app";

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return "Authentication failed. Try again.";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "This email is already in use. Sign in instead.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters.";
    case "auth/operation-not-allowed":
      return "Email/password auth is disabled in Firebase Authentication settings.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/network-request-failed":
      return "Network error connecting to Firebase Auth. If using emulators, verify they are running.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/api-key-not-valid":
      return "Firebase config is invalid. Check NEXT_PUBLIC_FIREBASE_* values.";
    default:
      return `Authentication failed (${error.code}).`;
  }
}
