import { NextResponse } from "next/server";
import { db } from "@/src/prisma/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const userId = Number(
      searchParams.get("userId")
    );

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "معرف المستخدم غير صحيح.",
        },
        { status: 400 }
      );
    }

    const user = await db.orm.public.User.first({
      id: userId,
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "المستخدم غير موجود.",
        },
        { status: 404 }
      );
    }

    const receipts =
      await db.orm.public.Receipt.all();

    const userReceipts = receipts
      .filter(
        (receipt) => receipt.userId === userId
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

    return NextResponse.json({
      success: true,
      receipts: userReceipts.map(
        (receipt) => ({
          id: receipt.id,
          receiptNumber:
            receipt.receiptNumber,
          serviceName:
            receipt.serviceName,
          price: receipt.price,
          durationMonths:
            receipt.durationMonths,
          durationLabel:
            receipt.durationLabel,
          status: receipt.status,
          createdAt:
            receipt.createdAt,
          subscriptionId:
            receipt.subscriptionId,
        })
      ),
    });
  } catch (error) {
    console.error(
      "Customer receipts error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "حدث خطأ أثناء تحميل الإيصالات.",
      },
      { status: 500 }
    );
  }
}