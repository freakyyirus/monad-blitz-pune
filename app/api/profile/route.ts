import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type"); // 'created' or 'participated'
  const userId = searchParams.get("userId"); // Privy user ID
  const addresses = searchParams.get("addresses"); // Comma-separated addresses

  if (!userId && !addresses) {
    return NextResponse.json(
      { error: "userId or addresses required", code: "MISSING_FIELDS", hint: "Pass userId or a comma-separated addresses list." },
      { status: 400 },
    );
  }

  const addressList = addresses ? addresses.split(",").filter(Boolean) : [];

  try {
    let data;
    if (type === "created") {
      data = await db.getBountiesByUser(userId || undefined, addressList);
    } else if (type === "participated") {
      data = await db.getParticipatedByUser(userId || undefined, addressList);
    } else {
      return NextResponse.json(
        { error: "Invalid type. Use 'created' or 'participated'", code: "BAD_TYPE", hint: undefined },
        { status: 400 },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("Profile fetch error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Could not load profile.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}