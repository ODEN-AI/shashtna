import { getStore } from "@netlify/blobs";
import { NextResponse } from "next/server";
import { shouldUseBlobStorage as isBlobStorage } from "@/src/lib/runtime";
import { requireAdmin } from "@/src/lib/session";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const BLOB_STORE_NAME = "shashtna-package-images";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request, "catalogue");

    if (!admin.ok) {
      return admin.response;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "لم يتم اختيار صورة.",
        },
        { status: 400 }
      );
    }

    const extension = allowedTypes[file.type];

    if (!extension) {
      return NextResponse.json(
        {
          success: false,
          message:
            "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF.",
        },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "الصورة فارغة أو غير صالحة.",
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          message: "حجم الصورة يجب أن يكون 5MB أو أقل.",
        },
        { status: 400 }
      );
    }

    const filename = `${crypto.randomUUID()}.${extension}`;
    const bytes = await file.arrayBuffer();

    const isProduction =
      isBlobStorage();

    if (isProduction) {
      const store = getStore(BLOB_STORE_NAME);

      await store.set(filename, bytes, {
        metadata: {
          contentType: file.type,
          originalName: file.name,
        },
      });

      return NextResponse.json(
        {
          success: true,
          imageUrl: `/api/uploads/packages/${filename}`,
          filename,
        },
        { status: 201 }
      );
    }

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "packages"
    );

    await mkdir(uploadDirectory, {
      recursive: true,
    });

    const filePath = path.join(
      uploadDirectory,
      filename
    );

    await writeFile(
      filePath,
      Buffer.from(bytes)
    );

    return NextResponse.json(
      {
        success: true,
        imageUrl: `/uploads/packages/${filename}`,
        filename,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Package image upload error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "حدث خطأ أثناء رفع الصورة.";

    return NextResponse.json(
      {
        success: false,
        message:
          isBlobStorage()
            ? `فشل رفع الصورة على الخادم: ${message}`
            : message,
      },
      { status: 500 }
    );
  }
}