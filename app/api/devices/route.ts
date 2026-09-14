import { NextRequest, NextResponse } from "next/server";
import { db, ensureDatabaseConnection } from "@/src/prisma/db";

export const dynamic = "force-dynamic";

function normalizeServiceType(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  return normalized === "VIP" || normalized === "IPTV"
    ? normalized
    : "";
}

function normalizeSlug(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseConnection();

    const { searchParams } = new URL(request.url);

    const serviceType = normalizeServiceType(
      searchParams.get("serviceType")
    );

    const packageSlug = normalizeSlug(
      searchParams.get("packageSlug")
    );

    const allDevices =
      await db.orm.public.Device.all();

    let devices = allDevices.filter(
      (device) => device.isActive
    );

    if (serviceType) {
      devices = devices.filter(
        (device) =>
          normalizeServiceType(
            device.serviceType
          ) === serviceType
      );
    }

    /*
     * عندما يتم إرسال packageSlug:
     * نجيب الباقة المطلوبة ثم نجيب العلاقات
     * PackageDevice ونرجع فقط الأجهزة المرتبطة بها.
     */
    if (packageSlug) {
      const allPackages =
        await db.orm.public.Package.all();

      const selectedPackage =
        allPackages.find(
          (pkg) =>
            pkg.slug.toLowerCase() ===
              packageSlug &&
            pkg.isActive
        );

      if (!selectedPackage) {
        return NextResponse.json(
          {
            success: true,
            devices: [],
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "no-store",
            },
          }
        );
      }

      const allPackageDevices =
        await db.orm.public.PackageDevice.all();

      const linkedDeviceIds =
        new Set(
          allPackageDevices
            .filter(
              (relation) =>
                relation.packageId ===
                selectedPackage.id
            )
            .map(
              (relation) =>
                relation.deviceId
            )
        );

      devices = devices.filter(
        (device) =>
          linkedDeviceIds.has(
            device.id
          )
      );
    }

    devices.sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }

      return a.name.localeCompare(
        b.name,
        "ar"
      );
    });

    return NextResponse.json(
      {
        success: true,
        devices,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/devices error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "تعذر جلب الأجهزة",
        devices: [],
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}