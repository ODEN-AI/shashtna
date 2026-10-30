import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

import { BLOB_STORES, imageReadStoreNames } from "@/src/lib/blob-stores";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      key: string;
    }>;
  }
) {
  try {
    const {
      key,
    } = await context.params;

    const decodedKey =
      decodeURIComponent(key);

    if (!decodedKey) {
      return new NextResponse(
        "الصورة غير موجودة.",
        {
          status: 404,
        }
      );
    }

    // This deploy's store first; a namespaced test deploy may also read
    // (never write) images uploaded in production. Keys are random.
    let result: { data: ArrayBuffer; metadata: Record<string, unknown> } | null = null;

    for (const name of imageReadStoreNames(BLOB_STORES.media)) {
      result = await getStore(name).getWithMetadata(decodedKey, {
        type: "arrayBuffer",
      });

      if (result?.data) {
        break;
      }
    }

    if (!result?.data) {
      return new NextResponse(
        "الصورة غير موجودة.",
        {
          status: 404,
        }
      );
    }

    const contentType =
      typeof result.metadata?.contentType ===
      "string"
        ? result.metadata.contentType
        : "application/octet-stream";

    // Byte ranges let browsers (Safari in particular) stream uploaded
    // videos; requests without a Range header are served exactly as before.
    const total = result.data.byteLength;
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");

    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), total - 1) : total - 1;

      if (start >= total || start > end) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      }

      return new NextResponse(result.data.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(
      result.data,
      {
        status: 200,
        headers: {
          "Content-Type":
            contentType,
          "Accept-Ranges": "bytes",
          "Cache-Control":
            "public, max-age=31536000, immutable",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/uploads/media/[key] error:",
      error
    );

    return new NextResponse(
      "تعذر تحميل الصورة.",
      {
        status: 500,
      }
    );
  }
}