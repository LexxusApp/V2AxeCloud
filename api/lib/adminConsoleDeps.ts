import type { S3Client } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminConsoleRouteDeps = {
  verifyUser: (token: string) => Promise<{ user: { id: string; email?: string | null } | null; error: Error | null }>;
  supabaseAdmin: SupabaseClient;
  r2Client: S3Client | null;
  r2Bucket: string | undefined;
};
