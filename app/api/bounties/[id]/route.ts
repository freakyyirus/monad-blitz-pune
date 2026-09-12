import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { decorateSupabaseError } from "@/app/lib/supabase-guard";

/**
 * GET /api/bounties/[id]
 * Returns a single bounty (same shape as list items: id, title, description,
 * prize, creatorAddress, userId, status, winnerSubmissionId, submissions, createdAt)
 * so the detail page never has to fetch the whole list.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const bounty = await db.getBounty(params.id);
    if (!bounty) {
      return NextResponse.json(
        { error: "Bounty not found", code: "BOUNTY_NOT_FOUND", hint: "Check the bounty id." },
        { status: 404 },
      );
    }
    return NextResponse.json(bounty);
  } catch (error) {
    const decorated = decorateSupabaseError(error);
    console.error("GET /api/bounties/[id] error:", decorated, "id:", params.id);
    const code = (decorated as { code?: string }).code;
    const hint = (decorated as { hint?: string }).hint;
    return NextResponse.json(
      { error: "Could not load bounty.", code, hint },
      { status: code === "SUPABASE_MIGRATIONS_REQUIRED" ? 503 : 500 },
    );
  }
}