import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/leaderboard";
import { LANGS, useI18n, type ControlMode, type Lang } from "@/lib/i18n";
import { downloadGameSource } from "@/lib/source-download";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SchoolLife — Pixel-Art Jump'n'Run" },
      { name: "description", content: "Play SchoolLife: escape school in a retro pixel-art jump'n'run with 30 levels, GoldCoins, a shop and a leaderboard." },
      { property: "og:title", content: "SchoolLife — Play the pixel-art jump'n'run" },
      { property: "og:description", content: "30 pixel levels, GoldCoins, upgrades and a global leaderboard. Escape school!" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function PixelCoin() {
  return (
    <svg viewBox="0 0 16 16" width={40} height={40} shapeRendering="crispEdges" aria-hidden>
      <rect x="5" y="1" width="6" height="1" fill="#ffe066" />
      <rect x="3" y="2" width="10" height="1" fill="#ffcf3a" />
      <rect x="2" y="3" width="12" height="10" fill="#f5b300" />
      <rect x="3" y="13" width="10" height="1" fill="#c98400" />
      <rect x="5" y="14" width="6" height="1" fill="#8a5c00" />
      <rect x="6" y="5" width="1" height="6" fill="#fff2a8" />
      <rect x="9" y="5" width="1" height="6" fill="#c98400" />
    </svg>
  );
}

const CONTROL_MODES: { id: ControlMode; key: string }[] = [
  { id: "auto", key: "settings.control.auto" },
  { id: "keyboard", key: "settings.control.keyboard" },
  { id: "touch", key: "settings.control.touch" },
];

function HomePage() {
  const nav = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { t, lang, setLang, controls, setControls } = useI18n();
  const [view, setView] = useState<"menu" | "board" | "settings">("menu");
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [dl, setDl] = useState<"idle" | "busy" | "done" | "fail">("idle");

  useEffect(() => {
    if (view !== "board" || !user) return;
    setBoard(null);
    fetchLeaderboard().then(setBoard);
  }, [view, user]);

  const canDownload = user?.username === "67Kid";

  async function onDownload() {
    setDl("busy");
    try {
      await downloadGameSource();
      setDl("done");
    } catch {
      setDl("fail");
    }
  }

  return (
    <div className="min-h-screen scanlines flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <header className="mb-8 text-center">
          <h1
            className="text-3xl md:text-5xl leading-tight text-[color:var(--color-secondary)]"
            style={{ textShadow: "3px 3px 0 var(--color-border)" }}
          >
            SCHOOL<span className="text-[color:var(--color-primary)]">LIFE</span>
          </h1>
          <p className="mt-3 text-[10px] md:text-xs text-[color:var(--color-muted-foreground)]">
            {t("app.tagline")}
          </p>
          <div className="mt-4 flex justify-center">
            <PixelCoin />
          </div>
        </header>

        <div className="panel-pixel">
          {loading ? (
            <p className="text-center text-xs">{t("common.loading")}</p>
          ) : !user ? (
            <div className="text-center space-y-4">
              <p className="text-xs">{t("home.signupHint")}</p>
              <Link to="/auth" className="btn-pixel inline-block">
                {t("home.playNow")}
              </Link>
            </div>
          ) : view === "board" ? (
            <div className="space-y-4">
              <div className="text-center text-base text-[color:var(--color-secondary)]">{t("board.title")}</div>
              {board === null ? (
                <p className="text-center text-xs">{t("common.loading")}</p>
              ) : board.length === 0 ? (
                <p className="text-center text-[10px]">{t("board.empty")}</p>
              ) : (
                <ol className="space-y-1">
                  {board.map((r, i) => (
                    <li
                      key={r.username + i}
                      className={`flex items-center justify-between gap-2 text-[10px] border-2 border-[color:var(--color-border)] px-2 py-2 ${
                        r.username === user.username ? "bg-[color:var(--color-accent)] text-[color:var(--color-accent-foreground)]" : ""
                      }`}
                    >
                      <span className="w-6">{i + 1}.</span>
                      <span className="flex-1 truncate">{r.username}</span>
                      <span>{t("board.lvl")} {r.unlocked_level}</span>
                      <span className="w-14 text-right">{r.highscore}</span>
                    </li>
                  ))}
                </ol>
              )}
              <button className="btn-pixel btn-pixel-secondary w-full" onClick={() => setView("menu")}>
                {t("common.back")}
              </button>
            </div>
          ) : view === "settings" ? (
            <div className="space-y-6">
              <div className="text-center text-base text-[color:var(--color-secondary)]">{t("settings.title")}</div>

              <div className="space-y-2">
                <div className="text-[10px]">{t("settings.language")}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      className={`btn-pixel ${lang === l.code ? "" : "btn-pixel-secondary"}`}
                      style={{ fontSize: 9, padding: "10px 4px" }}
                      onClick={() => setLang(l.code as Lang)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[10px]">{t("settings.controls")}</div>
                <div className="grid grid-cols-3 gap-2">
                  {CONTROL_MODES.map((c) => (
                    <button
                      key={c.id}
                      className={`btn-pixel ${controls === c.id ? "" : "btn-pixel-secondary"}`}
                      style={{ fontSize: 9, padding: "10px 4px" }}
                      onClick={() => setControls(c.id)}
                    >
                      {t(c.key)}
                    </button>
                  ))}
                </div>
                <p className="text-[8px] leading-4 text-[color:var(--color-muted-foreground)]">
                  {t("settings.controlsHint")}
                </p>
              </div>

              {canDownload && (
                <div className="space-y-2 border-t-2 border-[color:var(--color-border)] pt-4">
                  <button className="btn-pixel btn-pixel-gold w-full" disabled={dl === "busy"} onClick={onDownload}>
                    {dl === "busy" ? t("settings.downloading") : t("settings.download")}
                  </button>
                  <p className="text-[8px] leading-4 text-[color:var(--color-muted-foreground)]">
                    {dl === "done"
                      ? t("settings.downloadDone")
                      : dl === "fail"
                        ? t("settings.downloadFail")
                        : t("settings.downloadDesc")}
                  </p>
                </div>
              )}

              <button className="btn-pixel btn-pixel-secondary w-full" onClick={() => setView("menu")}>
                {t("common.back")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center text-xs">
                <div>{t("home.loggedInAs")}</div>
                <div className="mt-2 text-base text-[color:var(--color-secondary)]">
                  {user.username}
                </div>
                {user.isFounder && (
                  <div className="mt-2 inline-block px-2 py-1 border-2 border-[color:var(--color-border)] bg-[color:var(--color-accent)] text-[color:var(--color-accent-foreground)] text-[8px]">
                    {t("home.founder")}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button className="btn-pixel" onClick={() => nav({ to: "/game" })}>
                  {t("home.start")}
                </button>
                <button className="btn-pixel btn-pixel-gold" onClick={() => nav({ to: "/shop" })}>
                  {t("home.shop")}
                </button>
                <button className="btn-pixel btn-pixel-secondary" onClick={() => setView("board")}>
                  {t("home.leaderboard")}
                </button>
                <button className="btn-pixel" onClick={() => setView("settings")}>
                  {t("home.settings")}
                </button>
                <button
                  className="btn-pixel col-span-full btn-pixel-danger"
                  onClick={() => signOut()}
                >
                  {t("home.signOut")}
                </button>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-8 text-center text-[8px] leading-4 text-[color:var(--color-muted-foreground)]">
          <div>{t("credits.title")}</div>
          <div className="mt-1">{t("credits.game")}</div>
          <div>{t("credits.music")}</div>
          <div className="mt-2">© LXCXSTUDIOS · SCHOOLLIFE V1.0</div>
        </footer>
      </div>
    </div>
  );
}
