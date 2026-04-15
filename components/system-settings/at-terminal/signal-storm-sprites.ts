// ─── Signal Storm sprite atlas ────────────────────────────────────────────────
// All pixel art definitions and pre-rendering logic.
// 0=transparent, 1=primary, 2=dark(0.55 opacity), 3=highlight(white overlay)

import type { GamePalette, SpriteAtlas } from "./signal-storm-types";

export const PIXEL_SCALE = 2; // Each sprite pixel = 2×2 canvas pixels

// ─── Size constants ───────────────────────────────────────────────────────────

export const SWERVER_W = 20;
export const SWERVER_H = 20;

// ─── Sprite definitions ───────────────────────────────────────────────────────

// Player ship — 12×14 → 24×28 rendered
// Detailed fighter: tipped nose, glowing canopy, wing shading, twin intakes, twin thrusters
export const SPRITE_PLAYER: number[][] = [
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,3,3,1,0,0,0,0],
  [0,0,0,1,1,3,3,1,1,0,0,0],
  [0,0,0,1,2,1,1,2,1,0,0,0],
  [0,0,1,1,3,1,1,3,1,1,0,0],
  [0,1,1,2,1,3,3,1,2,1,1,0],
  [1,1,2,1,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,3,3,1,1,1,1,1],
  [1,0,1,1,2,1,1,2,1,1,0,1],
  [1,0,0,1,1,3,3,1,1,0,0,1],
  [0,0,0,1,1,0,0,1,1,0,0,0],
  [0,0,0,0,1,0,0,1,0,0,0,0],
  [0,0,0,0,1,0,0,1,0,0,0,0],
  [0,0,0,0,3,0,0,3,0,0,0,0],
];

// Meteor / interference enemy — 10×8 → 20×16 rendered
// Cratered rocky asteroid with scatter highlights and edge shadow
export const SPRITE_METEOR: number[][] = [
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,3,1,2,3,1,1,0],
  [0,1,2,1,3,1,1,2,1,1],
  [1,2,1,1,1,3,2,1,3,1],
  [1,1,3,1,2,1,1,3,1,1],
  [1,2,1,2,1,1,2,1,1,0],
  [0,1,1,3,1,2,1,2,0,0],
  [0,0,1,1,1,1,0,0,0,0],
];

// Jammer / alien ship — 14×10 → 28×20 rendered
// Twin-eye cockpit, shaded wing ridges, weapon pylons, exhaust plumes
export const SPRITE_JAMMER: number[][] = [
  [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,3,1,1,3,1,0,0,0,0],
  [0,0,0,1,1,3,2,2,3,1,1,0,0,0],
  [0,0,1,1,2,1,1,1,1,2,1,1,0,0],
  [0,1,1,2,1,3,1,1,3,1,2,1,1,0],
  [1,1,2,1,1,1,3,3,1,1,1,2,1,1],
  [1,2,1,1,2,1,1,1,1,2,1,1,2,1],
  [1,0,1,1,1,2,0,0,2,1,1,1,0,1],
  [0,0,0,0,1,0,0,0,0,1,0,0,0,0],
  [0,0,0,0,0,3,0,0,3,0,0,0,0,0],
];

// Swerver enemy — 10×10 → 20×20 rendered
// A diamond/dart shape that looks agile and evasive
export const SPRITE_SWERVER: number[][] = [
  [0,0,0,0,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,3,3,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,0],
  [1,1,2,1,1,1,1,2,1,1],
  [1,1,2,1,1,1,1,2,1,1],
  [0,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,0,0,1,1,0,0],
  [0,0,0,1,0,0,1,0,0,0],
  [0,0,0,0,1,1,0,0,0,0],
];

// Splitter enemy — 12×10 → 24×20 rendered
export const SPRITE_SPLITTER: number[][] = [
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,2,2,1,1,1,0,0],
  [0,1,1,2,1,1,1,1,2,1,1,0],
  [1,1,1,1,1,3,3,1,1,1,1,1],
  [1,1,2,1,1,1,1,1,1,2,1,1],
  [1,1,1,2,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,3,3,1,1,1,1,1],
  [0,1,1,2,1,1,1,1,2,1,1,0],
  [0,0,1,1,1,2,2,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
];

// Sniper enemy — 14×12 → 28×24 rendered
export const SPRITE_SNIPER: number[][] = [
  [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,2,1,1,1,1,2,1,1,0,0],
  [0,1,1,1,1,1,3,3,1,1,1,1,1,0],
  [0,1,1,2,1,1,1,1,1,1,2,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,2,1,1,1,1,2,1,1,1,0],
  [0,0,1,1,1,1,2,2,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
];

// Orbiter enemy — 12×10 → 24×20 rendered
export const SPRITE_ORBITER: number[][] = [
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,3,3,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,2,1,1,1,1,2,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,1,1,2,1,1],
  [1,0,1,1,1,1,1,1,1,1,0,1],
  [1,0,0,1,1,0,0,1,1,0,0,1],
  [0,0,0,0,1,0,0,1,0,0,0,0],
  [0,0,0,0,3,0,0,3,0,0,0,0],
];

// Drone enemy — 8×8 → 16×16 rendered
export const SPRITE_DRONE: number[][] = [
  [0,0,1,1,1,1,0,0],
  [0,1,1,3,3,1,1,0],
  [1,1,3,1,1,3,1,1],
  [1,1,1,1,1,1,1,1],
  [1,1,2,1,1,2,1,1],
  [1,1,1,2,2,1,1,1],
  [0,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,0,0],
];

// Heart — 9×8 → 18×16 rendered
export const SPRITE_HEART: number[][] = [
  [0,1,1,0,0,1,1,0,0],
  [1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,0,0,0],
  [0,0,0,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0],
];

// Rapid-fire power-up icon — 7×7 → 14×14 rendered (lightning bolt)
export const SPRITE_PU_RAPID: number[][] = [
  [0,0,0,1,1,0,0],
  [0,0,1,1,0,0,0],
  [0,1,1,1,1,0,0],
  [0,0,0,1,1,0,0],
  [0,0,1,1,0,0,0],
  [0,1,1,0,0,0,0],
  [0,0,0,0,0,0,0],
];

// Shield power-up icon — 7×7 → 14×14 rendered (shield/diamond)
export const SPRITE_PU_SHIELD: number[][] = [
  [0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0],
  [0,1,1,3,1,1,0],
  [0,1,1,1,1,1,0],
  [0,0,1,1,1,0,0],
  [0,0,0,1,0,0,0],
  [0,0,0,0,0,0,0],
];

// Spread-shot power-up icon — 7×7 → 14×14 rendered (triple arrows up)
export const SPRITE_PU_SPREAD: number[][] = [
  [0,1,0,1,0,1,0],
  [1,1,0,1,0,1,1],
  [0,0,0,1,0,0,0],
  [0,1,0,1,0,1,0],
  [1,1,0,1,0,1,1],
  [0,0,0,1,0,0,0],
  [0,0,0,0,0,0,0],
];

// Player engine flame animation — 2 frames, 4×3 → 8×6 rendered
export const SPRITE_ENGINE_FLAME: number[][][] = [
  [
    [0,1,1,0],
    [0,3,3,0],
    [0,0,0,0],
  ],
  [
    [0,3,3,0],
    [0,1,1,0],
    [1,3,3,1],
  ],
];

// Boss 1 — Signal Disruptor: 20×12 → 40×24. Amber jammer color.
// A wide dish-shaped cruiser with a central cannon and flanking antenna pods.
export const SPRITE_BOSS1: number[][] = [
  [0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,3,3,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,2,1,1,1,1,1,1,1,1,2,1,1,0,0,0],
  [0,0,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1],
  [1,0,0,1,1,1,1,0,0,1,1,0,0,1,1,1,1,0,0,1],
  [0,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0],
];

// Boss 2 — Frequency Jammer: 18×14 → 36×28. Red enemy color.
// Aggressive wedge ship with swept wings and multi-barrel nose.
export const SPRITE_BOSS2: number[][] = [
  [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,3,3,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,2,1,1,1,1,1,2,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,2,1,1,1,1,2,1,1,1,2,1],
  [1,0,0,1,1,1,0,0,1,1,1,1,0,0,1,1,0,1],
  [0,0,0,0,1,1,0,0,1,1,1,1,0,0,1,1,0,0],
  [0,0,0,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0],
];

// Boss 3 — Band Blocker: 24×10 → 48×20. Purple powerUp color.
// Ultra-wide blockade station with heavy armor and multiple emitter ports.
export const SPRITE_BOSS3: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,3,1,1,3,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,1,1,0],
  [1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1],
  [1,1,2,1,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,1,1,2,1],
  [1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1],
  [0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0],
];

// Boss 4 — Network Nullifier: 16×14 → 32×28. Orange spread color.
// Fast angular interceptor with a sharp nose and precision targeting array.
export const SPRITE_BOSS4: number[][] = [
  [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,3,3,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,2,1,1,1,1,1,1,2,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,2,1,1,1,1,1,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,2,1,1,1,1,2,1,1,2,1,1],
  [1,0,0,1,0,0,1,1,1,1,0,0,1,0,0,1],
  [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0],
];

// Boss 5 — Core Corruptor: 22×16 → 44×32. Red enemy color, complex multi-part.
// The ultimate threat: a massive capital ship with a rotating core and heavy weapons.
export const SPRITE_BOSS5: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,1,3,3,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,3,1,1,3,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,2,1,1,1,1,1,1,1,1,2,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,2,1,1,1,1,2,1,1,1,1,1,1,0,0],
  [0,1,1,2,1,1,1,1,1,1,3,3,1,1,1,1,1,1,2,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,2,1,1,1,1,1,1,1,1,1,2,1,1,1,2,1],
  [1,1,1,1,1,0,0,1,1,1,2,2,1,1,1,0,0,1,1,1,1,1],
  [1,0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1,0,0,1],
  [0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,3,0,0,0,0,3,0,0,0,0,0,0,0,0],
];

// ─── Pre-rendering helpers ────────────────────────────────────────────────────

export function preRenderSprite(
  pixels: number[][],
  primaryColor: string,
  scale: number,
): OffscreenCanvas {
  const h = pixels.length;
  const w = pixels[0].length;
  const canvas = new OffscreenCanvas(w * scale, h * scale);
  const ctx = canvas.getContext("2d")!;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const val = pixels[row][col];
      if (val === 0) continue;

      if (val === 1) {
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = 1;
      } else if (val === 2) {
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = 0.55;
      } else if (val === 3) {
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.45;
      }

      ctx.fillRect(col * scale, row * scale, scale, scale);
    }
  }
  ctx.globalAlpha = 1;
  return canvas;
}

/** Pre-render all sprites in one pass and return a complete atlas. */
export function preRenderAllSprites(palette: GamePalette): SpriteAtlas {
  const s = PIXEL_SCALE;
  return {
    player:     preRenderSprite(SPRITE_PLAYER,      palette.player,  s),
    meteor:     preRenderSprite(SPRITE_METEOR,      palette.enemy,   s),
    jammer:     preRenderSprite(SPRITE_JAMMER,      palette.jammer,  s),
    swerver:    preRenderSprite(SPRITE_SWERVER,     palette.shield,  s),
    splitter:   preRenderSprite(SPRITE_SPLITTER,    palette.enemy,   s),
    sniper:     preRenderSprite(SPRITE_SNIPER,      palette.jammer,  s),
    orbiter:    preRenderSprite(SPRITE_ORBITER,     palette.shield,  s),
    drone:      preRenderSprite(SPRITE_DRONE,       palette.spread,  s),
    puRapid:    preRenderSprite(SPRITE_PU_RAPID,    palette.powerUp, s),
    puShield:   preRenderSprite(SPRITE_PU_SHIELD,   palette.shield,  s),
    puSpread:   preRenderSprite(SPRITE_PU_SPREAD,   palette.spread,  s),
    flames:     SPRITE_ENGINE_FLAME.map((frame) =>
                  preRenderSprite(frame, palette.spread, s)),
    heartFull:  preRenderSprite(SPRITE_HEART,       palette.enemy,   s),
    heartEmpty: preRenderSprite(SPRITE_HEART,       palette.textMuted, s),
    boss1:      preRenderSprite(SPRITE_BOSS1,       palette.jammer,  s),
    boss2:      preRenderSprite(SPRITE_BOSS2,       palette.enemy,   s),
    boss3:      preRenderSprite(SPRITE_BOSS3,       palette.powerUp, s),
    boss4:      preRenderSprite(SPRITE_BOSS4,       palette.spread,  s),
    boss5:      preRenderSprite(SPRITE_BOSS5,       palette.enemy,   s),
    boss1White: preRenderSprite(SPRITE_BOSS1,       "#ffffff",       s),
    boss2White: preRenderSprite(SPRITE_BOSS2,       "#ffffff",       s),
    boss3White: preRenderSprite(SPRITE_BOSS3,       "#ffffff",       s),
    boss4White: preRenderSprite(SPRITE_BOSS4,       "#ffffff",       s),
    boss5White: preRenderSprite(SPRITE_BOSS5,       "#ffffff",       s),
  };
}
