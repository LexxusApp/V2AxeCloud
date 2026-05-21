import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";

export async function summarizeR2ByPrefix(
  client: S3Client,
  bucket: string,
  maxKeys: number
): Promise<{ prefixes: Record<string, { bytes: number; objects: number }>; keysScanned: number; truncated: boolean }> {
  const prefixes: Record<string, { bytes: number; objects: number }> = {};
  let keysScanned = 0;
  let truncated = false;
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );
    for (const o of out.Contents || []) {
      if (!o.Key) continue;
      keysScanned += 1;
      const seg = o.Key.split("/")[0] || "_root";
      if (!prefixes[seg]) prefixes[seg] = { bytes: 0, objects: 0 };
      prefixes[seg].bytes += o.Size || 0;
      prefixes[seg].objects += 1;
      if (keysScanned >= maxKeys) {
        truncated = !!out.IsTruncated;
        return { prefixes, keysScanned, truncated };
      }
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
    if (!token) break;
  } while (true);
  return { prefixes, keysScanned, truncated };
}

export async function handleAdminR2Usage(
  client: S3Client,
  bucket: string,
  maxKeys: number
): Promise<Record<string, unknown>> {
  const cap = Math.min(50000, Math.max(500, maxKeys));
  const { prefixes, keysScanned, truncated } = await summarizeR2ByPrefix(client, bucket, cap);
  const list = Object.entries(prefixes)
    .map(([tenantPrefix, v]) => ({
      tenantPrefix,
      bytes: v.bytes,
      objects: v.objects,
      mb: Math.round((v.bytes / (1024 * 1024)) * 100) / 100,
    }))
    .sort((a, b) => b.bytes - a.bytes);
  return { configured: true, keysScanned, truncated, tenants: list };
}
