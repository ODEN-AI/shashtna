import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const allowedTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  try {
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

    if (!allowedTypes[file.type]) {
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
          message: "حجم الصورة يجب أن يكون 8MB أو أقل.",
        },
        { status: 400 }
      );
    }

    const extension = allowedTypes[file.type];
    const filename = `${crypto.randomUUID()}.${extension}`;

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "packages"
    );

    await mkdir(uploadDirectory, {
      recursive: true,
    });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filePath = path.join(
      uploadDirectory,
      filename
    );

    await writeFile(filePath, buffer);

    const imageUrl = `/uploads/packages/${filename}`;

    return NextResponse.json(
      {
        success: true,
        imageUrl,
        filename,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Package image upload error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء رفع الصورة.",
      },
      { status: 500 }
    );
  }
}