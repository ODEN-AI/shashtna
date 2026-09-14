import { getStore } from "@netlify/blobs";
import { NextResponse } from "next/server";

const BLOB_STORE_NAME = "shashtna-package-images";

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

    const store = getStore(BLOB_STORE_NAME);

    const entry = await store.getWithMetadata(key, {
      type: "arrayBuffer",
    });

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