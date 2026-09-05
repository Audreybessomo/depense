import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "@/lib/env";

export type FichierStocke = {
  storageKey: string;
  sha256: string;
  taille: number;
};

export interface StorageDriver {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

// --- Driver disque local (dev, VPS, volume monte) --------------------------

const localDriver: StorageDriver = {
  async put(key, data) {
    const full = path.join(path.resolve(env.STORAGE_LOCAL_DIR), key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  async get(key) {
    return fs.readFile(path.join(path.resolve(env.STORAGE_LOCAL_DIR), key));
  },
  async delete(key) {
    await fs.rm(path.join(path.resolve(env.STORAGE_LOCAL_DIR), key), { force: true });
  },
};

// --- Driver S3 / MinIO / Scaleway / R2 -------------------------------------

let s3Driver: StorageDriver | null = null;

async function getS3Driver(): Promise<StorageDriver> {
  if (s3Driver) return s3Driver;
  const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
    await import("@aws-sdk/client-s3");

  const client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined,
  });
  const Bucket = env.S3_BUCKET!;

  s3Driver = {
    async put(Key, Body, ContentType) {
      await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType }));
    },
    async get(Key) {
      const res = await client.send(new GetObjectCommand({ Bucket, Key }));
      const chunks: Buffer[] = [];
      for await (const c of res.Body as AsyncIterable<Buffer>) chunks.push(c);
      return Buffer.concat(chunks);
    },
    async delete(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
  };
  return s3Driver;
}

async function driver(): Promise<StorageDriver> {
  return env.STORAGE_DRIVER === "s3" ? getS3Driver() : localDriver;
}

// --- API applicative -------------------------------------------------------

export const MIMES_AUTORISES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/** Signature binaire reelle : on ne fait jamais confiance a l'extension. */
export function detecterMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  const hex = buffer.subarray(0, 12).toString("hex").toUpperCase();
  if (hex.startsWith("25504446")) return "application/pdf";           // %PDF
  if (hex.startsWith("FFD8FF")) return "image/jpeg";
  if (hex.startsWith("89504E470D0A1A0A")) return "image/png";
  if (hex.startsWith("52494646") && buffer.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

export async function stockerFichier(
  buffer: Buffer,
  mimeType: string,
  prefixe: string,
): Promise<FichierStocke> {
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const ext = mimeType === "application/pdf" ? "pdf" : mimeType.split("/")[1];
  const key = `${prefixe}/${sha256.slice(0, 2)}/${sha256}.${ext}`;
  await (await driver()).put(key, buffer, mimeType);
  return { storageKey: key, sha256, taille: buffer.length };
}

export async function lireFichier(key: string): Promise<Buffer> {
  return (await driver()).get(key);
}

export async function supprimerFichier(key: string): Promise<void> {
  await (await driver()).delete(key);
}
