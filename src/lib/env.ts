import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_NAME: z.string().default("Gestion des Finances"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("true"),

  MAIL_DRIVER: z.enum(["console", "smtp"]).default("console"),
  MAIL_FROM: z.string().default("Gestion des Finances <no-reply@exemple.com>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  BASE_CURRENCY: z.string().length(3).default("XAF"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(20),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Configuration d'environnement invalide :\n${details}`);
}

export const env = parsed.data;
