// Image storage over the S3 API (MinIO locally and on the VPS). Only keys
// under public/ are readable without credentials.
import { DeleteObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '@/lib/env'

let client: S3Client | undefined
function s3(): S3Client {
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  })
  return client
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: key.startsWith('public/') ? 'public, max-age=31536000, immutable' : 'private, no-store',
    }),
  )
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}

export function publicUrl(key: string): string {
  return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${env.S3_BUCKET}/${key}`
}

export async function pingStorage(): Promise<boolean> {
  await s3().send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }))
  return true
}
