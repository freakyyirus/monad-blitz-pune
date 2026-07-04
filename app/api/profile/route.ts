import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // 'created' or 'participated'
  const userId = searchParams.get("userId"); // Privy user ID
  const addresses = searchParams.get("addresses"); // Comma-separated addresses

  if (!userId && !addresses) {
    return NextResponse.json({ error: "userId or addresses required" }, { status: 400 });
  }

  // Parse addresses from comma-separated string
  const addressList = addresses ? addresses.split(",").filter(Boolean) : [];

  try {
    let data;
    if (type === "created") {
      data = await db.getBountiesByUser(userId || undefined, addressList);
    } else if (type === "participated") {
      data = await db.getParticipatedByUser(userId || undefined, addressList);
    } else {
      return NextResponse.json({ error: "Invalid type. Use 'created' or 'participated'" }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
