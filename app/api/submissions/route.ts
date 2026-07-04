import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bountyId, hunterAddress, content, contact, userId } = body;

    if (!bountyId || !hunterAddress || !content) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const submission = await db.addSubmission(bountyId, {
      hunterAddress,
      content,
      contact: contact || "",
      userId, // Include Privy user ID for tracking
    });

    return NextResponse.json(submission, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
