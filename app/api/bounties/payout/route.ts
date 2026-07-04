import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bountyId, submissionId } = body;

    if (!bountyId) {
      return NextResponse.json({ error: "Missing bountyId" }, { status: 400 });
    }

    await db.markPaid(bountyId, submissionId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}
