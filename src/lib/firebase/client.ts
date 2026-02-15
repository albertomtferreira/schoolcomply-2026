import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

import { getClientEnv } from "@/lib/env";

const clientEnv = getClientEnv();

const firebaseConfig = {
  apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: clientEnv.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

let emulatorsConnected = false;

function parseHostPort(value: string, fallbackHost: string, fallbackPort: number): {
  host: string;
  port: number;
} {
  const [host, port] = value.split(":");
  const parsedPort = Number.parseInt(port ?? "", 10);

  return {
    host: host || fallbackHost,
    port: Number.isFinite(parsedPort) ? parsedPort : fallbackPort,
  };
}

export function connectClientEmulators(): void {
  if (
    emulatorsConnected ||
    clientEnv.NEXT_PUBLIC_FIREBASE_USE_EMULATORS !== "true"
  ) {
    return;
  }

  const authTarget =
    clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";
  const firestoreTarget = parseHostPort(
    clientEnv.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080",
    "127.0.0.1",
    8080,
  );
  const storageTarget = parseHostPort(
    clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST ?? "127.0.0.1:9199",
    "127.0.0.1",
    9199,
  );

  connectAuthEmulator(
    auth,
    `http://${authTarget}`,
    { disableWarnings: true },
  );
  connectFirestoreEmulator(db, firestoreTarget.host, firestoreTarget.port);
  connectStorageEmulator(storage, storageTarget.host, storageTarget.port);

  emulatorsConnected = true;
}
