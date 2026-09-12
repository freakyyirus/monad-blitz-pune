import { createClient } from "@supabase/supabase-js";
import { decorateSupabaseError } from "./supabase-guard";

/** Raises a supabase error with a stable code + hint (see supabase-guard.ts). */
const throwDbError = (error: unknown): never => {
  throw decorateSupabaseError(error);
};

export const getSupabaseAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable.");
  }
  
  if (!supabaseKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  return createClient(supabaseUrl, supabaseKey);
};

export interface Submission {
  id: string;
  hunterAddress: string;
  content: string;
  contact: string;
  timestamp: number;
  userId?: string;
  isAiSelected?: boolean;
  aiFeedback?: string;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  prize: string;
  creatorAddress: string;
  userId?: string;
  status: "OPEN" | "PAID";
  winnerSubmissionId?: string;
  submissions: Submission[];
  createdAt: number;
}

// Helper to normalize addresses for comparison
const normalizeAddress = (addr: string) => addr?.toLowerCase() || "";

export const db = {
  getBounties: async () => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .order("created_at", { ascending: false });

    if (error) throwDbError(error);

    return (data ?? []).map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      prize: b.prize,
      creatorAddress: b.creator_address,
      userId: b.user_id,
      status: b.status,
      winnerSubmissionId: b.winner_submission_id,
      createdAt: new Date(b.created_at).getTime(),
      submissions: (b.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
        isAiSelected: s.is_ai_selected,
        aiFeedback: s.ai_feedback,
      })),
    }));
  },

  getBounty: async (id: string) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .eq("id", id)
      .single();

    if (error) return undefined;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      prize: data.prize,
      creatorAddress: data.creator_address,
      userId: data.user_id,
      status: data.status,
      winnerSubmissionId: data.winner_submission_id,
      createdAt: new Date(data.created_at).getTime(),
      submissions: (data.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
        isAiSelected: s.is_ai_selected,
        aiFeedback: s.ai_feedback,
      })),
    };
  },

  createBounty: async (bounty: {
    title: string;
    description: string;
    prize: string;
    creatorAddress: string;
    userId?: string;
  }) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bounties")
      .insert([
        {
          title: bounty.title,
          description: bounty.description,
          prize: bounty.prize,
          creator_address: normalizeAddress(bounty.creatorAddress),
          user_id: bounty.userId,
          status: "OPEN",
        },
      ])
      .select()
      .single();

    if (error) throwDbError(error);
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      prize: data.prize,
      creatorAddress: data.creator_address,
      userId: data.user_id,
      status: data.status,
      createdAt: new Date(data.created_at).getTime(),
      submissions: []
    };
  },

  addSubmission: async (bountyId: string, submission: {
    hunterAddress: string;
    content: string;
    contact: string;
    userId?: string;
  }) => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("submissions")
      .insert([
        {
          bounty_id: bountyId,
          hunter_address: normalizeAddress(submission.hunterAddress),
          content: submission.content,
          contact: submission.contact,
          user_id: submission.userId,
        },
      ])
      .select()
      .single();

    if (error) throwDbError(error);
    return {
      id: data.id,
      hunterAddress: data.hunter_address,
      content: data.content,
      contact: data.contact,
      timestamp: new Date(data.created_at).getTime(),
      userId: data.user_id,
    };
  },

  markPaid: async (bountyId: string, submissionId?: string) => {
    const updateData: any = { status: "PAID" };
    if (submissionId) {
      updateData.winner_submission_id = submissionId;
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase
      .from("bounties")
      .update(updateData)
      .eq("id", bountyId);

    if (error) throwDbError(error);
  },

  /**
   * Compensating store: a bounty was PAID for (x402 fee received on Monad) but
   * the bounties insert failed. Persist the record so the data survives for an
   * operator to reconcile. Throws if the pending_bounties table is missing.
   */
  savePendingBounty: async (bounty: {
    title: string;
    description: string;
    prize: string;
    creatorAddress: string;
    userId?: string;
    txHash: string;
  }) => {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("pending_bounties").insert([
      {
        title: bounty.title,
        description: bounty.description,
        prize: bounty.prize,
        creator_address: normalizeAddress(bounty.creatorAddress),
        user_id: bounty.userId,
        tx_hash: bounty.txHash,
        status: "needs_attention",
      },
    ]);

    if (error) throwDbError(error);
  },

  getBountyBySubmission: async (submissionId: string) => {
    const supabase = getSupabaseAdminClient();
    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .select("bounty_id")
      .eq("id", submissionId)
      .single();
    if (subError || !submission) return undefined;
    return db.getBounty(submission.bounty_id);
  },

  // Get bounties by user ID OR any of their wallet addresses
  getBountiesByUser: async (userId?: string, addresses?: string[]) => {
    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .order("created_at", { ascending: false });

    // Build OR conditions
    const conditions: string[] = [];
    if (userId) {
      conditions.push(`user_id.eq.${userId}`);
    }
    if (addresses && addresses.length > 0) {
      const normalizedAddresses = addresses.map(normalizeAddress).filter(Boolean);
      if (normalizedAddresses.length > 0) {
        conditions.push(`creator_address.in.(${normalizedAddresses.join(",")})`);
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    // Use OR filter
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .or(conditions.join(","))
      .order("created_at", { ascending: false });

    if (error) throwDbError(error);

    return (data || []).map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      prize: b.prize,
      creatorAddress: b.creator_address,
      userId: b.user_id,
      status: b.status,
      createdAt: new Date(b.created_at).getTime(),
      submissions: (b.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
      })),
    }));
  },

  // Get participated bounties by user ID OR any of their wallet addresses
  getParticipatedByUser: async (userId?: string, addresses?: string[]) => {
    // Build conditions for submissions query
    const conditions: string[] = [];
    if (userId) {
      conditions.push(`user_id.eq.${userId}`);
    }
    if (addresses && addresses.length > 0) {
      const normalizedAddresses = addresses.map(normalizeAddress).filter(Boolean);
      if (normalizedAddresses.length > 0) {
        conditions.push(`hunter_address.in.(${normalizedAddresses.join(",")})`);
      }
    }

    if (conditions.length === 0) {
      return [];
    }

    // First get all submission bounty_ids for this user
    const supabase = getSupabaseAdminClient();
    const { data: submissions, error: subError } = await supabase
      .from("submissions")
      .select("bounty_id")
      .or(conditions.join(","));

    if (subError) throw subError;
    if (!submissions || submissions.length === 0) return [];

    const bountyIds = Array.from(new Set(submissions.map((s: any) => s.bounty_id)));

    // Then get all those bounties
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .in("id", bountyIds)
      .order("created_at", { ascending: false });

    if (error) throwDbError(error);

    return (data || []).map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description,
      prize: b.prize,
      creatorAddress: b.creator_address,
      userId: b.user_id,
      status: b.status,
      createdAt: new Date(b.created_at).getTime(),
      submissions: (b.submissions || []).map((s: any) => ({
        id: s.id,
        hunterAddress: s.hunter_address,
        content: s.content,
        contact: s.contact,
        timestamp: new Date(s.created_at).getTime(),
        userId: s.user_id,
      })),
    }));
  },

  // Legacy functions for backwards compatibility
  getBountiesByCreator: async (creatorAddress: string) => {
    return db.getBountiesByUser(undefined, [creatorAddress]);
  },

  getParticipatedBounties: async (hunterAddress: string) => {
    return db.getParticipatedByUser(undefined, [hunterAddress]);
  },
};
