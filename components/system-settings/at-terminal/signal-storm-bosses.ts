// ─── Signal Storm boss system ─────────────────────────────────────────────────
// 3-phase bosses with telegraphs, intro banners, and per-tier attack patterns.

import type {
  Boss,
  GamePalette,
  SpriteAtlas,
} from "./signal-storm-types";

// ─── Constants ───────────────────────────────────────────────────────────────

export const BOSS_ENTER_Y = 60;
export const BOSS_WAVE_INTERVAL = 5;
export const SCORE_BOSS = 100;

const BOSS_NAMES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "SIGNAL DISRUPTOR",
  2: "FREQUENCY JAMMER",
  3: "BAND BLOCKER",
  4: "NETWORK NULLIFIER",
  5: "CORE CORRUPTOR",
};

const BOSS_SUBTITLES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Disrupting your connection",
  2: "Jamming all frequencies",
  3: "Blocking every band",
  4: "Nullifying your network",
  5: "Corrupting the core",
};

// ─── Result types ────────────────────────────────────────────────────────────

export interface BossUpdateResult {
  beamsToFire: Array<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    width?: number;
    height?: number;
  }>;
  shakeEvents: Array<{ magnitude: number; duration: number }>;
}

export interface BossPhaseTransitionEvent {
  newPhase: 2 | 3;
  shakeMagnitude: number;
  shakeDuration: number;
}

// ─── Intro banner timeline ───────────────────────────────────────────────────

const BANNER_SLIDE_IN = 400;
const BANNER_HOLD = 1400;
const BANNER_SLIDE_OUT = 400;
const BANNER_TOTAL = BANNER_SLIDE_IN + BANNER_HOLD + BANNER_SLIDE_OUT; // 2200ms

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

// ─── Spawn ───────────────────────────────────────────────────────────────────

export function spawnBoss(
  tier: 1 | 2 | 3 | 4 | 5,
  wave: number,
  canvasWidth: number,
  timestamp: number,
): Boss {
  const cycleNumber = Math.floor((wave - 1) / 25);
  const baseHp = [0, 8, 12, 14, 10, 18][tier];
  const hp = baseHp + cycleNumber * 6;

  const widths = [0, 40, 36, 48, 32, 44];
  const heights = [0, 24, 28, 20, 28, 32];
  const w = widths[tier];
  const h = heights[tier];

  return {
    x: canvasWidth / 2 - w / 2,
    y: -h,
    width: w,
    height: h,
    active: true,
    hp,
    maxHp: hp,
    tier,
    entered: false,
    moveTimer: 0,
    shootTimer: 0,
    patternPhase: 0,
    targetX: canvasWidth / 2 - w / 2,
    dx: 0,
    name: BOSS_NAMES[tier],
    phase: 1,
    phaseJustChanged: false,
    phaseFreezeUntil: 0,
    amplitude: 0,
    period: 0,
    telegraphUntil: 0,
    telegraphOrigin: null,
    telegraphType: "dot",
    telegraphAimX: 0,
    flashUntil: 0,
    introBanner: {
      phase: 1,
      startTime: timestamp,
      name: BOSS_NAMES[tier],
      subtitle: BOSS_SUBTITLES[tier],
    },
  };
}

// ─── Phase transitions ───────────────────────────────────────────────────────

export function checkPhaseTransition(
  boss: Boss,
  timestamp: number,
): BossPhaseTransitionEvent | null {
  const ratio = boss.hp / boss.maxHp;

  if (boss.phase === 1 && ratio <= 0.66) {
    boss.phase = 2;
    boss.phaseJustChanged = true;
    boss.phaseFreezeUntil = timestamp + 400;
    boss.flashUntil = timestamp + 200;
    boss.shootTimer = 0;
    return { newPhase: 2, shakeMagnitude: 4, shakeDuration: 250 };
  }

  if (boss.phase === 2 && ratio <= 0.33) {
    boss.phase = 3;
    boss.phaseJustChanged = true;
    boss.phaseFreezeUntil = timestamp + 400;
    boss.flashUntil = timestamp + 200;
    boss.shootTimer = 0;
    return { newPhase: 3, shakeMagnitude: 4, shakeDuration: 250 };
  }

  return null;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export function updateBoss(
  boss: Boss,
  dt: number,
  timestamp: number,
  player: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
): BossUpdateResult {
  const result: BossUpdateResult = { beamsToFire: [], shakeEvents: [] };

  // 1. Update intro banner animation
  if (boss.introBanner) {
    const elapsed = timestamp - boss.introBanner.startTime;
    if (elapsed >= BANNER_TOTAL) {
      boss.introBanner = null;
      boss.entered = true;
    }
  }

  // 2. Entry descent
  if (!boss.entered) {
    boss.y += 80 * dt;
    if (boss.y >= BOSS_ENTER_Y) {
      boss.y = BOSS_ENTER_Y;
      // Don't set entered yet — wait for banner to finish
      if (!boss.introBanner) {
        boss.entered = true;
      }
    }
    return result;
  }

  // 3. Phase freeze
  if (timestamp < boss.phaseFreezeUntil) {
    return result;
  }

  // 4. Clear phaseJustChanged
  boss.phaseJustChanged = false;

  // 5. Dispatch to per-tier update
  switch (boss.tier) {
    case 1:
      updateTier1(boss, dt, timestamp, player, canvasWidth, result);
      break;
    case 2:
      updateTier2(boss, dt, timestamp, player, canvasWidth, result);
      break;
    case 3:
      updateTier3(boss, dt, timestamp, player, canvasWidth, canvasHeight, result);
      break;
    case 4:
      updateTier4(boss, dt, timestamp, player, canvasWidth, result);
      break;
    case 5:
      updateTier5(boss, dt, timestamp, player, canvasWidth, canvasHeight, result);
      break;
  }

  // Clamp x to canvas
  boss.x = Math.max(0, Math.min(boss.x, canvasWidth - boss.width));

  return result;
}

// ─── Per-tier update functions ────────────────────────────────────────────────

// Helper: emit a beam from boss center-bottom
function beamFromBoss(
  boss: Boss,
  dx: number,
  dy: number,
  width?: number,
  height?: number,
): BossUpdateResult["beamsToFire"][0] {
  return {
    x: boss.x + boss.width / 2,
    y: boss.y + boss.height,
    dx,
    dy,
    width,
    height,
  };
}

function setTelegraph(
  boss: Boss,
  timestamp: number,
  durationMs: number,
  type: "dot" | "line" | "ring",
  aimX?: number,
): void {
  boss.telegraphUntil = timestamp + durationMs;
  boss.telegraphOrigin = {
    x: boss.x + boss.width / 2,
    y: boss.y + boss.height,
  };
  boss.telegraphType = type;
  if (aimX !== undefined) {
    boss.telegraphAimX = aimX;
  }
}

// ── T1 — Signal Disruptor ───────────────────────────────────────────────────

function updateTier1(
  boss: Boss,
  dt: number,
  timestamp: number,
  player: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  result: BossUpdateResult,
): void {
  const centerX = canvasWidth / 2 - boss.width / 2;
  boss.moveTimer += dt;

  if (boss.phase === 1) {
    // Sine sweep. Period=8s, peak velocity=50 px/s
    const period = 8;
    const amplitude = 50 / (2 * Math.PI / period); // ~63.66
    boss.x = centerX + Math.sin(boss.moveTimer * (2 * Math.PI / period)) * amplitude;

    // Fire 1 straight beam every 2.5s with 300ms telegraph dot
    boss.shootTimer += dt;
    if (boss.shootTimer >= 2.5) {
      boss.shootTimer = 0;
      setTelegraph(boss, timestamp, 300, "dot");
      result.beamsToFire.push(beamFromBoss(boss, 0, 120));
    }
  } else if (boss.phase === 2) {
    // Period=5s, peak velocity=90 px/s
    const period = 5;
    const amplitude = 90 / (2 * Math.PI / period); // ~71.62
    boss.x = centerX + Math.sin(boss.moveTimer * (2 * Math.PI / period)) * amplitude;

    // Fire 3-beam spread every 2.2s
    boss.shootTimer += dt;
    if (boss.shootTimer >= 2.2) {
      boss.shootTimer = 0;
      setTelegraph(boss, timestamp, 300, "dot");
      const speed = 130;
      result.beamsToFire.push(beamFromBoss(boss, 0, speed));
      result.beamsToFire.push(beamFromBoss(boss, Math.sin(-0.3) * speed, Math.cos(-0.3) * speed));
      result.beamsToFire.push(beamFromBoss(boss, Math.sin(0.3) * speed, Math.cos(0.3) * speed));
    }
  } else {
    // Phase 3: Hunt player at 110 px/s
    const playerCx = player.x + player.width / 2;
    const bossCx = boss.x + boss.width / 2;
    const diff = playerCx - bossCx;
    const maxStep = 110 * dt;
    if (Math.abs(diff) > maxStep) {
      boss.x += Math.sign(diff) * maxStep;
    } else {
      boss.x += diff;
    }

    // Fire 3-beam cone every 1.5s
    boss.shootTimer += dt;
    if (boss.shootTimer >= 1.5) {
      boss.shootTimer = 0;
      setTelegraph(boss, timestamp, 300, "dot");
      const speed = 140;
      result.beamsToFire.push(beamFromBoss(boss, 0, speed));
      result.beamsToFire.push(beamFromBoss(boss, Math.sin(-0.3) * speed, Math.cos(-0.3) * speed));
      result.beamsToFire.push(beamFromBoss(boss, Math.sin(0.3) * speed, Math.cos(0.3) * speed));
    }
  }
}

// ── T2 — Frequency Jammer ───────────────────────────────────────────────────

function updateTier2(
  boss: Boss,
  dt: number,
  timestamp: number,
  player: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  result: BossUpdateResult,
): void {
  boss.moveTimer += dt;

  const dashSpeed = boss.phase === 1 ? 80 : boss.phase === 2 ? 110 : 130;
  const diff = boss.targetX - boss.x;
  const step = dashSpeed * dt;
  let arrived = false;

  if (Math.abs(diff) <= step) {
    boss.x = boss.targetX;
    arrived = true;
  } else {
    boss.x += Math.sign(diff) * step;
  }

  // Phase 3: drop beams mid-dash every 0.3s while moving
  if (boss.phase === 3 && !arrived) {
    boss.shootTimer += dt;
    if (boss.shootTimer >= 0.3) {
      boss.shootTimer = 0;
      result.beamsToFire.push(beamFromBoss(boss, 0, 120));
    }
  }

  if (arrived) {
    // Pause briefly before picking a new target
    // patternPhase tracks if we've paused (0=moving, 1=pausing)
    if (boss.patternPhase === 0) {
      boss.patternPhase = 1;
      boss.shootTimer = 0;
    }

    const pauseTime = boss.phase === 2 ? 0.4 : 0.5;
    boss.shootTimer += dt;

    if (boss.shootTimer >= pauseTime) {
      // Fire on arrival
      if (boss.phase === 1) {
        setTelegraph(boss, timestamp, 300, "dot");
        const speed = 120;
        result.beamsToFire.push(beamFromBoss(boss, 0, speed));
        result.beamsToFire.push(beamFromBoss(boss, Math.sin(-0.3) * speed, Math.cos(-0.3) * speed));
        result.beamsToFire.push(beamFromBoss(boss, Math.sin(0.3) * speed, Math.cos(0.3) * speed));
      } else {
        // Phase 2 and 3: 5-beam fan
        setTelegraph(boss, timestamp, 300, "dot");
        const angles = [-0.5, -0.25, 0, 0.25, 0.5];
        const speed = 130;
        for (const a of angles) {
          result.beamsToFire.push(beamFromBoss(boss, Math.sin(a) * speed, Math.cos(a) * speed));
        }
      }

      // Phase 3: also fire fan on wall hit
      // Pick new target
      boss.targetX = Math.random() * (canvasWidth - boss.width);
      boss.patternPhase = 0;
      boss.shootTimer = 0;
    }
  }
}

// ── T3 — Band Blocker ───────────────────────────────────────────────────────

function updateTier3(
  boss: Boss,
  dt: number,
  timestamp: number,
  player: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  _canvasHeight: number,
  result: BossUpdateResult,
): void {
  // Horizontal bounce
  const speed = boss.phase === 1 ? 25 : 45;
  if (boss.dx === 0) boss.dx = speed;
  // Ensure dx magnitude matches current speed
  boss.dx = Math.sign(boss.dx) * speed;
  boss.x += boss.dx * dt;

  if (boss.x <= 0) {
    boss.x = 0;
    boss.dx = speed;
  } else if (boss.x + boss.width >= canvasWidth) {
    boss.x = canvasWidth - boss.width;
    boss.dx = -speed;
  }

  boss.shootTimer += dt;

  if (boss.phase === 1) {
    // 5 parallel beams every 3s
    if (boss.shootTimer >= 3) {
      boss.shootTimer = 0;
      setTelegraph(boss, timestamp, 300, "dot");
      const spacing = boss.width / 4;
      for (let i = 0; i <= 4; i++) {
        result.beamsToFire.push({
          x: boss.x + spacing * i,
          y: boss.y + boss.height,
          dx: 0,
          dy: 90,
        });
      }
    }
  } else if (boss.phase === 2) {
    // 7-beam wall with 2 gaps (skip indices 2 and 5) every 2.8s
    if (boss.shootTimer >= 2.8) {
      boss.shootTimer = 0;
      setTelegraph(boss, timestamp, 300, "dot");
      const spacing = boss.width / 6;
      for (let i = 0; i <= 6; i++) {
        if (i === 2 || i === 5) continue; // gaps
        result.beamsToFire.push({
          x: boss.x + spacing * i,
          y: boss.y + boss.height,
          dx: 0,
          dy: 100,
        });
      }
    }
  } else {
    // Phase 3: Rotate 3 attacks on 2.2s cycle
    if (boss.shootTimer >= 2.2) {
      boss.shootTimer = 0;
      const attack = boss.patternPhase % 3;
      boss.patternPhase++;

      if (attack === 0) {
        // (A) 7-beam gap wall
        setTelegraph(boss, timestamp, 300, "dot");
        const spacing = boss.width / 6;
        for (let i = 0; i <= 6; i++) {
          if (i === 2 || i === 5) continue;
          result.beamsToFire.push({
            x: boss.x + spacing * i,
            y: boss.y + boss.height,
            dx: 0,
            dy: 100,
          });
        }
      } else if (attack === 1) {
        // (B) Aimed beam at player
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const bx = boss.x + boss.width / 2;
        const by = boss.y + boss.height;
        const angle = Math.atan2(py - by, px - bx);
        const bSpeed = 140;
        setTelegraph(boss, timestamp, 300, "line", px);
        result.beamsToFire.push(beamFromBoss(boss, Math.cos(angle) * bSpeed, Math.sin(angle) * bSpeed));
      } else {
        // (C) Wide laser with ring telegraph
        setTelegraph(boss, timestamp, 500, "ring");
        result.beamsToFire.push({
          x: boss.x + boss.width / 2,
          y: boss.y + boss.height,
          dx: 0,
          dy: 200,
          width: 9,
        });
      }
    }
  }
}

// ── T4 — Network Nullifier ──────────────────────────────────────────────────

function updateTier4(
  boss: Boss,
  dt: number,
  timestamp: number,
  player: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  result: BossUpdateResult,
): void {
  // Zigzag bounce at all phases
  const speed = boss.phase === 1 ? 90 : boss.phase === 2 ? 120 : 140;
  if (boss.dx === 0) boss.dx = speed;
  boss.dx = Math.sign(boss.dx) * speed;
  boss.x += boss.dx * dt;

  if (boss.x <= 0) {
    boss.x = 0;
    boss.dx = speed;
  } else if (boss.x + boss.width >= canvasWidth) {
    boss.x = canvasWidth - boss.width;
    boss.dx = -speed;
  }

  boss.shootTimer += dt;

  // Helper for aimed beam
  const fireAimedBeam = () => {
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const bx = boss.x + boss.width / 2;
    const by = boss.y + boss.height;
    const angle = Math.atan2(py - by, px - bx);
    const bSpeed = 150;
    setTelegraph(boss, timestamp, 400, "line", px);
    result.beamsToFire.push(beamFromBoss(boss, Math.cos(angle) * bSpeed, Math.sin(angle) * bSpeed));
  };

  if (boss.phase === 1) {
    // Aimed beam every 2s
    if (boss.shootTimer >= 2) {
      boss.shootTimer = 0;
      fireAimedBeam();
    }
  } else if (boss.phase === 2) {
    // Every 2s: every 3rd shot = 3-beam aimed fan, others = single aimed
    if (boss.shootTimer >= 2) {
      boss.shootTimer = 0;
      boss.patternPhase++;
      if (boss.patternPhase % 3 === 0) {
        // 3-beam aimed fan
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const bx = boss.x + boss.width / 2;
        const by = boss.y + boss.height;
        const baseAngle = Math.atan2(py - by, px - bx);
        const bSpeed = 150;
        setTelegraph(boss, timestamp, 400, "line", px);
        for (const offset of [-0.2, 0, 0.2]) {
          const a = baseAngle + offset;
          result.beamsToFire.push(beamFromBoss(boss, Math.cos(a) * bSpeed, Math.sin(a) * bSpeed));
        }
      } else {
        fireAimedBeam();
      }
    }
  } else {
    // Phase 3: alternate every 1.4s: (A) aimed, (B) 4-beam downward radial
    if (boss.shootTimer >= 1.4) {
      boss.shootTimer = 0;
      boss.patternPhase++;
      if (boss.patternPhase % 2 === 0) {
        // (A) Single aimed beam
        fireAimedBeam();
      } else {
        // (B) 4-beam downward radial burst
        setTelegraph(boss, timestamp, 300, "dot");
        const bSpeed = 140;
        const angles = [Math.PI / 2, Math.PI / 3, 2 * Math.PI / 3, Math.PI / 2 + 0.3];
        for (const a of angles) {
          result.beamsToFire.push(beamFromBoss(boss, Math.cos(a) * bSpeed, Math.sin(a) * bSpeed));
        }
      }
    }
  }
}

// ── T5 — Core Corruptor ────────────────────────────────────────────────────

function updateTier5(
  boss: Boss,
  dt: number,
  timestamp: number,
  player: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  result: BossUpdateResult,
): void {
  boss.moveTimer += dt;

  if (boss.phase === 1) {
    // Descend to y=30% of canvasHeight, sweep left-right at 40 px/s
    const targetY = canvasHeight * 0.3;
    if (boss.y < targetY) {
      boss.y += 15 * dt;
      if (boss.y > targetY) boss.y = targetY;
    }
    if (boss.dx === 0) boss.dx = 40;
    boss.dx = Math.sign(boss.dx) * 40;
    boss.x += boss.dx * dt;
    if (boss.x <= 0) {
      boss.x = 0;
      boss.dx = 40;
    } else if (boss.x + boss.width >= canvasWidth) {
      boss.x = canvasWidth - boss.width;
      boss.dx = -40;
    }

    // 3-beam spread every 2.5s
    boss.shootTimer += dt;
    if (boss.shootTimer >= 2.5) {
      boss.shootTimer = 0;
      setTelegraph(boss, timestamp, 300, "dot");
      const speed = 120;
      result.beamsToFire.push(beamFromBoss(boss, 0, speed));
      result.beamsToFire.push(beamFromBoss(boss, Math.sin(-0.3) * speed, Math.cos(-0.3) * speed));
      result.beamsToFire.push(beamFromBoss(boss, Math.sin(0.3) * speed, Math.cos(0.3) * speed));
    }
  } else if (boss.phase === 2) {
    // Descend to 35%, sweep at 55 px/s
    const targetY = canvasHeight * 0.35;
    if (boss.y < targetY) {
      boss.y += 15 * dt;
      if (boss.y > targetY) boss.y = targetY;
    }
    if (boss.dx === 0) boss.dx = 55;
    boss.dx = Math.sign(boss.dx) * 55;
    boss.x += boss.dx * dt;
    if (boss.x <= 0) {
      boss.x = 0;
      boss.dx = 55;
    } else if (boss.x + boss.width >= canvasWidth) {
      boss.x = canvasWidth - boss.width;
      boss.dx = -55;
    }

    // Alternate 5-beam fan / aimed straight-down every 2s
    boss.shootTimer += dt;
    if (boss.shootTimer >= 2) {
      boss.shootTimer = 0;
      boss.patternPhase++;
      if (boss.patternPhase % 2 === 0) {
        // 5-beam fan
        setTelegraph(boss, timestamp, 300, "dot");
        const angles = [-0.5, -0.25, 0, 0.25, 0.5];
        const speed = 130;
        for (const a of angles) {
          result.beamsToFire.push(beamFromBoss(boss, Math.sin(a) * speed, Math.cos(a) * speed));
        }
      } else {
        // Aimed straight down
        setTelegraph(boss, timestamp, 300, "dot");
        result.beamsToFire.push(beamFromBoss(boss, 0, 150));
      }
    }
  } else {
    // Phase 3: Stationary at 35%
    const targetY = canvasHeight * 0.35;
    if (boss.y < targetY) {
      boss.y += 15 * dt;
      if (boss.y > targetY) boss.y = targetY;
    }
    boss.dx = 0; // stationary

    // 4-attack rotation on 1.8s cycle
    boss.shootTimer += dt;
    if (boss.shootTimer >= 1.8) {
      boss.shootTimer = 0;
      const attack = boss.patternPhase % 4;
      boss.patternPhase++;

      if (attack === 0) {
        // (A) 12-beam radial burst at 30-degree intervals
        setTelegraph(boss, timestamp, 150, "ring");
        const speed = 180;
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI * 2) / 12;
          result.beamsToFire.push(beamFromBoss(boss, Math.cos(a) * speed, Math.sin(a) * speed));
        }
        result.shakeEvents.push({ magnitude: 4, duration: 150 });
      } else if (attack === 1) {
        // (B) Aimed beam straight down
        setTelegraph(boss, timestamp, 300, "dot");
        result.beamsToFire.push(beamFromBoss(boss, 0, 150));
      } else {
        // (C) and (D): 5-beam fan
        setTelegraph(boss, timestamp, 300, "dot");
        const angles = [-0.5, -0.25, 0, 0.25, 0.5];
        const speed = 130;
        for (const a of angles) {
          result.beamsToFire.push(beamFromBoss(boss, Math.sin(a) * speed, Math.cos(a) * speed));
        }
      }
    }
  }
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

export function drawBoss(
  boss: Boss,
  ctx: CanvasRenderingContext2D,
  sprites: SpriteAtlas,
  timestamp: number,
): void {
  const normalSprites: Record<number, OffscreenCanvas> = {
    1: sprites.boss1,
    2: sprites.boss2,
    3: sprites.boss3,
    4: sprites.boss4,
    5: sprites.boss5,
  };
  const whiteSprites: Record<number, OffscreenCanvas> = {
    1: sprites.boss1White,
    2: sprites.boss2White,
    3: sprites.boss3White,
    4: sprites.boss4White,
    5: sprites.boss5White,
  };

  const useWhite = timestamp < boss.flashUntil;
  const sprite = useWhite ? whiteSprites[boss.tier] : normalSprites[boss.tier];
  ctx.drawImage(sprite, Math.round(boss.x), Math.round(boss.y));
}

export function drawBossTelegraph(
  boss: Boss,
  ctx: CanvasRenderingContext2D,
  timestamp: number,
): void {
  if (timestamp >= boss.telegraphUntil || !boss.telegraphOrigin) return;

  const elapsed = boss.telegraphUntil - timestamp;
  const totalDuration = boss.telegraphUntil - (boss.telegraphUntil - elapsed);
  // Pulsing opacity
  const pulse = 0.4 + 0.4 * Math.sin(timestamp / 60);

  ctx.save();
  ctx.globalAlpha = pulse;

  if (boss.telegraphType === "dot") {
    ctx.fillStyle = "#ff3333";
    ctx.beginPath();
    ctx.arc(boss.telegraphOrigin.x, boss.telegraphOrigin.y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (boss.telegraphType === "line") {
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boss.telegraphOrigin.x, boss.telegraphOrigin.y);
    // Line to telegraphAimX at canvas bottom (use a large Y)
    ctx.lineTo(boss.telegraphAimX, boss.telegraphOrigin.y + 600);
    ctx.stroke();
  } else if (boss.telegraphType === "ring") {
    // Expanding circle: animate radius 0 -> 30 over the telegraph duration
    void totalDuration;
    // Use time remaining to compute expansion
    const maxRadius = 30;
    const progress = 1 - elapsed / (boss.telegraphUntil - timestamp + elapsed);
    const radius = progress * maxRadius;
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      boss.x + boss.width / 2,
      boss.y + boss.height / 2,
      Math.max(1, radius),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  ctx.restore();
}

export function drawBossHpBar(
  boss: Boss,
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  palette: GamePalette,
): void {
  const barW = canvasWidth * 0.6;
  const barH = 10;
  const barX = (canvasWidth - barW) / 2;
  const barY = 12;
  const fillW = Math.max(0, (boss.hp / boss.maxHp) * barW);

  // Pick color by phase
  const fillColor =
    boss.phase === 1
      ? palette.shield
      : boss.phase === 2
        ? palette.spread
        : palette.enemy;

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(barX, barY, barW, barH);

  // HP fill
  ctx.fillStyle = fillColor;
  ctx.fillRect(barX, barY, fillW, barH);

  // 1px border
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // Left text: boss name
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = palette.text;
  ctx.font = "14px monospace";
  ctx.fillText(boss.name, barX, barY + barH + 4);

  // Right text: BOSS tier/5
  ctx.textAlign = "right";
  ctx.fillStyle = palette.textMuted;
  ctx.font = "12px monospace";
  ctx.fillText(`BOSS ${boss.tier}/5`, barX + barW, barY + barH + 4);

  // Reset text align
  ctx.textAlign = "left";
}

export function drawBossIntroBanner(
  boss: Boss,
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  palette: GamePalette,
  timestamp: number,
): void {
  if (!boss.introBanner) return;

  const elapsed = timestamp - boss.introBanner.startTime;
  if (elapsed < 0 || elapsed >= BANNER_TOTAL) return;

  const bannerH = 60;
  const bannerY = canvasHeight * 0.4 - bannerH / 2;

  // Tier colors
  const tierColors: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: palette.jammer,
    2: palette.enemy,
    3: palette.powerUp,
    4: palette.spread,
    5: palette.enemy,
  };
  const tierColor = tierColors[boss.tier];

  let xOffset = 0;
  let yOffset = 0;

  if (elapsed < BANNER_SLIDE_IN) {
    // Slide in from left
    const t = elapsed / BANNER_SLIDE_IN;
    xOffset = (-canvasWidth) * (1 - easeOutCubic(t));
  } else if (elapsed < BANNER_SLIDE_IN + BANNER_HOLD) {
    // Hold centered
    xOffset = 0;
    yOffset = 0;
  } else {
    // Slide out upward
    const t = (elapsed - BANNER_SLIDE_IN - BANNER_HOLD) / BANNER_SLIDE_OUT;
    yOffset = -canvasHeight * easeInCubic(t);
  }

  ctx.save();
  ctx.translate(xOffset, yOffset);

  // Background
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, bannerY, canvasWidth, bannerH);

  // Border top and bottom
  ctx.globalAlpha = 1;
  ctx.fillStyle = tierColor;
  ctx.fillRect(0, bannerY, canvasWidth, 2);
  ctx.fillRect(0, bannerY + bannerH - 2, canvasWidth, 2);

  // Hazard stripes on left side
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = tierColor;
  const stripeW = 8;
  const stripeSpacing = 14;
  for (let i = 0; i < 4; i++) {
    const sx = 10 + i * stripeSpacing;
    ctx.beginPath();
    ctx.moveTo(sx, bannerY + 4);
    ctx.lineTo(sx + stripeW, bannerY + 4);
    ctx.lineTo(sx + stripeW - 4, bannerY + bannerH - 4);
    ctx.lineTo(sx - 4, bannerY + bannerH - 4);
    ctx.closePath();
    ctx.fill();
  }

  // Hazard stripes on right side (mirrored)
  for (let i = 0; i < 4; i++) {
    const sx = canvasWidth - 10 - (i + 1) * stripeSpacing;
    ctx.beginPath();
    ctx.moveTo(sx, bannerY + 4);
    ctx.lineTo(sx + stripeW, bannerY + 4);
    ctx.lineTo(sx + stripeW + 4, bannerY + bannerH - 4);
    ctx.lineTo(sx + 4, bannerY + bannerH - 4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  // Center text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = palette.text;
  ctx.font = "bold 24px monospace";
  ctx.fillText(
    `\u26A0 ${boss.introBanner.name} \u26A0`,
    canvasWidth / 2,
    bannerY + bannerH / 2 - 8,
  );

  // Subtitle
  ctx.fillStyle = palette.textMuted;
  ctx.font = "12px monospace";
  ctx.fillText(
    boss.introBanner.subtitle,
    canvasWidth / 2,
    bannerY + bannerH / 2 + 14,
  );

  ctx.restore();
}
