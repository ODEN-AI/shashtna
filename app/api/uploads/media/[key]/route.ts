import { NextResponse } from "next/server";
import { getStore } from "@netlify/blobs";

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

    const store =
      getStore("shashtna-media");

    const result =
      await store.getWithMetadata(
        decodedKey,
        {
          type: "arrayBuffer",
        }
      );

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

    return new NextResponse(
      result.data,
      {
        status: 200,
        headers: {
          "Content-Type":
            contentType,
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