import { getStore } from "@netlify/blobs";
import { NextResponse } from "next/server";

import { BLOB_STORES, imageReadStoreNames } from "@/src/lib/blob-stores";

const BLOB_STORE_NAME = BLOB_STORES.packageImages;

type RouteContext = {
  params: Promise<{
    key: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { key } = await context.params;

    if (!key || key.includes("/") || key.includes("..")) {
      return new NextResponse("Not Found", {
        status: 404,
      });
    }

    // This deploy's store first; a namespaced test deploy may also read
    // (never write) images uploaded in production. Keys are random.
    let entry: { data: ArrayBuffer; metadata: Record<string, unknown> } | null = null;

    for (const name of imageReadStoreNames(BLOB_STORE_NAME)) {
      entry = await getStore(name).getWithMetadata(key, {
        type: "arrayBuffer",
      });

      if (entry && entry.data !== null) {
        break;
      }
    }

    if (!entry || entry.data === null) {
      return new NextResponse("Not Found", {
        status: 404,
      });
    }

    const contentType =
      typeof entry.metadata?.contentType === "string"
        ? entry.metadata.contentType
        : "application/octet-stream";

    return new NextResponse(entry.data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(
      "Package image read error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "تعذر تحميل الصورة.",
      },
      { status: 500 }
    );
  }
}