// SchoolLife Pixel-Engine.
// Alles wird prozedural per Canvas gezeichnet: keine Assets, konsistenter Pixel-Look.
// Enthält: Physik, Kollision, Kamera, Spieler (Animations-Zustände),
//          Gegner-KI (Patrouille + Verfolgen), GoldCoins, Fallen,
//          Partikel, HUD, Touch- und Tastatur-Steuerung.

import { Chiptune } from "./audio";
import { getLevel, type LevelData } from "./levels";

// --- Konstanten ------------------------------------------------------------
const TILE = 16;                 // Interne Pixelgröße pro Tile
const VW = 320;                  // Interne Renderauflösung (16:9)
const VH = 192;
const GRAV = 0.55;
const MAX_FALL = 9;
const BASE_MOVE = 1.7;
const JUMP_V = -8.2;
const DASH_V = 5.5;
const IFRAMES = 60;              // frames

// Palette pro Theme
const THEME_COLORS: Record<LevelData["theme"], { bg: string; wall: string; wallDark: string; plat: string; accent: string }> = {
  classroom: { bg: "#8ec5d8", wall: "#c98d5e", wallDark: "#8a5a34", plat: "#e0b98a", accent: "#5b8a3a" },
  hallway:   { bg: "#7fb8d4", wall: "#a1a1a1", wallDark: "#5f5f5f", plat: "#cfcfcf", accent: "#3c7ec1" },
  gym:       { bg: "#f0d38a", wall: "#c07a3a", wallDark: "#7a4a20", plat: "#e9b56f", accent: "#3c7ec1" },
  cafeteria: { bg: "#f5b5b8", wall: "#b06060", wallDark: "#6d3838", plat: "#e88888", accent: "#f0d38a" },
  basement:  { bg: "#3a4a5f", wall: "#5c4a3a", wallDark: "#2f251c", plat: "#6f5a44", accent: "#c98400" },
  roof:      { bg: "#a7d8f0", wall: "#7f6a55", wallDark: "#4f3f30", plat: "#a89078", accent: "#e0e0e0" },
  library:   { bg: "#c5b892", wall: "#7f5a3a", wallDark: "#4f3520", plat: "#c9a874", accent: "#5b8a3a" },
};

// --- Utils -----------------------------------------------------------------
interface Rect { x: number; y: number; w: number; h: number }
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Coin { x: number; y: number; taken: boolean; wobble: number }
interface Spike { x: number; y: number; w: number; h: number }
interface Laser { x: number; y: number }
interface Enemy {
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  dir: number; state: "patrol" | "chase";
  patrolMinX: number; patrolMaxX: number;
}
interface Exit { x: number; y: number; w: number; h: number }

// --- Input -----------------------------------------------------------------
export interface InputState {
  left: boolean; right: boolean; jumpPressed: boolean;
  dashPressed: boolean; specialPressed: boolean;
}

// --- Game options ----------------------------------------------------------
export interface EngineOptions {
  level: number;
  extraLife: boolean;
  magnet: boolean;
  shield: boolean;
  sprint: boolean;
  onExit: (result: { won: boolean; coins: number }) => void;
}

// --- Engine ----------------------------------------------------------------
export class Engine {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private raf = 0;
  private lastT = 0;
  private running = false;

  private level: LevelData;
  private colors = THEME_COLORS.classroom;

  // Player
  private px = 32; private py = 0;
  private pvx = 0; private pvy = 0;
  private pw = 10; private ph = 14;
  private onGround = false;
  private jumpsLeft = 2;
  private coyote = 0;
  private facing = 1;
  private animT = 0;
  private state: "idle" | "run" | "jump" | "fall" | "hurt" = "idle";
  private iframes = 0;
  private lives = 3;
  private hasShield = false;
  private dashCd = 0;

  // World
  private coins: Coin[] = [];
  private spikes: Spike[] = [];
  private lasers: Laser[] = [];
  private enemies: Enemy[] = [];
  private exit: Exit = { x: 0, y: 0, w: 12, h: 16 };
  private walls: Rect[] = [];   // solide Tiles (grob unioniert)
  private particles: Particle[] = [];

  private cam = { x: 0, y: 0 };
  private coinsCollected = 0;
  private frame = 0;
  private shake = 0;
  private combo = 0;
  private comboTimer = 0;
  private lastComboText = "";
  private lastComboTimer = 0;

  private input: InputState = { left: false, right: false, jumpPressed: false, dashPressed: false, specialPressed: false };
  private jumpQueued = false;
  private dashQueued = false;

  private opts: EngineOptions;
  private audio: Chiptune;
  private done = false;

  constructor(canvas: HTMLCanvasElement, opts: EngineOptions, audio: Chiptune) {
    this.canvas = canvas;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("no 2d ctx");
    this.ctx = c;
    this.ctx.imageSmoothingEnabled = false;
    this.opts = opts;
    this.audio = audio;
    this.lives = 3 + (opts.extraLife ? 1 : 0);
    this.hasShield = opts.shield;
    this.level = getLevel(opts.level);
    this.colors = THEME_COLORS[this.level.theme];
    this.buildLevel();
  }

  private buildLevel() {
    const L = this.level;
    for (let r = 0; r < L.height; r++) {
      for (let c = 0; c < L.width; c++) {
        const ch = L.rows[r][c];
        const wx = c * TILE, wy = r * TILE;
        switch (ch) {
          case "#": this.walls.push({ x: wx, y: wy, w: TILE, h: TILE }); break;
          case "=": this.walls.push({ x: wx, y: wy, w: TILE, h: 4 }); break;
          case "^": this.spikes.push({ x: wx + 2, y: wy + 8, w: TILE - 4, h: TILE - 8 }); break;
          case "L": this.lasers.push({ x: wx, y: wy }); break;
          case "C": this.coins.push({ x: wx + 4, y: wy + 4, taken: false, wobble: Math.random() * Math.PI * 2 }); break;
          case "P": this.px = wx + 2; this.py = wy; break;
          case "E": this.exit = { x: wx + 2, y: wy, w: 12, h: 16 }; break;
          case "T": this.enemies.push({
            x: wx, y: wy - 2, vx: 0.7, vy: 0, w: 12, h: 14, dir: 1, state: "patrol",
            patrolMinX: Math.max(0, wx - TILE * 4), patrolMaxX: wx + TILE * 4,
          }); break;
        }
      }
    }
  }

  setInput(next: Partial<InputState>) {
    if (next.jumpPressed && !this.input.jumpPressed) this.jumpQueued = true;
    if (next.dashPressed && !this.input.dashPressed) this.dashQueued = true;
    this.input = { ...this.input, ...next } as InputState;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(33, t - this.lastT);
      this.lastT = t;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  // --- Update ---------------------------------------------------------------
  private update(_dt: number) {
    if (this.done) return;
    this.frame++;
    if (this.iframes > 0) this.iframes--;
    if (this.dashCd > 0) this.dashCd--;

    // Horizontal
    const speed = BASE_MOVE * (this.opts.sprint ? 1.5 : 1);
    let ax = 0;
    if (this.input.left)  { ax -= 1; this.facing = -1; }
    if (this.input.right) { ax += 1; this.facing = 1; }
    this.pvx = ax * speed;

    // Jump (Doppelsprung immer aktiv, mit Coyote-Time)
    if (this.coyote > 0) this.coyote--;
    if (this.jumpQueued) {
      this.jumpQueued = false;
      const canGround = this.onGround || this.coyote > 0;
      if (canGround || this.jumpsLeft > 0) {
        this.pvy = canGround ? JUMP_V : JUMP_V * 0.95;
        this.coyote = 0;
        this.jumpsLeft = canGround ? 1 : this.jumpsLeft - 1;
        this.audio.jump();
        this.spawnParticles(this.px + this.pw / 2, this.py + this.ph, 6, "#ffffffaa");
      }
    }

    // Dash
    if (this.dashQueued && this.dashCd <= 0) {
      this.dashQueued = false;
      this.pvx = this.facing * DASH_V;
      this.dashCd = 40;
      this.spawnParticles(this.px + this.pw / 2, this.py + this.ph / 2, 8, "#cceaff");
    }

    // Gravity
    this.pvy = Math.min(MAX_FALL, this.pvy + GRAV);

    // Move + collide
    this.px += this.pvx;
    this.resolveAxis(true);
    this.py += this.pvy;
    this.onGround = false;
    this.resolveAxis(false);

    // State
    if (!this.onGround) this.state = this.pvy < 0 ? "jump" : "fall";
    else this.state = Math.abs(this.pvx) > 0.1 ? "run" : "idle";
    if (this.iframes > 0 && this.iframes > IFRAMES - 20) this.state = "hurt";
    this.animT += 0.15;

    // Enemies
    for (const e of this.enemies) {
      const sees = Math.abs(this.px - e.x) < 90 && Math.abs(this.py - e.y) < 24;
      e.state = sees ? "chase" : "patrol";
      const target = e.state === "chase" ? Math.sign(this.px - e.x) : e.dir;
      e.vx = target * (e.state === "chase" ? 1.4 : 0.7);
      e.dir = target || e.dir;
      e.x += e.vx;
      e.vy = Math.min(MAX_FALL, e.vy + GRAV);
      e.y += e.vy;
      // simple ground snap: check walls under feet
      for (const w of this.walls) {
        const eb: Rect = { x: e.x, y: e.y, w: e.w, h: e.h };
        if (overlap(eb, w)) {
          if (e.vy > 0) { e.y = w.y - e.h; e.vy = 0; }
          else if (e.vy < 0) { e.y = w.y + w.h; e.vy = 0; }
        }
      }
      if (e.state === "patrol") {
        if (e.x < e.patrolMinX) { e.x = e.patrolMinX; e.dir = 1; }
        if (e.x > e.patrolMaxX) { e.x = e.patrolMaxX; e.dir = -1; }
      }
    }

    // Coin pickup + magnet
    const pcx = this.px + this.pw / 2, pcy = this.py + this.ph / 2;
    for (const c of this.coins) {
      if (c.taken) continue;
      c.wobble += 0.15;
      if (this.opts.magnet) {
        const dx = pcx - (c.x + 4), dy = pcy - (c.y + 4);
        const d = Math.hypot(dx, dy);
        if (d < 60 && d > 1) { c.x += (dx / d) * 2.2; c.y += (dy / d) * 2.2; }
      }
      const cb: Rect = { x: c.x, y: c.y, w: 8, h: 8 };
      const pb: Rect = { x: this.px, y: this.py, w: this.pw, h: this.ph };
      if (overlap(pb, cb)) {
        c.taken = true;
        this.coinsCollected++;
        this.combo++;
        this.comboTimer = 90;
        if (this.combo >= 3) {
          this.lastComboText = "x" + this.combo + " COMBO!";
          this.lastComboTimer = 60;
        }
        this.audio.coin();
        this.spawnParticles(c.x + 4, c.y + 4, 8, "#ffe066");
      }
    }

    // Hazards / enemies collision
    if (this.iframes <= 0) {
      const pb: Rect = { x: this.px, y: this.py, w: this.pw, h: this.ph };
      let hit = false;
      for (const s of this.spikes) if (overlap(pb, s)) { hit = true; break; }
      if (!hit) for (const e of this.enemies) if (overlap(pb, { x: e.x, y: e.y, w: e.w, h: e.h })) { hit = true; break; }
      if (!hit) for (const l of this.lasers) {
        const beam: Rect = { x: l.x, y: l.y + 6, w: TILE, h: 4 };
        if (overlap(pb, beam) && (this.frame % 120 < 60)) { hit = true; break; }
      }
      // Fell off world
      if (this.py > this.level.height * TILE + 60) hit = true;

      if (hit) this.hurt();
    }

    // Exit
    const pb: Rect = { x: this.px, y: this.py, w: this.pw, h: this.ph };
    if (overlap(pb, this.exit)) this.finish(true);

    // Camera
    const targetCamX = clamp(this.px - VW / 2, 0, this.level.width * TILE - VW);
    this.cam.x += (targetCamX - this.cam.x) * 0.12;
    this.cam.y = 0;
    if (this.shake > 0) this.shake *= 0.85;
    if (this.comboTimer > 0) this.comboTimer--; else this.combo = 0;
    if (this.lastComboTimer > 0) this.lastComboTimer--;

    // Running dust
    if (this.onGround && Math.abs(this.pvx) > 0.5 && this.frame % 6 === 0) {
      this.particles.push({
        x: this.px + this.pw / 2, y: this.py + this.ph - 1,
        vx: -this.facing * (0.5 + Math.random()), vy: -0.3 - Math.random() * 0.5,
        life: 14, color: "#ffffff88",
      });
    }

    // Particles
    for (const p of this.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private resolveAxis(horizontal: boolean) {
    const pb: Rect = { x: this.px, y: this.py, w: this.pw, h: this.ph };
    for (const w of this.walls) {
      if (!overlap(pb, w)) continue;
      if (horizontal) {
        if (this.pvx > 0) this.px = w.x - this.pw;
        else if (this.pvx < 0) this.px = w.x + w.w;
        this.pvx = 0;
        pb.x = this.px;
      } else {
        if (this.pvy > 0) {
          this.py = w.y - this.ph;
          this.onGround = true;
          this.coyote = 8;
          this.jumpsLeft = 1; // Doppelsprung ist immer aktiv (Bodensprung + 1 Luftsprung)
        } else if (this.pvy < 0) {
          this.py = w.y + w.h;
        }
        this.pvy = 0;
        pb.y = this.py;
      }
    }
  }

  private hurt() {
    if (this.hasShield) {
      this.hasShield = false;
      this.iframes = IFRAMES;
      this.shake = 8;
      this.spawnParticles(this.px + this.pw / 2, this.py + this.ph / 2, 16, "#88ccff");
      return;
    }
    this.lives--;
    this.iframes = IFRAMES;
    this.shake = 14;
    this.combo = 0;
    this.audio.hit();
    this.spawnParticles(this.px + this.pw / 2, this.py + this.ph / 2, 16, "#ff4444");
    this.pvy = -5;
    if (this.lives <= 0) this.finish(false);
  }

  private finish(won: boolean) {
    if (this.done) return;
    this.done = true;
    if (won) this.audio.win(); else this.audio.gameOver();
    this.stop();
    setTimeout(() => this.opts.onExit({ won, coins: this.coinsCollected + (won ? 50 : 0) }), 700);
  }

  private spawnParticles(x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 20 + Math.random() * 20, color });
    }
  }

  // --- Render ---------------------------------------------------------------
  private render() {
    const g = this.ctx;
    // Scale to fit
    const cw = this.canvas.width, ch = this.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.colors.bg;
    g.fillRect(0, 0, cw, ch);
    const scale = Math.min(Math.floor(cw / VW), Math.floor(ch / VH)) || 1;
    const ox = Math.floor((cw - VW * scale) / 2);
    const oy = Math.floor((ch - VH * scale) / 2);
    g.setTransform(scale, 0, 0, scale, ox, oy);

    // Sky/parallax stripes
    g.fillStyle = this.colors.bg;
    g.fillRect(0, 0, VW, VH);
    // Distant windows/decor
    g.fillStyle = this.colors.wallDark;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 42 - this.cam.x * 0.3) % (VW + 42)) - 20;
      g.fillRect(Math.floor(x), 30, 20, 24);
      g.fillStyle = "#e8f2ff";
      g.fillRect(Math.floor(x) + 2, 32, 16, 20);
      g.fillStyle = this.colors.wallDark;
    }

    const shakeX = this.shake > 0.5 ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = this.shake > 0.5 ? (Math.random() - 0.5) * this.shake : 0;
    g.translate(-Math.floor(this.cam.x) + shakeX, -Math.floor(this.cam.y) + shakeY);

    // Ground / walls
    for (const w of this.walls) {
      g.fillStyle = this.colors.wallDark;
      g.fillRect(w.x, w.y, w.w, w.h);
      g.fillStyle = this.colors.wall;
      g.fillRect(w.x, w.y, w.w, Math.max(2, w.h - 2));
      // pixel top highlight
      g.fillStyle = this.colors.plat;
      g.fillRect(w.x, w.y, w.w, 1);
    }

    // Spikes
    g.fillStyle = "#ddd";
    for (const s of this.spikes) {
      const n = Math.max(1, Math.floor(s.w / 4));
      for (let i = 0; i < n; i++) {
        const x = s.x + i * (s.w / n);
        g.beginPath();
        g.moveTo(x, s.y + s.h);
        g.lineTo(x + s.w / n / 2, s.y);
        g.lineTo(x + s.w / n, s.y + s.h);
        g.closePath();
        g.fill();
      }
    }

    // Lasers
    for (const l of this.lasers) {
      g.fillStyle = "#333";
      g.fillRect(l.x, l.y, TILE, 6);
      if (this.frame % 120 < 60) {
        g.fillStyle = "#ff3040";
        g.fillRect(l.x, l.y + 7, TILE, 3);
        g.fillStyle = "#ffb0b0";
        g.fillRect(l.x, l.y + 8, TILE, 1);
      }
    }

    // Coins
    for (const c of this.coins) {
      if (c.taken) continue;
      const bob = Math.sin(c.wobble) * 1.5;
      this.drawCoin(c.x, c.y + bob);
    }

    // Enemies (teachers)
    for (const e of this.enemies) this.drawTeacher(e);

    // Exit
    this.drawExit(this.exit);

    // Player
    const flicker = this.iframes > 0 && this.frame % 6 < 3;
    if (!flicker) this.drawPlayer();

    // Particles
    for (const p of this.particles) {
      g.fillStyle = p.color;
      g.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
    }

    // HUD
    g.setTransform(scale, 0, 0, scale, ox, oy);
    this.drawHUD();
  }

  private drawCoin(x: number, y: number) {
    const g = this.ctx;
    g.fillStyle = "#8a5c00"; g.fillRect(x + 1, y + 7, 6, 1);
    g.fillStyle = "#c98400"; g.fillRect(x + 1, y + 1, 6, 6);
    g.fillStyle = "#f5b300"; g.fillRect(x + 2, y + 1, 4, 6);
    g.fillStyle = "#ffe066"; g.fillRect(x + 3, y + 2, 1, 4);
    g.fillStyle = "#ffcf3a"; g.fillRect(x + 2, y + 0, 4, 1);
  }

  private drawPlayer() {
    const g = this.ctx;
    const x = Math.floor(this.px), y = Math.floor(this.py);
    // Anim: subtle bob when running
    const bob = this.state === "run" ? Math.floor(Math.sin(this.animT) * 1) : 0;
    // Legs
    g.fillStyle = "#2a4b8a";
    g.fillRect(x + 1, y + 10, 3, 4);
    g.fillRect(x + 6, y + 10, 3, 4);
    if (this.state === "run") {
      const swing = Math.floor(Math.sin(this.animT) * 2);
      g.fillRect(x + 1 - swing, y + 10, 3, 4);
      g.fillRect(x + 6 + swing, y + 10, 3, 4);
    } else if (this.state === "jump" || this.state === "fall") {
      g.fillRect(x + 1, y + 9, 3, 3);
      g.fillRect(x + 6, y + 11, 3, 3);
    }
    // Shirt (grün)
    g.fillStyle = "#3aa04a";
    g.fillRect(x, y + 5 + bob, 10, 6);
    g.fillStyle = "#5bc26b";
    g.fillRect(x, y + 5 + bob, 10, 1);
    // Head + Haare (braun)
    g.fillStyle = "#f2c69a"; // skin
    g.fillRect(x + 2, y + 1 + bob, 6, 5);
    g.fillStyle = "#5c3a1e"; // Haar
    g.fillRect(x + 1, y + bob, 8, 2);
    g.fillRect(x + 1, y + 1 + bob, 2, 2);
    g.fillRect(x + 7, y + 1 + bob, 2, 2);
    // Augen (Blickrichtung)
    g.fillStyle = "#111";
    const ex = this.facing > 0 ? 6 : 3;
    g.fillRect(x + ex, y + 3 + bob, 1, 1);
    g.fillRect(x + ex - 3, y + 3 + bob, 1, 1);
    // Shield-Aura
    if (this.hasShield) {
      g.strokeStyle = "#88ccff";
      g.strokeRect(x - 2, y - 2 + bob, 14, 16);
    }
  }

  private drawTeacher(e: Enemy) {
    const g = this.ctx;
    const x = Math.floor(e.x), y = Math.floor(e.y);
    // Anzug dunkelgrau
    g.fillStyle = "#333"; g.fillRect(x, y + 4, 12, 10);
    g.fillStyle = "#555"; g.fillRect(x, y + 4, 12, 1);
    // Kragen weiß
    g.fillStyle = "#eee"; g.fillRect(x + 4, y + 5, 4, 2);
    // Kopf
    g.fillStyle = "#eac2a0"; g.fillRect(x + 3, y, 6, 5);
    // Brille
    g.fillStyle = "#111";
    g.fillRect(x + 3, y + 2, 2, 2);
    g.fillRect(x + 7, y + 2, 2, 2);
    g.fillRect(x + 5, y + 3, 2, 1);
    // Angry look when chasing
    if (e.state === "chase") {
      g.fillStyle = "#f22";
      g.fillRect(x + 4, y + 1, 4, 1);
    }
  }

  private drawExit(ex: Exit) {
    const g = this.ctx;
    // Türrahmen dunkel + Tür braun + Griff gold
    g.fillStyle = "#3a2410"; g.fillRect(ex.x - 1, ex.y - 1, ex.w + 2, ex.h + 2);
    g.fillStyle = "#7a4a20"; g.fillRect(ex.x, ex.y, ex.w, ex.h);
    g.fillStyle = "#a86a30"; g.fillRect(ex.x + 1, ex.y + 1, ex.w - 2, 2);
    g.fillStyle = "#f5b300"; g.fillRect(ex.x + ex.w - 3, ex.y + ex.h / 2, 1, 2);
    // EXIT-Schild
    g.fillStyle = "#3aa04a"; g.fillRect(ex.x - 2, ex.y - 6, ex.w + 4, 5);
    g.fillStyle = "#fff";
    g.font = "6px 'Press Start 2P', monospace";
    g.textBaseline = "top";
    g.fillText("EXIT", ex.x - 1, ex.y - 5);
  }

  private drawHUD() {
    const g = this.ctx;
    // Herzen
    for (let i = 0; i < this.lives; i++) this.drawHeart(4 + i * 12, 4);
    if (this.hasShield) this.drawHeart(4 + this.lives * 12, 4, "#88ccff");
    // Coins
    this.drawCoin(VW - 60, 4);
    g.fillStyle = "#fff";
    g.font = "10px 'Press Start 2P', monospace";
    g.textBaseline = "top";
    g.fillText(String(this.coinsCollected).padStart(3, "0"), VW - 46, 6);
    // Level
    g.fillStyle = "#fff";
    g.font = "6px 'Press Start 2P', monospace";
    g.fillText(("LVL " + this.opts.level + " · " + this.level.name).toUpperCase(), 4, VH - 10);
    // Combo
    if (this.lastComboTimer > 0) {
      g.fillStyle = "#ffe066";
      g.font = "10px 'Press Start 2P', monospace";
      g.textAlign = "center";
      g.fillText(this.lastComboText, VW / 2, 20);
      g.textAlign = "left";
    }
  }

  private drawHeart(x: number, y: number, color = "#e63946") {
    const g = this.ctx;
    g.fillStyle = color;
    g.fillRect(x + 1, y, 2, 1); g.fillRect(x + 5, y, 2, 1);
    g.fillRect(x, y + 1, 8, 2);
    g.fillRect(x + 1, y + 3, 6, 1);
    g.fillRect(x + 2, y + 4, 4, 1);
    g.fillRect(x + 3, y + 5, 2, 1);
    g.fillStyle = "#ffb7b7";
    g.fillRect(x + 1, y + 1, 2, 1);
  }
}
