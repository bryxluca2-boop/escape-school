import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardRow {
  username: string;
  highscore: number;
  unlocked_level: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string) => Promise<{ data: LeaderboardRow[] | null; error: unknown }>;
  }).rpc("get_leaderboard");
  if (error || !data) return [];
  return data;
}
