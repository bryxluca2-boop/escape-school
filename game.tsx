import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/lib/i18n";
import { loadSave, saveSave, type SaveState } from "@/lib/save";
import { Engine, type InputState } from "@/game/engine";
import { Chiptune } from "@/game/audio";
import { TOTAL_LEVELS } from "@/game/levels";
import { EndingCredits } from "@/components/EndingCredits";

export const Route = createFileRoute("/_authenticated/game")({
  component: GamePage,
});

function GamePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { t, controls } = useI18n();
  const [save, setSave] = useState<SaveState | null>(null);
  const [selectedLevel, setSelectedLevel] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [result, setResult] = useState<{ won: boolean; coins: number; level: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const audioRef = useRef<Chiptune>(new Chiptune());
  const inputRef = useRef<InputState>({ left: false, right: false, jumpPressed: false, dashPressed: false, specialPressed: false });

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  }, []);
  const showTouchPad = controls === "touch" || (controls === "auto" && isTouchDevice);

  useEffect(() => {
    if (!user) return;
    loadSave(user.id).then((s) => { setSave(s); setSelectedLevel(s.unlocked_level); });
  }, [user]);

  // Resize canvas to viewport
  useEffect(() => {
    if (!playing) return;
    const c = canvasRef.current!;
    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [playing]);

  // Keyboard input
  useEffect(() => {
    if (!playing) return;
    const down = (e: KeyboardEvent) => {
      const s = inputRef.current;
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.right = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") s.jumpPressed = true;
      if (e.code === "ShiftLeft" || e.code === "KeyJ") s.dashPressed = true;
      if (e.code === "KeyK") s.specialPressed = true;
      engineRef.current?.setInput(s);
      if (e.code === "Space" || e.code === "ArrowUp") e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      const s = inputRef.current;
      if (e.code === "ArrowLeft" || e.code === "KeyA") s.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") s.right = false;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") s.jumpPressed = false;
      if (e.code === "ShiftLeft" || e.code === "KeyJ") s.dashPressed = false;
      if (e.code === "KeyK") s.specialPressed = false;
      engineRef.current?.setInput(s);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [playing]);

  function startLevel(level: number) {
    if (!save || !user) return;
    setPlaying(true);
    audioRef.current.init();
    audioRef.current.startBgm();
    // wait for canvas mount
    requestAnimationFrame(() => {
      const c = canvasRef.current!;
      const items = new Set(save.purchased_items);
      const eng = new Engine(c, {
        level,
        extraLife: items.has("extra_life"),
        magnet: items.has("magnet"),
        shield: items.has("shield"),
        sprint: items.has("sprint"),
        onExit: async ({ won, coins }) => {
          audioRef.current.stopBgm();
          const nextSave: SaveState = {
            ...save,
            coins: save.coins + coins,
            unlocked_level: won ? Math.min(TOTAL_LEVELS, Math.max(save.unlocked_level, level + 1)) : save.unlocked_level,
            highscore: Math.max(save.highscore, coins),
          };
          await saveSave(user.id, nextSave);
          setSave(nextSave);
          setPlaying(false);
          setResult({ won, coins, level });
          if (won && level >= TOTAL_LEVELS) setShowCredits(true);
        },
      }, audioRef.current);
      engineRef.current = eng;
      eng.start();
    });
  }

  function stopGame() {
    engineRef.current?.stop();
    engineRef.current = null;
    audioRef.current.stopBgm();
    setPlaying(false);
  }

  // Touch handlers
  const setInput = (patch: Partial<InputState>) => {
    Object.assign(inputRef.current, patch);
    engineRef.current?.setInput(inputRef.current);
  };
  const pressAndRelease = (key: "jumpPressed" | "dashPressed" | "specialPressed") => {
    setInput({ [key]: true });
    setTimeout(() => setInput({ [key]: false }), 60);
  };

  if (showCredits) {
    return <EndingCredits onDone={() => setShowCredits(false)} />;
  }

  if (!save) {
    return <div className="min-h-screen flex items-center justify-center text-xs">{t("common.loading")}</div>;
  }

  if (!playing && result) {
    const allDone = result.won && result.level >= TOTAL_LEVELS;
    return (
      <div className="fixed inset-0 bg-black scanlines flex flex-col items-center justify-center px-6 text-center">
        <div className={`text-2xl mb-3 ${result.won ? "text-[color:var(--color-accent)]" : "text-[color:var(--color-destructive)]"}`}>
          {result.won ? t("game.levelCleared") : t("game.gameOver")}
        </div>
        <div className="text-xs mb-1">{t("game.level")} {result.level}</div>
        <div className="text-xs mb-6 text-[color:var(--color-accent)]">+{result.coins} GOLDCOINS</div>
        {allDone && <div className="text-[10px] mb-4 text-[color:var(--color-secondary)]">{t("game.allDone")}</div>}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {result.won && result.level < TOTAL_LEVELS && (
            <button className="btn-pixel btn-pixel-gold" onClick={() => { setResult(null); startLevel(result.level + 1); }}>
              {t("game.nextLevel")}
            </button>
          )}
          {allDone && (
            <button className="btn-pixel btn-pixel-gold" onClick={() => setShowCredits(true)}>
              {t("game.watchCredits")}
            </button>
          )}
          <button className="btn-pixel" onClick={() => { setResult(null); startLevel(result.level); }}>
            {t("game.retry")}
          </button>
          <button className="btn-pixel btn-pixel-secondary" onClick={() => setResult(null)}>
            {t("game.levelSelect")}
          </button>
        </div>
      </div>
    );
  }

  if (!playing) {
    return (
      <div className="min-h-screen scanlines p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl">{t("game.chooseLevel")}</h1>
            <button className="btn-pixel btn-pixel-secondary" onClick={() => nav({ to: "/" })}>{t("common.menu")}</button>
          </div>
          <div className="panel-pixel mb-4">
            <div className="text-xs">
              {t("game.coins")}: <span className="text-[color:var(--color-accent)]">{save.coins}</span> ·{" "}
              {t("game.unlockedTo")} {save.unlocked_level} · {t("game.highscore")} {save.highscore}
            </div>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).map((n) => {
              const locked = n > save.unlocked_level;
              const isSel = n === selectedLevel;
              return (
                <button
                  key={n}
                  disabled={locked}
                  onClick={() => setSelectedLevel(n)}
                  className={`btn-pixel ${isSel ? "" : "btn-pixel-secondary"}`}
                  style={{ padding: "10px 0" }}
                >
                  {locked ? "X" : n}
                </button>
              );
            })}
          </div>
          <div className="mt-6 text-center">
            <button className="btn-pixel btn-pixel-gold" onClick={() => startLevel(selectedLevel)}>
              {t("game.startLevel")} {selectedLevel}
            </button>
          </div>
          <div className="mt-6 text-[10px] leading-5 text-[color:var(--color-muted-foreground)] text-center">
            {showTouchPad ? t("game.hintTouch") : t("game.hintKeyboard")}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="fixed inset-0 bg-black" style={{ touchAction: "none" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Pause */}
      <button
        onClick={stopGame}
        className="absolute top-3 right-3 btn-pixel btn-pixel-danger"
        style={{ padding: "6px 10px", fontSize: 10 }}
      >
        PAUSE
      </button>

      {showTouchPad && (
        <>
          {/* Touch D-Pad links */}
          <div className="absolute left-4 bottom-6 select-none" style={{ touchAction: "none" }}>
            <div className="grid grid-cols-3 grid-rows-2 gap-1">
              <div />
              <div />
              <div />
              <button
                onTouchStart={(e) => { e.preventDefault(); setInput({ left: true }); }}
                onTouchEnd={(e) => { e.preventDefault(); setInput({ left: false }); }}
                onMouseDown={() => setInput({ left: true })}
                onMouseUp={() => setInput({ left: false })}
                onMouseLeave={() => setInput({ left: false })}
                className="btn-pixel btn-pixel-secondary"
                style={{ width: 56, height: 56, padding: 0 }}
              >
                &lt;
              </button>
              <div />
              <button
                onTouchStart={(e) => { e.preventDefault(); setInput({ right: true }); }}
                onTouchEnd={(e) => { e.preventDefault(); setInput({ right: false }); }}
                onMouseDown={() => setInput({ right: true })}
                onMouseUp={() => setInput({ right: false })}
                onMouseLeave={() => setInput({ right: false })}
                className="btn-pixel btn-pixel-secondary"
                style={{ width: 56, height: 56, padding: 0 }}
              >
                &gt;
              </button>
            </div>
          </div>

          {/* Aktions-Buttons rechts */}
          <div className="absolute right-4 bottom-6 flex items-end gap-2 select-none" style={{ touchAction: "none" }}>
            <button
              onTouchStart={(e) => { e.preventDefault(); pressAndRelease("specialPressed"); }}
              onClick={() => pressAndRelease("specialPressed")}
              className="btn-pixel btn-pixel-gold"
              style={{ width: 52, height: 52, padding: 0, fontSize: 10 }}
            >
              SPEC
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); pressAndRelease("dashPressed"); }}
              onClick={() => pressAndRelease("dashPressed")}
              className="btn-pixel btn-pixel-secondary"
              style={{ width: 60, height: 60, padding: 0, fontSize: 10 }}
            >
              DASH
            </button>
            <button
              onTouchStart={(e) => { e.preventDefault(); pressAndRelease("jumpPressed"); }}
              onClick={() => pressAndRelease("jumpPressed")}
              className="btn-pixel"
              style={{ width: 72, height: 72, padding: 0, fontSize: 12 }}
            >
              JUMP
            </button>
          </div>
        </>
      )}
    </div>
  );
}
