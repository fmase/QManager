export interface GamePalette {
  player: string;
  beam: string;
  enemy: string;
  jammer: string;
  powerUp: string;
  shield: string;
  spread: string;
  text: string;
  textMuted: string;
  background: string;
}

export interface GameCallbacks {
  onExit: () => void;
}

// ─── Internal interfaces ──────────────────────────────────────────────────────

interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  active: boolean;
}

interface Player extends Entity {
  speed: number;
  shootCooldown: number;
  lastShot: number;
  hasShield: boolean;
  spreadShotUntil: number;
  rapidFireUntil: number;
}

interface Beam extends Entity {
  dy: number;
}

interface Enemy extends Entity {
  dy: number;
  hp: number;
  type: "interference" | "jammer";
  lastShot: number;
}

interface EnemyBeam extends Entity {
  dy: number;
}

interface PowerUp extends Entity {
  dy: number;
  type: "rapid" | "shield" | "spread";
}

interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Star {
  x: number;
  y: number;
  speed: number;
  brightness: number;
}

type GameState = "PLAYING" | "GAME_OVER";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYER_SPEED = 200;
const PLAYER_SHOOT_COOLDOWN = 300;
const RAPID_FIRE_COOLDOWN = 150;
const BEAM_SPEED = -350;
const ENEMY_BASE_FALL_SPEED = 60;
const JAMMER_FALL_SPEED = 40;
const JAMMER_SHOOT_INTERVAL = 2000;
const ENEMY_BEAM_SPEED = 150;
const POWERUP_FALL_SPEED = 50;
const SPAWN_BASE_INTERVAL = 2000;
const SPAWN_INTERVAL_DECREASE = 150;
const SPAWN_MIN_INTERVAL = 500;
const JAMMER_WAVE_THRESHOLD = 3;
const JAMMER_SPAWN_CHANCE = 0.2;
const POWERUP_DROP_RATE = 0.1;
const WAVE_DURATION = 30;
const SCORE_INTERFERENCE = 10;
const SCORE_JAMMER = 25;
const SCORE_SURVIVAL = 1;

const PLAYER_W = 24;
const PLAYER_H = 28;
const ENEMY_W = 20;
const ENEMY_H = 16;
const JAMMER_W = 28;
const JAMMER_H = 20;
const BEAM_W = 3;
const BEAM_H = 10;
const POWERUP_W = 14;
const POWERUP_H = 14;

const RAPID_FIRE_DURATION = 5000;
const SPREAD_SHOT_DURATION = 5000;
const SPREAD_ANGLE = 0.3; // radians off-axis for spread

const LS_KEY = "qm_game_highscore";

// ─── Engine ───────────────────────────────────────────────────────────────────

export class SignalStormEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private palette: GamePalette;
  private callbacks: GameCallbacks;

  private keys: Set<string> = new Set();
  private gameState: GameState = "PLAYING";

  private player!: Player;
  private beams: Beam[] = [];
  private enemies: Enemy[] = [];
  private enemyBeams: EnemyBeam[] = [];
  private powerUps: PowerUp[] = [];
  private particles: Particle[] = [];
  private stars: Star[] = [];

  private score = 0;
  private highScore = 0;
  private wave = 1;
  private waveTimer = 0;
  private survivalTimer = 0;
  private spawnTimer = 0;
  private lastTime = 0;
  private isNewHighScore = false;

  constructor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    palette: GamePalette,
    callbacks: GameCallbacks
  ) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.palette = palette;
    this.callbacks = callbacks;

    // Load high score
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored !== null) {
        this.highScore = parseInt(stored, 10) || 0;
      }
    } catch {
      // localStorage unavailable
    }

    this.initStars();
    this.initPlayer();
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  public handleKeyDown(key: string): void {
    this.keys.add(key);

    if (this.gameState === "GAME_OVER") {
      if (key === "Enter") this.restart();
      if (key === "Escape") this.callbacks.onExit();
    } else {
      if (key === "Escape") this.callbacks.onExit();
    }
  }

  public handleKeyUp(key: string): void {
    this.keys.delete(key);
  }

  public tick(timestamp: number): void {
    this.update(timestamp);
    this.render();
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Keep player within new bounds
    this.player.x = Math.min(
      Math.max(this.player.x, 0),
      this.width - PLAYER_W
    );
    this.player.y = this.height - PLAYER_H - 16;
  }

  // ─── Init helpers ────────────────────────────────────────────────────────────

  private initPlayer(): void {
    this.player = {
      x: this.width / 2 - PLAYER_W / 2,
      y: this.height - PLAYER_H - 16,
      width: PLAYER_W,
      height: PLAYER_H,
      active: true,
      speed: PLAYER_SPEED,
      shootCooldown: PLAYER_SHOOT_COOLDOWN,
      lastShot: 0,
      hasShield: false,
      spreadShotUntil: 0,
      rapidFireUntil: 0,
    };
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speed: 20 + Math.random() * 40,
        brightness: 0.2 + Math.random() * 0.8,
      });
    }
  }

  // ─── Update ──────────────────────────────────────────────────────────────────

  private update(timestamp: number): void {
    if (this.lastTime === 0) {
      this.lastTime = timestamp;
    }
    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;
    const dt = Math.max(0.016, Math.min(rawDt, 0.1)); // floor at ~60fps, cap at 100ms

    if (this.gameState === "GAME_OVER") {
      // Update stars and particles even on game-over screen for ambience
      this.updateStars(dt);
      this.updateParticles(dt);
      return;
    }

    // ── Player movement ──
    const isRapid = timestamp < this.player.rapidFireUntil;
    const isSpread = timestamp < this.player.spreadShotUntil;

    if (this.keys.has("ArrowLeft") || this.keys.has("a")) {
      this.player.x -= this.player.speed * dt;
    }
    if (this.keys.has("ArrowRight") || this.keys.has("d")) {
      this.player.x += this.player.speed * dt;
    }
    this.player.x = Math.max(0, Math.min(this.player.x, this.width - PLAYER_W));

    // ── Shooting ──
    const cooldown = isRapid ? RAPID_FIRE_COOLDOWN : PLAYER_SHOOT_COOLDOWN;
    if (
      this.keys.has(" ") &&
      timestamp - this.player.lastShot >= cooldown
    ) {
      this.player.lastShot = timestamp;
      this.firePlayerBeams(isSpread);
    }

    // ── Move player beams ──
    for (const b of this.beams) {
      b.y += BEAM_SPEED * dt;
      if (b.y + b.height < 0) b.active = false;
    }

    // ── Spawn enemies ──
    const spawnInterval = Math.max(
      SPAWN_MIN_INTERVAL,
      SPAWN_BASE_INTERVAL - (this.wave - 1) * SPAWN_INTERVAL_DECREASE
    );
    this.spawnTimer += dt * 1000;
    if (this.spawnTimer >= spawnInterval) {
      this.spawnTimer = 0;
      this.spawnEnemy(timestamp);
    }

    // ── Move enemies + jammer shooting ──
    for (const e of this.enemies) {
      e.y += e.dy * dt;
      if (e.y > this.height) e.active = false;

      if (e.type === "jammer" && timestamp - e.lastShot >= JAMMER_SHOOT_INTERVAL) {
        e.lastShot = timestamp;
        this.fireEnemyBeam(e);
      }
    }

    // ── Move enemy beams ──
    for (const eb of this.enemyBeams) {
      eb.y += eb.dy * dt;
      if (eb.y > this.height) eb.active = false;
    }

    // ── Collision: player beams vs enemies ──
    for (const b of this.beams) {
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (!e.active) continue;
        if (this.collides(b, e)) {
          b.active = false;
          e.hp -= 1;
          if (e.hp <= 0) {
            e.active = false;
            this.score +=
              e.type === "jammer" ? SCORE_JAMMER : SCORE_INTERFERENCE;
            this.spawnParticles(
              e.x + e.width / 2,
              e.y + e.height / 2,
              e.type === "jammer" ? this.palette.jammer : this.palette.enemy
            );
            if (Math.random() < POWERUP_DROP_RATE) {
              this.spawnPowerUp(e.x + e.width / 2, e.y + e.height / 2);
            }
          }
          break;
        }
      }
    }

    // ── Collision: enemies vs player ──
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (this.collides(e, this.player)) {
        if (this.player.hasShield) {
          this.player.hasShield = false;
          e.active = false;
          this.spawnParticles(
            e.x + e.width / 2,
            e.y + e.height / 2,
            this.palette.shield
          );
        } else {
          this.triggerGameOver();
          return;
        }
      }
    }

    // ── Collision: enemy beams vs player ──
    for (const eb of this.enemyBeams) {
      if (!eb.active) continue;
      if (this.collides(eb, this.player)) {
        eb.active = false;
        if (this.player.hasShield) {
          this.player.hasShield = false;
          this.spawnParticles(
            this.player.x + PLAYER_W / 2,
            this.player.y + PLAYER_H / 2,
            this.palette.shield
          );
        } else {
          this.triggerGameOver();
          return;
        }
      }
    }

    // ── Move power-ups + collision with player ──
    for (const p of this.powerUps) {
      p.y += p.dy * dt;
      if (p.y > this.height) {
        p.active = false;
        continue;
      }
      if (this.collides(p, this.player)) {
        p.active = false;
        this.applyPowerUp(p, timestamp);
      }
    }

    // ── Update particles ──
    this.updateParticles(dt);

    // ── Update stars ──
    this.updateStars(dt);

    // ── Wave timer ──
    this.waveTimer += dt;
    if (this.waveTimer >= WAVE_DURATION) {
      this.wave += 1;
      this.waveTimer = 0;
    }

    // ── Survival score ──
    this.survivalTimer += dt;
    if (this.survivalTimer >= 1) {
      this.score += SCORE_SURVIVAL;
      this.survivalTimer -= 1;
    }

    // ── Filter inactive entities ──
    this.beams = this.beams.filter((b) => b.active);
    this.enemies = this.enemies.filter((e) => e.active);
    this.enemyBeams = this.enemyBeams.filter((eb) => eb.active);
    this.powerUps = this.powerUps.filter((p) => p.active);
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ─── Helpers for update ──────────────────────────────────────────────────────

  private firePlayerBeams(isSpread: boolean): void {
    const cx = this.player.x + PLAYER_W / 2 - BEAM_W / 2;
    const cy = this.player.y - BEAM_H;

    if (isSpread) {
      // Center beam
      this.beams.push({
        x: cx,
        y: cy,
        width: BEAM_W,
        height: BEAM_H,
        active: true,
        dy: BEAM_SPEED,
      });
      // Left angled
      this.beams.push({
        x: cx - Math.tan(SPREAD_ANGLE) * 20,
        y: cy,
        width: BEAM_W,
        height: BEAM_H,
        active: true,
        dy: BEAM_SPEED,
      });
      // Right angled
      this.beams.push({
        x: cx + Math.tan(SPREAD_ANGLE) * 20,
        y: cy,
        width: BEAM_W,
        height: BEAM_H,
        active: true,
        dy: BEAM_SPEED,
      });
    } else {
      this.beams.push({
        x: cx,
        y: cy,
        width: BEAM_W,
        height: BEAM_H,
        active: true,
        dy: BEAM_SPEED,
      });
    }
  }

  private spawnEnemy(timestamp: number): void {
    const x = Math.random() * (this.width - JAMMER_W);
    const isJammer =
      this.wave >= JAMMER_WAVE_THRESHOLD && Math.random() < JAMMER_SPAWN_CHANCE;

    if (isJammer) {
      const fallSpeed = JAMMER_FALL_SPEED + (this.wave - 1) * 4;
      this.enemies.push({
        x,
        y: -JAMMER_H,
        width: JAMMER_W,
        height: JAMMER_H,
        active: true,
        dy: fallSpeed,
        hp: 2,
        type: "jammer",
        lastShot: timestamp,
      });
    } else {
      const fallSpeed = ENEMY_BASE_FALL_SPEED + (this.wave - 1) * 8;
      this.enemies.push({
        x,
        y: -ENEMY_H,
        width: ENEMY_W,
        height: ENEMY_H,
        active: true,
        dy: fallSpeed,
        hp: 1,
        type: "interference",
        lastShot: 0,
      });
    }
  }

  private fireEnemyBeam(e: Enemy): void {
    this.enemyBeams.push({
      x: e.x + e.width / 2 - BEAM_W / 2,
      y: e.y + e.height,
      width: BEAM_W,
      height: BEAM_H,
      active: true,
      dy: ENEMY_BEAM_SPEED,
    });
  }

  private spawnParticles(cx: number, cy: number, color: string): void {
    const count = 4 + Math.floor(Math.random() * 3); // 4-6
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: cx,
        y: cy,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.4 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private spawnPowerUp(cx: number, cy: number): void {
    const types: Array<"rapid" | "shield" | "spread"> = [
      "rapid",
      "shield",
      "spread",
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    this.powerUps.push({
      x: cx - POWERUP_W / 2,
      y: cy,
      width: POWERUP_W,
      height: POWERUP_H,
      active: true,
      dy: POWERUP_FALL_SPEED,
      type,
    });
  }

  private applyPowerUp(p: PowerUp, timestamp: number): void {
    if (p.type === "rapid") {
      this.player.rapidFireUntil = timestamp + RAPID_FIRE_DURATION;
    } else if (p.type === "shield") {
      this.player.hasShield = true;
    } else if (p.type === "spread") {
      this.player.spreadShotUntil = timestamp + SPREAD_SHOT_DURATION;
    }
    this.spawnParticles(
      p.x + POWERUP_W / 2,
      p.y + POWERUP_H / 2,
      p.type === "rapid"
        ? this.palette.powerUp
        : p.type === "shield"
          ? this.palette.shield
          : this.palette.spread
    );
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.dx * dt;
      p.y += p.dy * dt;
      p.life -= dt;
    }
  }

  private updateStars(dt: number): void {
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      }
    }
  }

  private triggerGameOver(): void {
    this.gameState = "GAME_OVER";
    this.isNewHighScore = false;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.isNewHighScore = true;
      try {
        localStorage.setItem(LS_KEY, String(this.highScore));
      } catch {
        // localStorage unavailable
      }
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  private render(): void {
    const { ctx, width, height } = this;

    // 1. Background
    ctx.fillStyle = this.palette.background;
    ctx.fillRect(0, 0, width, height);

    // 2. Stars
    for (const s of this.stars) {
      ctx.globalAlpha = s.brightness * 0.7;
      ctx.fillStyle = this.palette.textMuted;
      ctx.fillRect(s.x, s.y, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    if (this.gameState === "PLAYING") {
      // 3. Shield glow around player
      if (this.player.hasShield) {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = this.palette.shield;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          this.player.x + PLAYER_W / 2,
          this.player.y + PLAYER_H / 2,
          PLAYER_W * 0.9,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // 4. Player: signal tower shape
      this.drawPlayer();

      // 5. Player beams
      ctx.fillStyle = this.palette.beam;
      for (const b of this.beams) {
        ctx.fillRect(b.x, b.y, b.width, b.height);
      }

      // 6. Enemies
      for (const e of this.enemies) {
        this.drawEnemy(e);
      }

      // 7. Enemy beams
      ctx.fillStyle = this.palette.enemy;
      for (const eb of this.enemyBeams) {
        ctx.fillRect(eb.x, eb.y, eb.width, eb.height);
      }

      // 8. Power-ups
      for (const p of this.powerUps) {
        this.drawPowerUp(p);
      }
    }

    // 9. Particles (shown during game and game-over for ambience)
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (this.gameState === "PLAYING") {
      // 10. HUD
      this.drawHUD();

      // 11. Power-up indicators
      this.drawPowerUpIndicators();
    }

    // 12. Game over overlay
    if (this.gameState === "GAME_OVER") {
      this.drawGameOver();
    }
  }

  private drawPlayer(): void {
    const { ctx } = this;
    const { x, y } = this.player;

    ctx.fillStyle = this.palette.player;

    // Base rectangle (main body)
    ctx.fillRect(x + 4, y + 14, PLAYER_W - 8, PLAYER_H - 14);

    // Wider mid-section
    ctx.fillRect(x + 2, y + 18, PLAYER_W - 4, 6);

    // Antenna mast
    ctx.fillRect(x + PLAYER_W / 2 - 1, y, 2, 14);

    // Left antenna arm
    ctx.fillRect(x + 4, y + 6, PLAYER_W / 2 - 5, 2);

    // Right antenna arm
    ctx.fillRect(x + PLAYER_W / 2 + 1, y + 6, PLAYER_W / 2 - 5, 2);

    // Signal tip dot
    ctx.beginPath();
    ctx.arc(x + PLAYER_W / 2, y + 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEnemy(e: Enemy): void {
    const { ctx } = this;

    if (e.type === "jammer") {
      // Jammer: larger, more imposing rectangle with cross pattern
      ctx.fillStyle = this.palette.jammer;
      ctx.fillRect(e.x, e.y, e.width, e.height);

      // Cross detail
      ctx.fillStyle = this.palette.background;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(e.x + e.width / 2 - 1, e.y + 2, 2, e.height - 4);
      ctx.fillRect(e.x + 2, e.y + e.height / 2 - 1, e.width - 4, 2);
      ctx.globalAlpha = 1;

      // Highlight top edge
      ctx.fillStyle = this.palette.jammer;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(e.x, e.y, e.width, 2);
      ctx.globalAlpha = 1;
    } else {
      // Interference: rectangle with noisy pattern
      ctx.fillStyle = this.palette.enemy;
      ctx.fillRect(e.x, e.y, e.width, e.height);

      // Noisy inner lines
      ctx.fillStyle = this.palette.background;
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 3; i++) {
        const lineY = e.y + 3 + i * 4;
        ctx.fillRect(e.x + 2, lineY, e.width - 4, 1);
      }
      ctx.globalAlpha = 1;

      // Corner dots as "antenna nodes"
      ctx.fillStyle = this.palette.enemy;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(e.x + 1, e.y + 1, 3, 3);
      ctx.fillRect(e.x + e.width - 4, e.y + 1, 3, 3);
      ctx.globalAlpha = 1;
    }
  }

  private drawPowerUp(p: PowerUp): void {
    const { ctx } = this;
    const cx = p.x + POWERUP_W / 2;
    const cy = p.y + POWERUP_H / 2;
    const r = POWERUP_W / 2;

    // Glow
    ctx.globalAlpha = 0.3;
    ctx.fillStyle =
      p.type === "rapid"
        ? this.palette.powerUp
        : p.type === "shield"
          ? this.palette.shield
          : this.palette.spread;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.fill();

    // Solid circle
    ctx.globalAlpha = 1;
    ctx.fillStyle =
      p.type === "rapid"
        ? this.palette.powerUp
        : p.type === "shield"
          ? this.palette.shield
          : this.palette.spread;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Letter inside
    ctx.fillStyle = this.palette.background;
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      p.type === "rapid" ? "R" : p.type === "shield" ? "S" : "W",
      cx,
      cy
    );
  }

  private drawHUD(): void {
    const { ctx, width } = this;

    // Score — top left
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = this.palette.textMuted;
    ctx.font = "11px monospace";
    ctx.fillText("SCORE", 12, 10);
    ctx.fillStyle = this.palette.text;
    ctx.font = "bold 14px monospace";
    ctx.fillText(String(this.score), 12, 23);

    // High score — top right
    ctx.textAlign = "right";
    ctx.fillStyle = this.palette.textMuted;
    ctx.font = "11px monospace";
    ctx.fillText("BEST", width - 12, 10);
    ctx.fillStyle = this.palette.text;
    ctx.font = "bold 14px monospace";
    ctx.fillText(String(this.highScore), width - 12, 23);

    // Wave — top center
    ctx.textAlign = "center";
    ctx.fillStyle = this.palette.textMuted;
    ctx.font = "11px monospace";
    ctx.fillText("WAVE", width / 2, 10);
    ctx.fillStyle = this.palette.text;
    ctx.font = "bold 14px monospace";
    ctx.fillText(String(this.wave), width / 2, 23);
  }

  private drawPowerUpIndicators(): void {
    const { ctx, width } = this;
    const now = this.lastTime;
    let yOffset = 44;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "11px monospace";

    if (now < this.player.rapidFireUntil) {
      const remaining = ((this.player.rapidFireUntil - now) / 1000).toFixed(1);
      ctx.fillStyle = this.palette.powerUp;
      ctx.fillText(`⚡ RAPID FIRE ${remaining}s`, 12, yOffset);
      yOffset += 14;
    }

    if (now < this.player.spreadShotUntil) {
      const remaining = ((this.player.spreadShotUntil - now) / 1000).toFixed(1);
      ctx.fillStyle = this.palette.spread;
      ctx.fillText(`◈ SPREAD ${remaining}s`, 12, yOffset);
    }

    // Shield indicator top-right
    if (this.player.hasShield) {
      ctx.textAlign = "right";
      ctx.fillStyle = this.palette.shield;
      ctx.fillText("◉ SHIELD", width - 12, 44);
    }

    ctx.textAlign = "left";
  }

  private drawGameOver(): void {
    const { ctx, width, height } = this;

    // Semi-transparent overlay
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = this.palette.background;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;

    const centerX = width / 2;
    const centerY = height / 2;

    // "GAME OVER" title
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = this.palette.text;
    ctx.font = "bold 32px monospace";
    ctx.fillText("GAME OVER", centerX, centerY - 60);

    // Score
    ctx.fillStyle = this.palette.textMuted;
    ctx.font = "11px monospace";
    ctx.fillText("SCORE", centerX, centerY - 20);
    ctx.fillStyle = this.palette.text;
    ctx.font = "bold 24px monospace";
    ctx.fillText(String(this.score), centerX, centerY + 4);

    // New high score message
    if (this.isNewHighScore) {
      ctx.fillStyle = this.palette.powerUp;
      ctx.font = "bold 14px monospace";
      ctx.fillText("★ NEW HIGH SCORE ★", centerX, centerY + 34);
    } else {
      ctx.fillStyle = this.palette.textMuted;
      ctx.font = "11px monospace";
      ctx.fillText(`BEST: ${this.highScore}`, centerX, centerY + 34);
    }

    // Retry prompt
    ctx.fillStyle = this.palette.textMuted;
    ctx.font = "11px monospace";
    ctx.fillText("Enter to retry  •  Esc to exit", centerX, centerY + 66);
  }

  // ─── AABB collision ──────────────────────────────────────────────────────────

  private collides(a: Entity, b: Entity): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  // ─── Restart ─────────────────────────────────────────────────────────────────

  private restart(): void {
    this.gameState = "PLAYING";
    this.score = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.survivalTimer = 0;
    this.spawnTimer = 0;
    this.lastTime = 0;
    this.isNewHighScore = false;

    this.beams = [];
    this.enemies = [];
    this.enemyBeams = [];
    this.powerUps = [];
    this.particles = [];

    this.initPlayer();
    // Re-scatter stars
    this.initStars();
  }
}
