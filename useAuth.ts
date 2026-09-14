import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export interface AppUser {
  id: string;
  email: string | null;
  username: string;
  isFounder: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(s: Session | null) {
      if (!s) {
        if (!cancelled) { setUser(null); setLoading(false); }
        return;
      }
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", s.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", s.user.id),
      ]);
      if (cancelled) return;
      setUser({
        id: s.user.id,
        email: s.user.email ?? null,
        username: profile?.username ?? (s.user.email?.split("@")[0] ?? "Spieler"),
        isFounder: (roles ?? []).some((r) => r.role === "founder"),
      });
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      loadProfile(s);
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return { session, user, loading, signOut: () => supabase.auth.signOut() };
}
