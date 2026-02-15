import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { getServerEnv } from "@/lib/env";

function getPrivateKey(value?: string): string | undefined {
  return value?.replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp() {
  if (getApps().length) {
    return getApps()[0];
  }

  const env = getServerEnv();
  const useEmulators = env.FIREBASE_USE_EMULATORS === "true";
  const resolvedProjectId =
    env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (useEmulators) {
    // In emulator mode, avoid service account coupling and use project-scoped local emulators.
    return initializeApp({
      projectId: resolvedProjectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  if (
    env.FIREBASE_PROJECT_ID &&
    env.FIREBASE_CLIENT_EMAIL &&
    env.FIREBASE_PRIVATE_KEY
  ) {
    return initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: getPrivateKey(env.FIREBASE_PRIVATE_KEY),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }

  // Falls back to Application Default Credentials in trusted environments.
  return initializeApp({
    projectId: resolvedProjectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminAuth = getAuth(getFirebaseAdminApp());
export const adminDb = getFirestore(getFirebaseAdminApp());
export const adminStorage = getStorage(getFirebaseAdminApp());
