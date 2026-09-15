import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getExtension(file: File) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  return map[file.type] ?? "bin";
}

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

    if (!ALLOWED_TYPES.has(file.type)) {
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
          message: "حجم الصورة يجب أن لا يتجاوز 8MB.",
        },
        { status: 400 }
      );
    }

    const extension = getExtension(file);

    const key = `catalog/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    /**
     * Netlify Blobs يقبل BlobInput.
     * نستخدم Blob مباشرة بدلاً من Buffer حتى ما يصير تعارض بالـ TypeScript.
     */
    const fileBlob = new Blob([await file.arrayBuffer()], {
      type: file.type,
    });

    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction) {
      const store = getStore("shashtna-media");

      await store.set(key, fileBlob, {
        metadata: {
          contentType: file.type,
          originalName: file.name,
        },
      });

      const imageUrl = `/api/uploads/media/${encodeURIComponent(key)}`;

      return NextResponse.json(
        {
          success: true,
          message: "تم رفع الصورة بنجاح.",
          imageUrl,
          key,
        },
        { status: 201 }
      );
    }

    /**
     * أثناء التشغيل المحلي نخزن الصورة داخل public/uploads/media
     * حتى تشتغل مباشرة على localhost.
     */
    const fs = await import("node:fs/promises");
    const path = await import("node:path");

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "media"
    );

    await fs.mkdir(uploadDirectory, {
      recursive: true,
    });

    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const filePath = path.join(
      uploadDirectory,
      fileName
    );

    const arrayBuffer = await file.arrayBuffer();

    await fs.writeFile(
      filePath,
      Buffer.from(arrayBuffer)
    );

    const imageUrl = `/uploads/media/${fileName}`;

    return NextResponse.json(
      {
        success: true,
        message: "تم رفع الصورة بنجاح.",
        imageUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "POST /api/admin/media/upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء رفع الصورة.",
      },
      { status: 500 }
    );
  }
}