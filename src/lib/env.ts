import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_APP_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),
  NEXT_PUBLIC_FIREBASE_USE_EMULATORS: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST: z.string().min(1).optional(),
});

const serverEnvSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_CLIENT_EMAIL: z.string().min(1).optional(),
  FIREBASE_PRIVATE_KEY: z.string().min(1).optional(),
  FIREBASE_USE_EMULATORS: z.enum(["true", "false"]).default("false"),
  FIRESTORE_EMULATOR_HOST: z.string().min(1).optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().min(1).optional(),
  FIREBASE_STORAGE_EMULATOR_HOST: z.string().min(1).optional(),
  FF_TRAININGTRACK_DUAL_WRITE: z.enum(["true", "false"]).default("false"),
  FF_TRAININGTRACK_READ_FROM_MODULES: z.enum(["true", "false"]).default("false"),
  FF_TRAININGTRACK_LEGACY_WRITE_DISABLED: z.enum(["true", "false"]).default("false"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getClientEnv(): ClientEnv {
  return clientEnvSchema.parse({
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_FIREBASE_USE_EMULATORS:
      process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS,
    NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST:
      process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST,
    NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST:
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
    NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST:
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST,
  });
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_USE_EMULATORS: process.env.FIREBASE_USE_EMULATORS,
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    FIREBASE_STORAGE_EMULATOR_HOST: process.env.FIREBASE_STORAGE_EMULATOR_HOST,
    FF_TRAININGTRACK_DUAL_WRITE: process.env.FF_TRAININGTRACK_DUAL_WRITE,
    FF_TRAININGTRACK_READ_FROM_MODULES:
      process.env.FF_TRAININGTRACK_READ_FROM_MODULES,
    FF_TRAININGTRACK_LEGACY_WRITE_DISABLED:
      process.env.FF_TRAININGTRACK_LEGACY_WRITE_DISABLED,
  });
}

export type TrainingTrackMigrationFlags = {
  dualWrite: boolean;
  readFromModules: boolean;
  legacyWriteDisabled: boolean;
};

export function getTrainingTrackMigrationFlags(): TrainingTrackMigrationFlags {
  const env = getServerEnv();

  return {
    dualWrite: env.FF_TRAININGTRACK_DUAL_WRITE === "true",
    readFromModules: env.FF_TRAININGTRACK_READ_FROM_MODULES === "true",
    legacyWriteDisabled: env.FF_TRAININGTRACK_LEGACY_WRITE_DISABLED === "true",
  };
}
