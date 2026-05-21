import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

function env(...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = process.env[key];
    if (v) return v;
  }
  return undefined;
}

export function getDiscreteR2Client(): { client: S3Client; bucket: string } | null {
  const endpoint = env("R2_S3_ENDPOINT", "R2_ENDPOINT");
  const accessKeyId = env("R2_ACCESS_KEY_ID");
  const secretAccessKey = env("R2_SECRET_ACCESS_KEY");
  const bucket = env("R2_BUCKET_NAME");
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    client: new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
}
