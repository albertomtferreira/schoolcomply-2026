import "server-only";

import { z } from "zod";

import { booleanString, formatEnvErrors, requiredString } from "@lib/env/shared";

const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: requiredString,
  FIREBASE_CLIENT_EMAIL: requiredString,
  FIREBASE_PRIVATE_KEY: requiredString,
  FIREBASE_USE_EMULATORS: booleanString,
  FIRESTORE_EMULATOR_HOST: requiredString,
  FIREBASE_AUTH_EMULATOR_HOST: requiredString,
  FIREBASE_STORAGE_EMULATOR_HOST: requiredString,
  FF_TRAININGTRACK_DUAL_WRITE: booleanString.default(false),
  FF_TRAININGTRACK_READ_FROM_MODULES: booleanString.default(true),
  FF_TRAININGTRACK_LEGACY_WRITE_DISABLED: booleanString.default(true),
});

type RawServerEnv = z.infer<typeof serverEnvSchema>;

export type ServerEnv = RawServerEnv & {
  FIREBASE_PRIVATE_KEY: string;
};

let cachedServerEnv: ServerEnv | null = null;

export function validateServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(formatEnvErrors(result.error));
  }

  cachedServerEnv = {
    ...result.data,
    FIREBASE_PRIVATE_KEY: result.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };

  return cachedServerEnv;
}

export const serverEnv = validateServerEnv();
