import { Injectable, NotFoundException } from "@nestjs/common";
import { SavedFileInput, StorageProvider, StoredFile, StoredFileObject } from "../storage.types";
import { extname, join, normalize } from "path";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import { randomBytes } from "crypto";

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly uploadsRoot = join(process.cwd(), "uploads");

  async saveFile(input: SavedFileInput): Promise<StoredFile> {
    const { file, folder } = input;

    const safeExtension = extname(file.originalname).toLowerCase();
    const fileName = `${randomBytes(16).toString('hex')}${safeExtension}`;
    const folderPath = join(this.uploadsRoot, folder);
    const filePath = join(folderPath, fileName);

    await mkdir(folderPath, { recursive: true });
    await writeFile(filePath, file.buffer);

    const objectKey = `${folder}/${fileName}`;
    const publicUrl = `/api/files/${objectKey}`;

    return {
      originalName: file.originalname,
      fileName,
      objectKey,
      publicUrl,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: "local",
    };
  }

  async getObject(objectKey: string): Promise<StoredFileObject> {
    const filePath = this.resolveObjectPath(objectKey);

    try {
      const [fileBuffer, fileStat] = await Promise.all([
        readFile(filePath),
        stat(filePath),
      ]);

      return {
        buffer: fileBuffer,
        mimeType: this.resolveMimeType(filePath),
        size: fileStat.size,
      };
    } catch {
      throw new NotFoundException("No se encontro el archivo.");
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    const filePath = this.resolveObjectPath(objectKey);

    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  private resolveObjectPath(objectKey: string) {
    const normalizedKey = normalize(objectKey).replace(/^\.{2}(\/|\\|$)/u, "");
    const filePath = join(this.uploadsRoot, normalizedKey);

    if (!filePath.startsWith(this.uploadsRoot)) {
      throw new NotFoundException("No se encontro el archivo.");
    }

    return filePath;
  }

  private resolveMimeType(filePath: string) {
    const extension = extname(filePath).toLowerCase();

    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    return mimeTypes[extension] ?? "application/octet-stream";
  }
}
