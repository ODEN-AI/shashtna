import { NextResponse } from "next/server";
import {
  db,
  ensureDatabaseConnection,
} from "@/src/prisma/db";

export const dynamic = "force-dynamic";

const DB_TIMEOUT = 8000;

function timeoutPromise(
  timeoutMs: number,
  message: string
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });
}

type CustomerSubscription = {
  id: number;
  userId: number;
  serviceType: string;
  username: string | null;
  password: string | null;
  macAddress: string | null;
  deviceId: string | null;
  status: string;
  packageName: string;
  startDate: string;
  expiryDate: string;
  connections: number;
  maxConnections: number;
  createdAt: string;
  updatedAt: string;
};

async function getUserSubscriptions(
  userId: number
) {
  const result =
    db.orm.public.Subscription.all();

  const subscriptions: CustomerSubscription[] =
    [];

  const readSubscriptions = (async () => {
    for await (const subscription of result) {
      if (
        subscription.userId === userId
      ) {
        subscriptions.push(
          subscription
        );
      }
    }

    return subscriptions;
  })();

  return Promise.race([
    readSubscriptions,
    timeoutPromise(
      DB_TIMEOUT,
      "Subscriptions query timed out."
    ),
  ]);
}

export async function GET(
  request: Request
) {
  try {
    await ensureDatabaseConnection();

    const {
      searchParams,
    } = new URL(request.url);

    const userId = Number(
      searchParams.get("userId")
    );

    console.log(
      "GET /api/subscriptions",
      { userId }
    );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "معرّف المستخدم غير صحيح.",
        },
        { status: 400 }
      );
    }

    console.log("Checking user...");

    const user =
      await Promise.race([
        db.orm.public.User.first({
          id: userId,
        }),
        timeoutPromise(
          DB_TIMEOUT,
          "User query timed out."
        ),
      ]);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "المستخدم غير موجود.",
        },
        { status: 404 }
      );
    }

    console.log(
      "User found:",
      user.id
    );

    console.log(
      "Loading subscriptions..."
    );

    const userSubscriptions =
      await getUserSubscriptions(
        userId
      );

    userSubscriptions.sort(
      (a, b) =>
        new Date(
          b.createdAt
        ).getTime() -
        new Date(
          a.createdAt
        ).getTime()
    );

    console.log(
      "User subscriptions:",
      userSubscriptions.length
    );

    return NextResponse.json(
      {
        success: true,

        subscriptions:
          userSubscriptions.map(
            (subscription) => ({
              id:
                subscription.id,

              serviceType:
                subscription.serviceType,

              username:
                subscription.username,

              password:
                subscription.password,

              macAddress:
                subscription.macAddress,

              deviceId:
                subscription.deviceId,

              status:
                subscription.status,

              packageName:
                subscription.packageName,

              startDate:
                subscription.startDate,

              expiryDate:
                subscription.expiryDate,

              connections:
                subscription.connections,

              maxConnections:
                subscription.maxConnections,

              createdAt:
                subscription.createdAt,

              updatedAt:
                subscription.updatedAt,
            })
          ),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Customer subscriptions error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Unknown error";

    console.error(
      "Customer subscriptions error message:",
      message
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء تحميل الاشتراكات.",
        error:
          process.env.NODE_ENV ===
          "development"
            ? message
            : undefined,
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}