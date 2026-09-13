import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

function makeSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06ffa-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  try {
    const apps = await db.orm.public.App.all();

    return NextResponse.json({
      success: true,
      apps,
    });
  } catch (error) {
    console.error("GET /api/admin/apps error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء جلب التطبيقات",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const platform = String(body.platform ?? "").trim();
    const version = body.version
      ? String(body.version).trim()
      : null;
    const downloadUrl = String(body.downloadUrl ?? "").trim();
    const imageUrl = body.imageUrl
      ? String(body.imageUrl).trim()
      : null;
    const instructions = body.instructions
      ? String(body.instructions).trim()
      : null;
    const notes = body.notes
      ? String(body.notes).trim()
      : null;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم التطبيق مطلوب",
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          message: "وصف التطبيق مطلوب",
        },
        { status: 400 }
      );
    }

    if (!platform) {
      return NextResponse.json(
        {
          success: false,
          message: "المنصة مطلوبة",
        },
        { status: 400 }
      );
    }

    if (!downloadUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "رابط التحميل مطلوب",
        },
        { status: 400 }
      );
    }

    const baseSlug = makeSlug(name);

    if (!baseSlug) {
      return NextResponse.json(
        {
          success: false,
          message: "تعذر إنشاء معرف للتطبيق",
        },
        { status: 400 }
      );
    }

    let slug = baseSlug;
    let counter = 2;

    while (await db.orm.public.App.first({ slug })) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }

    const newApp = await db.orm.public.App.create({
      name,
      slug,
      description,
      platform,
      version,
      downloadUrl,
      imageUrl,
      instructions,
      notes,
      isActive: body.isActive !== false,
    });

    return NextResponse.json(
      {
        success: true,
        message: "تمت إضافة التطبيق بنجاح",
        app: newApp,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/admin/apps error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء إضافة التطبيق",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "معرف التطبيق غير صحيح",
        },
        { status: 400 }
      );
    }

    const existingApp =
      await db.orm.public.App.first({ id });

    if (!existingApp) {
      return NextResponse.json(
        {
          success: false,
          message: "التطبيق غير موجود",
        },
        { status: 404 }
      );
    }

    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const platform = String(body.platform ?? "").trim();
    const version = body.version
      ? String(body.version).trim()
      : null;
    const downloadUrl = String(body.downloadUrl ?? "").trim();
    const imageUrl = body.imageUrl
      ? String(body.imageUrl).trim()
      : null;
    const instructions = body.instructions
      ? String(body.instructions).trim()
      : null;
    const notes = body.notes
      ? String(body.notes).trim()
      : null;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "اسم التطبيق مطلوب",
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          message: "وصف التطبيق مطلوب",
        },
        { status: 400 }
      );
    }

    if (!platform) {
      return NextResponse.json(
        {
          success: false,
          message: "المنصة مطلوبة",
        },
        { status: 400 }
      );
    }

    if (!downloadUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "رابط التحميل مطلوب",
        },
        { status: 400 }
      );
    }

    let slug = existingApp.slug;

    if (name !== existingApp.name) {
      const baseSlug = makeSlug(name);

      if (!baseSlug) {
        return NextResponse.json(
          {
            success: false,
            message: "تعذر إنشاء معرف للتطبيق",
          },
          { status: 400 }
        );
      }

      slug = baseSlug;
      let counter = 2;

      while (true) {
        const appWithSlug =
          await db.orm.public.App.first({ slug });

        if (
          !appWithSlug ||
          appWithSlug.id === id
        ) {
          break;
        }

        slug = `${baseSlug}-${counter}`;
        counter += 1;
      }
    }

    const updatedApp =
      await db.orm.public.App
        .where({ id })
        .update({
          name,
          slug,
          description,
          platform,
          version,
          downloadUrl,
          imageUrl,
          instructions,
          notes,
          isActive: body.isActive !== false,
        });

    if (!updatedApp) {
      return NextResponse.json(
        {
          success: false,
          message: "تعذر تعديل التطبيق",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم تعديل التطبيق بنجاح",
      app: updatedApp,
    });
  } catch (error) {
    console.error("PUT /api/admin/apps error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء تعديل التطبيق",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "معرف التطبيق غير صحيح",
        },
        { status: 400 }
      );
    }

    const existingApp =
      await db.orm.public.App.first({ id });

    if (!existingApp) {
      return NextResponse.json(
        {
          success: false,
          message: "التطبيق غير موجود",
        },
        { status: 404 }
      );
    }

    const deletedApp =
      await db.orm.public.App
        .where({ id })
        .delete();

    if (!deletedApp) {
      return NextResponse.json(
        {
          success: false,
          message: "تعذر حذف التطبيق",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف التطبيق بنجاح",
      app: deletedApp,
    });
  } catch (error) {
    console.error(
      "DELETE /api/admin/apps error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "حدث خطأ أثناء حذف التطبيق",
      },
      { status: 500 }
    );
  }
}