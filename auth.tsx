import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === "register") {
        const uname = username.trim();
        if (!uname) throw new Error(t("auth.usernameRequired"));
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: uname },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: "/" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 scanlines">
      <div className="w-full max-w-md panel-pixel">
        <div className="flex gap-2 mb-6">
          <button
            className={`btn-pixel flex-1 ${mode === "register" ? "" : "btn-pixel-secondary"}`}
            onClick={() => setMode("register")}
            type="button"
          >
            {t("auth.register")}
          </button>
          <button
            className={`btn-pixel flex-1 ${mode === "login" ? "" : "btn-pixel-secondary"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            {t("auth.login")}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-[10px] mb-2">{t("auth.username")}</label>
              <input
                className="input-pixel"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="LxcxStudios"
                autoComplete="username"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-[10px] mb-2">{t("auth.email")}</label>
            <input
              type="email"
              className="input-pixel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] mb-2">{t("auth.password")}</label>
            <input
              type="password"
              className="input-pixel"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </div>

          {err && (
            <div className="border-2 border-[color:var(--color-border)] bg-[color:var(--color-destructive)] text-[color:var(--color-destructive-foreground)] p-3 text-[10px]">
              {err}
            </div>
          )}

          <button type="submit" className="btn-pixel w-full" disabled={busy}>
            {busy ? "..." : mode === "register" ? t("auth.createAccount") : t("auth.signIn")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link to="/" className="text-[10px] underline">{t("common.back")}</Link>
        </div>
      </div>
    </div>
  );
}
