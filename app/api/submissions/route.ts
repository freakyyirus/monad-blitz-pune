import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bountyId, hunterAddress, content, contact, userId } = body;

    if (!bountyId || !hunterAddress || !content) {
      return NextResponse.json(
        { error: "Missing fields", code: "MISSING_FIELDS", hint: "bountyId, hunterAddress and content are required." },
        { status: 400 },
      );
    }

    const submission = await db.addSubmission(bountyId, {
      hunterAddress,
      content,
      contact: contact || "",
      userId,
    });

    return NextResponse.json(submission, { status: 200 });
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("Submission error:", decorated);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Failed to submit.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}