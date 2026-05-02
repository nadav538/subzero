"use client";

import { useEffect, useRef } from "react";

// ── types ──────────────────────────────────────────────────────────────────
interface Stats {
  speed: number;       // px/frame base
  jumpPower: number;   // initial vy
  magnetRange: number; // px
}

interface PermUpgrades {
  speed: number;
  jump: number;
  magnet: number;
}

interface RunUpgrade {
  type: "speed" | "jump" | "magnet";
  label: string;
  x: number;
  y: number;
  active: boolean;
}

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface Coin {
  x: number;
  y: number;
  r: number;
  collected: boolean;
  glowPhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  r: number;
}

// ── constants ──────────────────────────────────────────────────────────────
const W = 800;
const H = 400;
const GROUND = H - 70;
const GRAVITY = 0.55;
const PLAYER_W = 30;
const PLAYER_H = 44;
const PLAYER_X = 110;

const UPGRADE_ICONS: Record<string, string> = {
  speed: "⚡",
  jump: "🦘",
  magnet: "🧲",
};

const UPGRADE_COLORS: Record<string, string> = {
  speed: "#ffdd44",
  jump: "#44ddff",
  magnet: "#ff88ff",
};

// ── helpers ────────────────────────────────────────────────────────────────
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function rectOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── main component ─────────────────────────────────────────────────────────
export default function EndlessRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateRef = useRef<any>(null);

  // stable restart handler exposed to overlay buttons
  const restartRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // ── game state ─────────────────────────────────────────────────────────
    class GameState {
      // persistent
      coins = 0;
      permUpgrades: PermUpgrades = { speed: 0, jump: 0, magnet: 0 };
      phase: "playing" | "dead" | "shop" = "playing";

      // run-local
      score = 0;
      runCoins = 0;
      distance = 0;

      // player
      px = PLAYER_X;
      py = GROUND - PLAYER_H;
      pvx = 0;
      pvy = 0;
      onGround = true;
      jumpsLeft = 1;
      lane = 1; // 0=left 1=mid 2=right
      laneTargetX = PLAYER_X;
      dead = false;

      // active run-upgrades
      runStats: Stats = { speed: 0, jumpPower: 0, magnetRange: 0 };
      activeUpgrades: Set<string> = new Set();

      // world
      worldSpeed = 0;
      spawnTimer = 0;
      coinTimer = 0;
      upgradeTimer = 0;
      bgOffset = 0;

      obstacles: Obstacle[] = [];
      coins_: Coin[] = [];
      runUpgrades: RunUpgrade[] = [];
      particles: Particle[] = [];

      // visuals
      playerColorPhase = 0;
      shakeMag = 0;
      shakeDecay = 0.85;

      getStats(): Stats {
        return {
          speed: 3.5 + this.permUpgrades.speed * 0.4 + this.runStats.speed,
          jumpPower: 11 + this.permUpgrades.jump * 0.8 + this.runStats.jumpPower,
          magnetRange: 60 + this.permUpgrades.magnet * 20 + this.runStats.magnetRange,
        };
      }
    }

    let gs = new GameState();
    stateRef.current = gs;

    const keys: Record<string, boolean> = {};
    let lastTime = 0;
    let rafId = 0;

    restartRef.current = () => {
      const prev = gs;
      gs = new GameState();
      gs.coins = prev.coins;
      gs.permUpgrades = { ...prev.permUpgrades };
      gs.phase = "playing";
      stateRef.current = gs;
    };

    // ── input ──────────────────────────────────────────────────────────────
    const onKey = (e: KeyboardEvent) => {
      keys[e.code] = e.type === "keydown";
      if (e.type !== "keydown") return;

      if (gs.phase === "playing") {
        if ((e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") && gs.jumpsLeft > 0) {
          gs.pvy = -gs.getStats().jumpPower;
          gs.onGround = false;
          gs.jumpsLeft--;
          spawnParticles(gs.px + PLAYER_W / 2, gs.py + PLAYER_H, "#88ffcc", 6);
        }
        if (e.code === "ArrowLeft" || e.code === "KeyA") {
          if (gs.lane > 0) gs.lane--;
          gs.laneTargetX = laneX(gs.lane);
        }
        if (e.code === "ArrowRight" || e.code === "KeyD") {
          if (gs.lane < 2) gs.lane++;
          gs.laneTargetX = laneX(gs.lane);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);

    // touch / swipe
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (gs.phase !== "playing") return;
      if (Math.abs(dy) > Math.abs(dx) && dy < -30 && gs.jumpsLeft > 0) {
        gs.pvy = -gs.getStats().jumpPower;
        gs.onGround = false;
        gs.jumpsLeft--;
      } else if (dx < -30 && gs.lane > 0) {
        gs.lane--;
        gs.laneTargetX = laneX(gs.lane);
      } else if (dx > 30 && gs.lane < 2) {
        gs.lane++;
        gs.laneTargetX = laneX(gs.lane);
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });

    // ── lane helpers ───────────────────────────────────────────────────────
    function laneX(lane: number) {
      const centers = [W * 0.18, W * 0.5 - PLAYER_W / 2, W * 0.72];
      return centers[lane];
    }
    gs.laneTargetX = laneX(1);
    gs.px = laneX(1);

    // ── particles ──────────────────────────────────────────────────────────
    function spawnParticles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        gs.particles.push({
          x, y,
          vx: rand(-2.5, 2.5),
          vy: rand(-3.5, -0.5),
          life: 1,
          maxLife: 1,
          color,
          r: rand(2, 5),
        });
      }
    }

    // ── spawning ───────────────────────────────────────────────────────────
    function spawnObstacle() {
      const laneIdx = randInt(0, 2);
      const cx = laneX(laneIdx) + PLAYER_W / 2;
      const types = [
        { w: 28, h: 44, color: "#ff4455" },
        { w: 22, h: 60, color: "#ff6633" },
        { w: 36, h: 32, color: "#cc33ff" },
      ];
      const t = types[randInt(0, types.length - 1)];
      gs.obstacles.push({ x: cx - t.w / 2, y: GROUND - t.h, w: t.w, h: t.h, color: t.color });
    }

    function spawnCoin() {
      const laneIdx = randInt(0, 2);
      const cx = laneX(laneIdx) + PLAYER_W / 2;
      const floatH = rand(0, 60);
      gs.coins_.push({
        x: cx,
        y: GROUND - PLAYER_H - floatH,
        r: 8,
        collected: false,
        glowPhase: Math.random() * Math.PI * 2,
      });
    }

    function spawnRunUpgrade() {
      const types: Array<"speed" | "jump" | "magnet"> = ["speed", "jump", "magnet"];
      const t = types[randInt(0, types.length - 1)];
      const labels: Record<string, string> = {
        speed: "SPEED UP!",
        jump: "JUMP BOOST!",
        magnet: "MAGNET!",
      };
      const laneIdx = randInt(0, 2);
      const cx = laneX(laneIdx) + PLAYER_W / 2;
      gs.runUpgrades.push({
        type: t,
        label: labels[t],
        x: cx,
        y: GROUND - PLAYER_H - 20,
        active: false,
      });
    }

    // ── update ─────────────────────────────────────────────────────────────
    function update(dt: number) {
      if (gs.phase !== "playing") return;

      const stats = gs.getStats();

      // speed ramp
      gs.distance += stats.speed;
      gs.worldSpeed = stats.speed;
      gs.score = Math.floor(gs.distance / 10);

      // player horizontal
      gs.px = lerp(gs.px, gs.laneTargetX, 0.18);

      // player vertical
      gs.pvy += GRAVITY;
      gs.py += gs.pvy;

      if (gs.py >= GROUND - PLAYER_H) {
        gs.py = GROUND - PLAYER_H;
        gs.pvy = 0;
        gs.onGround = true;
        gs.jumpsLeft = 1;
      }

      gs.playerColorPhase += 0.04;
      gs.bgOffset = (gs.bgOffset + gs.worldSpeed * 0.3) % W;
      gs.shakeMag *= gs.shakeDecay;

      // spawn
      gs.spawnTimer -= gs.worldSpeed;
      if (gs.spawnTimer <= 0) {
        spawnObstacle();
        gs.spawnTimer = rand(260, 480);
      }

      gs.coinTimer -= gs.worldSpeed;
      if (gs.coinTimer <= 0) {
        for (let i = 0; i < randInt(1, 3); i++) spawnCoin();
        gs.coinTimer = rand(120, 220);
      }

      gs.upgradeTimer -= gs.worldSpeed;
      if (gs.upgradeTimer <= 0) {
        spawnRunUpgrade();
        gs.upgradeTimer = rand(600, 1000);
      }

      // move world objects
      for (const o of gs.obstacles) o.x -= gs.worldSpeed;
      for (const c of gs.coins_) c.x -= gs.worldSpeed;
      for (const u of gs.runUpgrades) u.x -= gs.worldSpeed;

      // magnet
      for (const c of gs.coins_) {
        if (c.collected) continue;
        const dx = gs.px + PLAYER_W / 2 - c.x;
        const dy = gs.py + PLAYER_H / 2 - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < stats.magnetRange) {
          c.x += dx * 0.12;
          c.y += dy * 0.12;
        }
      }

      // coin collection
      for (const c of gs.coins_) {
        if (c.collected) continue;
        const dx = gs.px + PLAYER_W / 2 - c.x;
        const dy = gs.py + PLAYER_H / 2 - c.y;
        if (Math.sqrt(dx * dx + dy * dy) < c.r + PLAYER_W / 2 - 4) {
          c.collected = true;
          gs.runCoins++;
          gs.coins++;
          spawnParticles(c.x, c.y, "#ffdd44", 8);
        }
      }

      // run upgrade collection
      for (const u of gs.runUpgrades) {
        if (u.active) continue;
        if (rectOverlap(gs.px, gs.py, PLAYER_W, PLAYER_H, u.x - 18, u.y - 18, 36, 36)) {
          u.active = true;
          applyRunUpgrade(u.type);
          spawnParticles(u.x, u.y, UPGRADE_COLORS[u.type], 14);
        }
      }

      // obstacle collision
      for (const o of gs.obstacles) {
        if (rectOverlap(gs.px + 4, gs.py + 4, PLAYER_W - 8, PLAYER_H - 4, o.x, o.y, o.w, o.h)) {
          die();
          return;
        }
      }

      // particles
      for (const p of gs.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.035;
      }
      gs.particles = gs.particles.filter(p => p.life > 0);

      // cleanup off-screen
      gs.obstacles = gs.obstacles.filter(o => o.x + o.w > -10);
      gs.coins_ = gs.coins_.filter(c => !c.collected && c.x > -20);
      gs.runUpgrades = gs.runUpgrades.filter(u => u.x > -30);
    }

    function applyRunUpgrade(type: "speed" | "jump" | "magnet") {
      gs.activeUpgrades.add(type);
      if (type === "speed") gs.runStats.speed += 1.2;
      if (type === "jump") gs.runStats.jumpPower += 2.5;
      if (type === "magnet") gs.runStats.magnetRange += 80;
    }

    function die() {
      if (gs.dead) return;
      gs.dead = true;
      gs.phase = "dead";
      gs.shakeMag = 12;
      spawnParticles(gs.px + PLAYER_W / 2, gs.py + PLAYER_H / 2, "#ff4455", 20);
    }

    // ── shop ───────────────────────────────────────────────────────────────
    const PERM_UPGRADES = [
      { key: "speed", label: "Base Speed", desc: "+0.4 speed per level", cost: (lvl: number) => 10 + lvl * 8 },
      { key: "jump", label: "Jump Power", desc: "+0.8 jump height per level", cost: (lvl: number) => 12 + lvl * 8 },
      { key: "magnet", label: "Magnet Range", desc: "+20px range per level", cost: (lvl: number) => 10 + lvl * 6 },
    ];

    // ── drawing ────────────────────────────────────────────────────────────
    function drawBackground() {
      // sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#06070e");
      sky.addColorStop(1, "#0b1230");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // stars
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      for (let i = 0; i < 60; i++) {
        const sx = ((i * 137 + gs.bgOffset * 0.2) % W + W) % W;
        const sy = (i * 71) % (GROUND - 60);
        const sr = (i % 3 === 0) ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // ground
      const groundGrad = ctx.createLinearGradient(0, GROUND, 0, H);
      groundGrad.addColorStop(0, "#1a1e3a");
      groundGrad.addColorStop(1, "#111428");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, GROUND, W, H - GROUND);

      // ground line glow
      ctx.save();
      ctx.shadowColor = "#4f7fff";
      ctx.shadowBlur = 10;
      ctx.strokeStyle = "#4f7fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND);
      ctx.lineTo(W, GROUND);
      ctx.stroke();
      ctx.restore();

      // lane lines
      ctx.strokeStyle = "rgba(80,100,200,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([12, 18]);
      for (let i = 1; i < 3; i++) {
        const x = W * (i / 3);
        ctx.beginPath();
        ctx.moveTo(x, GROUND);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    function drawPlayer() {
      const { px, py } = gs;
      const t = gs.playerColorPhase;

      ctx.save();

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(px + PLAYER_W / 2, GROUND + 6, PLAYER_W / 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // body glow
      if (gs.activeUpgrades.size > 0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = gs.activeUpgrades.has("speed") ? "#ffdd44"
          : gs.activeUpgrades.has("magnet") ? "#ff88ff" : "#44ddff";
      }

      // body
      const bodyGrad = ctx.createLinearGradient(px, py, px + PLAYER_W, py + PLAYER_H);
      bodyGrad.addColorStop(0, `hsl(${200 + Math.sin(t) * 20}, 80%, 65%)`);
      bodyGrad.addColorStop(1, `hsl(${220 + Math.cos(t) * 20}, 70%, 45%)`);
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(px, py, PLAYER_W, PLAYER_H, 6);
      ctx.fill();

      // visor
      ctx.fillStyle = "rgba(0,200,255,0.85)";
      ctx.beginPath();
      ctx.roundRect(px + 5, py + 8, PLAYER_W - 10, 12, 4);
      ctx.fill();

      // legs animation
      const legAnim = gs.onGround ? Math.sin(gs.distance * 0.18) * 5 : 0;
      ctx.fillStyle = "#3a4a8a";
      ctx.fillRect(px + 3, py + PLAYER_H - 10, 9, 10 + (legAnim > 0 ? legAnim : 0));
      ctx.fillRect(px + PLAYER_W - 12, py + PLAYER_H - 10, 9, 10 + (legAnim < 0 ? -legAnim : 0));

      ctx.restore();
    }

    function drawObstacles() {
      for (const o of gs.obstacles) {
        ctx.save();
        ctx.shadowColor = o.color;
        ctx.shadowBlur = 12;
        const grad = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h);
        grad.addColorStop(0, o.color);
        grad.addColorStop(1, `${o.color}88`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(o.x, o.y, o.w, o.h, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawCoins() {
      const now = performance.now() / 1000;
      for (const c of gs.coins_) {
        if (c.collected) continue;
        const glow = 0.6 + Math.sin(now * 3 + c.glowPhase) * 0.4;
        ctx.save();
        ctx.shadowColor = "#ffdd44";
        ctx.shadowBlur = 8 + glow * 10;

        const grad = ctx.createRadialGradient(c.x - 2, c.y - 2, 1, c.x, c.y, c.r);
        grad.addColorStop(0, "#fff8aa");
        grad.addColorStop(0.5, "#ffcc00");
        grad.addColorStop(1, "#cc8800");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#ffee88";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawRunUpgrades() {
      const now = performance.now() / 1000;
      for (const u of gs.runUpgrades) {
        if (u.active) continue;
        const bob = Math.sin(now * 2.5) * 4;
        const color = UPGRADE_COLORS[u.type];
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = color + "33";
        ctx.beginPath();
        ctx.arc(u.x, u.y + bob, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = "18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(UPGRADE_ICONS[u.type], u.x, u.y + bob);

        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = color;
        ctx.fillText(u.label, u.x, u.y + bob - 28);
        ctx.restore();
      }
    }

    function drawParticles() {
      for (const p of gs.particles) {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawHUD() {
      // score
      ctx.font = "bold 22px monospace";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.fillText(`${gs.score}m`, 16, 32);

      // coins
      ctx.font = "bold 18px monospace";
      ctx.fillStyle = "#ffdd44";
      ctx.fillText(`💰 ${gs.coins}`, 16, 58);

      // run coins
      ctx.font = "14px monospace";
      ctx.fillStyle = "#aaa";
      ctx.fillText(`+${gs.runCoins} this run`, 16, 78);

      // active upgrade icons
      let ix = W - 20;
      for (const upg of gs.activeUpgrades) {
        const color = UPGRADE_COLORS[upg];
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.font = "20px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(UPGRADE_ICONS[upg], ix, 36);
        ix -= 30;
        ctx.restore();
      }

      // controls hint
      ctx.font = "12px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "center";
      ctx.fillText("← → move   SPACE/↑ jump", W / 2, H - 8);
    }

    function drawDeadScreen() {
      // dim
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = "center";
      ctx.fillStyle = "#ff4455";
      ctx.font = "bold 48px monospace";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 60);

      ctx.font = "22px monospace";
      ctx.fillStyle = "#fff";
      ctx.fillText(`Distance: ${gs.score}m`, W / 2, H / 2 - 20);
      ctx.fillStyle = "#ffdd44";
      ctx.fillText(`Coins earned: ${gs.runCoins}`, W / 2, H / 2 + 10);
      ctx.fillStyle = "#aaa";
      ctx.fillText(`Total coins: ${gs.coins}`, W / 2, H / 2 + 38);

      // shop button
      ctx.fillStyle = "#4f7fff";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 100, H / 2 + 65, 200, 46, 10);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px monospace";
      ctx.fillText("🛒 SHOP", W / 2, H / 2 + 93);

      // restart button
      ctx.fillStyle = "#22aa55";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 100, H / 2 + 122, 200, 46, 10);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText("▶ RUN AGAIN", W / 2, H / 2 + 150);
    }

    function drawShop() {
      ctx.fillStyle = "#06070e";
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = "center";
      ctx.fillStyle = "#4f7fff";
      ctx.font = "bold 34px monospace";
      ctx.fillText("UPGRADE SHOP", W / 2, 50);

      ctx.fillStyle = "#ffdd44";
      ctx.font = "bold 20px monospace";
      ctx.fillText(`💰 ${gs.coins} coins`, W / 2, 85);

      const boxW = 210;
      const boxH = 110;
      const startX = W / 2 - (boxW * 3 + 20 * 2) / 2;

      PERM_UPGRADES.forEach((upg, i) => {
        const lvl = gs.permUpgrades[upg.key as keyof PermUpgrades];
        const cost = upg.cost(lvl);
        const canAfford = gs.coins >= cost;
        const bx = startX + i * (boxW + 20);
        const by = 120;

        ctx.fillStyle = canAfford ? "#1a2060" : "#111118";
        ctx.strokeStyle = canAfford ? "#4f7fff" : "#333";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 12);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 15px monospace";
        ctx.fillText(upg.label, bx + boxW / 2, by + 24);

        ctx.fillStyle = "#aaa";
        ctx.font = "12px monospace";
        ctx.fillText(upg.desc, bx + boxW / 2, by + 44);

        ctx.fillStyle = "#88aaff";
        ctx.font = "bold 13px monospace";
        ctx.fillText(`Level: ${lvl}`, bx + boxW / 2, by + 64);

        // buy btn
        ctx.fillStyle = canAfford ? "#2244cc" : "#222";
        ctx.beginPath();
        ctx.roundRect(bx + 20, by + 78, boxW - 40, 24, 6);
        ctx.fill();
        ctx.fillStyle = canAfford ? "#fff" : "#555";
        ctx.font = "bold 12px monospace";
        ctx.fillText(`BUY  ${cost}💰`, bx + boxW / 2, by + 94);
      });

      // run again
      ctx.fillStyle = "#22aa55";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 120, 260, 240, 50, 12);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("▶ START RUN", W / 2, 290);
    }

    // ── click handling ─────────────────────────────────────────────────────
    function getCanvasPos(e: MouseEvent): { x: number; y: number } {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function onClick(e: MouseEvent) {
      const { x, y } = getCanvasPos(e);

      if (gs.phase === "dead") {
        // shop button
        if (x >= W / 2 - 100 && x <= W / 2 + 100 && y >= H / 2 + 65 && y <= H / 2 + 111) {
          gs.phase = "shop";
          return;
        }
        // restart
        if (x >= W / 2 - 100 && x <= W / 2 + 100 && y >= H / 2 + 122 && y <= H / 2 + 168) {
          restartRef.current();
          return;
        }
      }

      if (gs.phase === "shop") {
        const boxW = 210;
        const startX = W / 2 - (boxW * 3 + 20 * 2) / 2;

        PERM_UPGRADES.forEach((upg, i) => {
          const lvl = gs.permUpgrades[upg.key as keyof PermUpgrades];
          const cost = upg.cost(lvl);
          const bx = startX + i * (boxW + 20);
          const by = 120;
          // buy btn
          if (x >= bx + 20 && x <= bx + boxW - 20 && y >= by + 78 && y <= by + 102) {
            if (gs.coins >= cost) {
              gs.coins -= cost;
              (gs.permUpgrades[upg.key as keyof PermUpgrades] as number)++;
            }
          }
        });

        // start run
        if (x >= W / 2 - 120 && x <= W / 2 + 120 && y >= 260 && y <= 310) {
          restartRef.current();
        }
      }
    }

    canvas.addEventListener("click", onClick);

    // ── main loop ──────────────────────────────────────────────────────────
    function loop(ts: number) {
      const dt = Math.min((ts - lastTime) / 16.67, 3);
      lastTime = ts;

      update(dt);

      // shake
      let sx = 0, sy = 0;
      if (gs.shakeMag > 0.5) {
        sx = (Math.random() - 0.5) * gs.shakeMag;
        sy = (Math.random() - 0.5) * gs.shakeMag;
      }
      ctx.save();
      ctx.translate(sx, sy);

      if (gs.phase === "shop") {
        drawShop();
      } else {
        drawBackground();
        drawObstacles();
        drawCoins();
        drawRunUpgrades();
        drawParticles();
        drawPlayer();
        drawHUD();
        if (gs.phase === "dead") drawDeadScreen();
      }

      ctx.restore();
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#06070e",
      padding: 16,
    }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          display: "block",
          width: "100%",
          maxWidth: W,
          borderRadius: 16,
          border: "2px solid rgba(79,127,255,0.4)",
          boxShadow: "0 0 40px rgba(79,127,255,0.25)",
          cursor: "default",
          touchAction: "none",
        }}
      />
      <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, marginTop: 10 }}>
        Arrow keys / WASD to move · SPACE / swipe up to jump
      </p>
    </div>
  );
}
