import { supabase } from "@/integrations/supabase/client";

export interface SaveState {
  coins: number;
  unlocked_level: number;
  highscore: number;
  purchased_items: string[];
}

const DEFAULT: SaveState = {
  coins: 0,
  unlocked_level: 1,
  highscore: 0,
  purchased_items: [],
};

export async function loadSave(userId: string): Promise<SaveState> {
  const { data } = await supabase
    .from("save_states")
    .select("coins, unlocked_level, highscore, purchased_items")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return DEFAULT;
  return {
    coins: data.coins ?? 0,
    unlocked_level: data.unlocked_level ?? 1,
    highscore: data.highscore ?? 0,
    purchased_items: Array.isArray(data.purchased_items) ? (data.purchased_items as string[]) : [],
  };
}

export async function saveSave(userId: string, s: SaveState): Promise<void> {
  await supabase.from("save_states").upsert({
    user_id: userId,
    coins: s.coins,
    unlocked_level: s.unlocked_level,
    highscore: s.highscore,
    purchased_items: s.purchased_items,
    updated_at: new Date().toISOString(),
  });
}

// Namen/Beschreibungen kommen aus der Übersetzung: item.<id>.name / item.<id>.desc
export const SHOP_ITEMS = [
  { id: "extra_life", cost: 100 },
  { id: "magnet",     cost: 350 },
  { id: "shield",     cost: 400 },
  { id: "sprint",     cost: 300 },
  { id: "checkpoint", cost: 500 },
] as const;

export type ShopItemId = (typeof SHOP_ITEMS)[number]["id"];
