import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import path from "path";

const useS3 = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const bucketName = process.env.AWS_BUCKET_NAME || "cloud-doc-manager-bucket";
const storageDir = path.resolve(process.env.STORAGE_DIR || "./storage");

let s3Client: S3Client | null = null;
if (useS3) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadFile(key: string, body: Buffer, mimeType: string): Promise<string> {
  if (useS3 && s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: mimeType,
      })
    );
    return `s3://${bucketName}/${key}`;
  } else {
    const cleanKey = key.startsWith("local://") ? key.replace("local://", "") : key;
    const filePath = path.join(storageDir, cleanKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
    return `local://${cleanKey}`;
  }
}

export async function downloadFile(key: string): Promise<Buffer> {
  if (useS3 && s3Client) {
    const cleanKey = key.startsWith("s3://") ? key.substring(key.indexOf("/", 5) + 1) : key;
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: cleanKey,
      })
    );
    if (!response.Body) {
      throw new Error("Received empty response body from S3");
    }
    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } else {
    const cleanKey = key.startsWith("local://") ? key.replace("local://", "") : key;
    const filePath = path.join(storageDir, cleanKey);
    return await fs.readFile(filePath);
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    if (useS3 && s3Client) {
      const cleanKey = key.startsWith("s3://") ? key.substring(key.indexOf("/", 5) + 1) : key;
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: cleanKey,
        })
      );
    } else {
      const cleanKey = key.startsWith("local://") ? key.replace("local://", "") : key;
      const filePath = path.join(storageDir, cleanKey);
      await fs.unlink(filePath);
    }
  } catch (error) {
    console.error("Storage delete warning:", error);
  }
}
