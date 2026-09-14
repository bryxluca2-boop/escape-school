// Level-Definitionen und Generator für SchoolLife.
// Tiles:
//   ' ' leer   '#' Wand/Boden   '=' Plattform   '^' Spike/Falle
//   'C' GoldCoin   'P' Spawn   'E' Ausgang   'T' Lehrer-Spawn
//   'L' Laser (deko + tödlich)   'M' bewegliche Plattform
//
// Hand-designte Levels 1..5. Danach prozeduraler Generator bis Level 30.

export type Tile = string;
export interface LevelData {
  width: number;
  height: number;
  rows: string[];        // je Zeile ein String (oben nach unten)
  theme: "classroom" | "hallway" | "gym" | "cafeteria" | "basement" | "roof" | "library";
  name: string;
}

const H = 12;

function pad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return s + " ".repeat(w - s.length);
}

function make(rows: string[], theme: LevelData["theme"], name: string): LevelData {
  const width = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => pad(r, width));
  return { width, height: padded.length, rows: padded, theme, name };
}

// ---- Hand-Levels ----------------------------------------------------------

const LVL1 = make([
  "                                                                        ",
  "                                                                        ",
  "                                                                        ",
  "                     C C C                       C  C                   ",
  "                  ================         =============    E           ",
  "                                                                        ",
  "         C C                                                            ",
  "     =========          T                     C  C  C                   ",
  "                                            =========                   ",
  "  P                                                                     ",
  "########################################################################",
  "########################################################################",
], "classroom", "Klassenzimmer 1A");

const LVL2 = make([
  "                                                                                    ",
  "                                                                                    ",
  "                                                                                    ",
  "                   C C                                                              ",
  "               ============      C   C                                              ",
  "                                =========          C C C                            ",
  "        C   C                              T   ==============       E               ",
  "     ==========         ^^^                                                         ",
  "  P                                                                                 ",
  "###############   ####################### ### ######################################",
  "                                                                                    ",
  "####################################################################################",
], "hallway", "Der Flur");

const LVL3 = make([
  "                                                                                            ",
  "                                                                                            ",
  "                    C C                                                                     ",
  "                =========                       C   C   C                                   ",
  "                                            ==================                              ",
  "         C                                                            L                     ",
  "     =======                 T                                                  E           ",
  "                       ^^^^^          T                                                     ",
  "  P                                                                                         ",
  "############   ######################### ### ############ ### ################## ###########",
  "                                                                                            ",
  "############################################################################################",
], "gym", "Sporthalle");

const LVL4 = make([
  "                                                                                                    ",
  "                                                                                                    ",
  "        C   C                                                                                       ",
  "     ==========                          C C C                                                      ",
  "                                     ============           M M M                                   ",
  "  C            T                                                                                    ",
  "==========                    ^^^^                    C C C                                         ",
  "                                                  ===========          T                     E      ",
  "  P                                                                                                 ",
  "#########   ################## ### ########################## ### ######################## ### #####",
  "                                                                                                    ",
  "####################################################################################################",
], "cafeteria", "Cafeteria");

const LVL5 = make([
  "                                                                                                              ",
  "                                                                                                              ",
  "     C C                    C                             C   C   C                                           ",
  " ==========           ============                     ==============                                         ",
  "                                              L                                    L                          ",
  "         T                                                                                                    ",
  "  C C                                    T                                                                   E",
  "======                    ^^^^^^                            ^^^^^                                             ",
  "                    M M                       M M                                                             ",
  "  P                                                                                                           ",
  "########   ############ ### ################ ### ######################## ### ##############################",
  "                                                                                                              ",
  "##############################################################################################################",
], "basement", "Keller");


const HAND: LevelData[] = [LVL1, LVL2, LVL3, LVL4, LVL5];

// ---- Generator ------------------------------------------------------------

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const THEMES: LevelData["theme"][] = ["classroom", "hallway", "gym", "cafeteria", "basement", "roof", "library"];
const NAMES = ["Bibliothek", "Dach", "Chemie-Labor", "Musikraum", "Hausmeisterkammer", "Turnhalle 2", "Direktorat", "Kunstraum", "Physik-Saal", "Aula"];

function generate(level: number): LevelData {
  const rng = seededRandom(0x51001 + level * 7919);
  const width = 80 + level * 4;
  const rows: string[] = Array.from({ length: H }, () => "");
  const ground = " ".repeat(1) + "P" + " ".repeat(width - 2);
  const groundLine = "#".repeat(width);

  // Build empty air rows
  for (let r = 0; r < H - 2; r++) rows[r] = " ".repeat(width);
  rows[H - 3] = ground;
  rows[H - 2] = groundLine;
  rows[H - 1] = groundLine;

  const setChar = (r: number, c: number, ch: string) => {
    if (c < 0 || c >= width || r < 0 || r >= H) return;
    rows[r] = rows[r].substring(0, c) + ch + rows[r].substring(c + 1);
  };

  // Punch gaps in floor and add platforms/hazards/coins
  let x = 8;
  while (x < width - 8) {
    const roll = rng();
    if (roll < 0.35) {
      // gap (max 3 tiles = sicher springbar)
      const w = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < w; i++) { setChar(H - 2, x + i, " "); setChar(H - 1, x + i, " "); }
      x += w + 3 + Math.floor(rng() * 3);
    } else if (roll < 0.6) {
      // platform + coins (Höhe 6..7 = erreichbar)
      const py = 6 + Math.floor(rng() * 2);
      const pw = 4 + Math.floor(rng() * 5);
      for (let i = 0; i < pw; i++) setChar(py, x + i, "=");
      for (let i = 0; i < pw; i += 2) setChar(py - 1, x + i, "C");
      x += pw + 2 + Math.floor(rng() * 4);

    } else if (roll < 0.78) {
      // spike trap on ground
      const sw = 1 + Math.floor(rng() * Math.min(3, 1 + level / 8));
      for (let i = 0; i < sw; i++) setChar(H - 3, x + i, "^");
      x += sw + 3;
    } else if (roll < 0.92) {
      // teacher patrol
      setChar(H - 3, x, "T");
      x += 6;
    } else {
      // laser (falls schwer genug)
      if (level >= 8) setChar(H - 5, x, "L");
      x += 4;
    }
  }

  // Exit
  setChar(H - 3, width - 2, "E");

  const theme = THEMES[level % THEMES.length];
  const name = NAMES[level % NAMES.length] + " " + level;
  return { width, height: H, rows, theme, name };
}

export function getLevel(index: number): LevelData {
  // 1-basiert
  if (index < 1) index = 1;
  if (index <= HAND.length) return HAND[index - 1];
  return generate(index);
}

export const TOTAL_LEVELS = 30;
