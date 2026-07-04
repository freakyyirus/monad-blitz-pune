import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Use Service Role for backend ops

export const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { data, error } = await supabase
      .from("bounties")
      .select("*, submissions:submissions!submissions_bounty_id_fkey(*)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return data.map((b: any) => ({
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

    if (error) throw error;
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

    if (error) throw error;
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

    const { error } = await supabase
      .from("bounties")
      .update(updateData)
      .eq("id", bountyId);

    if (error) throw error;
  },

  // Get bounties by user ID OR any of their wallet addresses
  getBountiesByUser: async (userId?: string, addresses?: string[]) => {
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

    if (error) throw error;

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

    if (error) throw error;

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
