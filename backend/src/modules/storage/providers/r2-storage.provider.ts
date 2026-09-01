import { Injectable, NotFoundException } from "@nestjs/common";
import { SavedFileInput, StorageProvider, StoredFile, StoredFileObject } from "../storage.types";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ConfigService } from "@nestjs/config";
import { createStorageConfig } from "../storage.config";
import { extname } from "path";
import { randomBytes } from "crypto";
import { Readable } from "stream";

@Injectable()
export class R2StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly configService: ConfigService) {
    const storageConfig = createStorageConfig(this.configService);

    const missingValues = [
      ["R2_ACCOUNT_ID", storageConfig.r2.accountId],
      ["R2_ACCESS_KEY_ID", storageConfig.r2.accessKeyId],
      ["R2_SECRET_ACCESS_KEY", storageConfig.r2.secretAccessKey],
      ["R2_BUCKET", storageConfig.r2.bucket],
    ].filter(([, value]) => !value);

    if (missingValues.length > 0) {
      throw new Error(
        `Faltan variables de entorno para Cloudflare R2: ${missingValues
          .map(([key]) => key)
          .join(", ")}`,
      );
    }

    this.bucket = storageConfig.r2.bucket;
    this.publicUrl = storageConfig.r2.publicUrl.replace(/\/+$/u, "");

    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${storageConfig.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: storageConfig.r2.accessKeyId,
        secretAccessKey: storageConfig.r2.secretAccessKey,
      },
    });
  }

  async saveFile(input: SavedFileInput): Promise<StoredFile> {
    const { file, folder } = input;

    const safeExtension = extname(file.originalname).toLowerCase();
    const fileName = `${randomBytes(16).toString("hex")}${safeExtension}`;
    const objectKey = `${folder}/${fileName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    return {
      originalName: file.originalname,
      fileName,
      objectKey,
      publicUrl: this.publicUrl ? `${this.publicUrl}/${objectKey}` : `/api/files/${objectKey}`,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: "r2",
    };
  }

  async getObject(objectKey: string): Promise<StoredFileObject> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
        }),
      );

      if (!result.Body) {
        throw new NotFoundException("No se encontro el archivo.");
      }

      const buffer = await this.streamToBuffer(result.Body as Readable);

      return {
        buffer,
        mimeType: result.ContentType ?? "application/octet-stream",
        size: result.ContentLength ?? buffer.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new NotFoundException("No se encontro el archivo.");
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      }),
    );
  }

  private streamToBuffer(stream: Readable) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.once("error", reject);
      stream.once("end", () => resolve(Buffer.concat(chunks)));
    });
  }
}
