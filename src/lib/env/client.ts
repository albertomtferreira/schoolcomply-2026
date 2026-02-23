import { z } from "zod";

import { appEnv, booleanString, formatEnvErrors, requiredString } from "@lib/env/shared";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: requiredString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: requiredString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: requiredString,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: requiredString,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: requiredString,
  NEXT_PUBLIC_FIREBASE_APP_ID: requiredString,
  NEXT_PUBLIC_APP_ENV: appEnv,
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: booleanString,
  NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: requiredString,
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: requiredString,
  NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST: requiredString,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

let cachedClientEnv: ClientEnv | null = null;

export function validateClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  const result = clientEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatEnvErrors(result.error));
  }

  cachedClientEnv = result.data;
  return cachedClientEnv;
}

export const clientEnv = validateClientEnv();
