// lib/r2.ts – Cloudflare R2 upload helper
export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string } }
  ): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

export async function uploadToR2(
  bucket: R2Bucket,
  file: File,
  folder: string = "uploads"
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();
  await bucket.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });
  return key;
}

export function getR2PublicUrl(key: string): string {
  const baseUrl = process.env.R2_PUBLIC_URL ?? "";
  return `${baseUrl}/${key}`;
}
