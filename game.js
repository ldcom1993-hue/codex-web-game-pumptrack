const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const speedValue = document.getElementById("speedValue");
const scoreValue = document.getElementById("scoreValue");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const feedback = document.getElementById("feedback");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const state = {
  running: false,
  over: false,
  t: 0,
  worldX: 0,
  speed: 4.4,
  vx: 4.4,
  vy: 0,
  riderY: 0,
  airborne: false,
  pumping: false,
  score: 0,
  streak: 0,
  remainingTime: 60,
  trickWindow: 0,
  justLanded: false,
};

const gravity = 0.6;
const pumpForce = 0.035;
const slopeBoost = 0.08;
const drag = 0.005;
const minSpeed = 2.2;
const maxSpeed = 12;

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function terrainY(worldX) {
  const base = height * 0.62;
  return (
    base +
    Math.sin(worldX * 0.016) * 74 +
    Math.sin(worldX * 0.031 + 1.2) * 26 +
    Math.sin(worldX * 0.006) * 18
  );
}

function terrainSlope(worldX) {
  const dx = 2;
  return (terrainY(worldX + dx) - terrainY(worldX - dx)) / (dx * 2);
}

function showFeedback(text) {
  feedback.textContent = text;
  feedback.classList.add("visible");
  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(() => feedback.classList.remove("visible"), 700);
}

function startGame() {
  state.running = true;
  state.over = false;
  state.worldX = 0;
  state.speed = 4.4;
  state.vx = 4.4;
  state.vy = 0;
  state.riderY = terrainY(0) - 18;
  state.airborne = false;
  state.pumping = false;
  state.score = 0;
  state.streak = 0;
  state.remainingTime = 60;
  state.trickWindow = 0;
  state.justLanded = false;

  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  hud.classList.remove("hidden");
}

function endGame() {
  state.running = false;
  state.over = true;
  state.pumping = false;
  finalScore.textContent = Math.round(state.score);
  gameOverScreen.classList.add("visible");
}

function onPress(active) {
  if (!state.running) return;
  if (!state.airborne) {
    state.pumping = active;
    if (!active && state.trickWindow > 0) {
      state.airborne = true;
      state.vy = -7 - Math.min(2.2, state.speed * 0.12);
      state.streak += 1;
      state.score += 50 * state.streak;
      showFeedback(`Pop! x${state.streak}`);
    }
  } else if (active) {
    state.score += 8;
    showFeedback("Style +8");
  }
}

function update(dt) {
  if (!state.running) return;

  state.remainingTime -= dt;
  if (state.remainingTime <= 0) {
    endGame();
    return;
  }

  const frontWheelX = state.worldX + 14;
  const groundY = terrainY(frontWheelX);
  const slope = terrainSlope(frontWheelX);
  const downhill = Math.max(0, slope);

  if (!state.airborne) {
    state.vx += downhill * slopeBoost;

    if (state.pumping) {
      state.vx += downhill * pumpForce + 0.015;
      state.score += (0.35 + downhill * 1.5) * dt * 60;
    } else {
      state.vx -= drag;
    }

    state.vx = Math.max(minSpeed, Math.min(maxSpeed, state.vx));
    state.worldX += state.vx;
    state.riderY = groundY - 18;

    state.trickWindow = slope < -0.25 ? 0.16 : Math.max(0, state.trickWindow - dt);

    if (state.justLanded) {
      state.score += 25 * Math.max(1, state.streak);
      showFeedback("Smooth landing");
      state.justLanded = false;
    }
  } else {
    state.vy += gravity;
    state.worldX += state.vx * 0.94;
    state.riderY += state.vy;

    const landingGround = terrainY(state.worldX + 14);
    if (state.riderY >= landingGround - 18) {
      state.riderY = landingGround - 18;
      state.airborne = false;
      state.vy = 0;
      state.justLanded = true;
      state.vx = Math.max(minSpeed, state.vx - 0.3);
    }
  }

  state.score += state.vx * dt * 4;
  speedValue.textContent = state.vx.toFixed(1);
  scoreValue.textContent = Math.round(state.score);
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#121c3a");
  grad.addColorStop(1, "#090d1a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(126, 231, 255, 0.08)";
  for (let i = 0; i < 4; i++) {
    const y = (height * 0.15) + i * 80 + Math.sin(state.t * 0.001 + i) * 16;
    ctx.fillRect(0, y, width, 2);
  }
}

function drawTrack() {
  const screenPlayerX = width * 0.34;
  const startX = state.worldX - screenPlayerX - 40;
  const endX = startX + width + 80;

  ctx.beginPath();
  for (let x = 0; x <= width + 80; x += 8) {
    const worldX = startX + x;
    const y = terrainY(worldX);
    if (x === 0) ctx.moveTo(-40, y);
    else ctx.lineTo(x - 40, y);
  }

  ctx.lineTo(width + 40, height + 60);
  ctx.lineTo(-40, height + 60);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(0, height * 0.35, 0, height);
  fillGrad.addColorStop(0, "#27356a");
  fillGrad.addColorStop(1, "#101731");
  ctx.fillStyle = fillGrad;
  ctx.fill();

  ctx.beginPath();
  for (let worldX = startX; worldX <= endX; worldX += 4) {
    const x = worldX - startX - 40;
    const y = terrainY(worldX);
    if (worldX === startX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#8fe8ff";
  ctx.stroke();
}

function drawRider() {
  const playerScreenX = width * 0.34;
  const slope = terrainSlope(state.worldX + 14);
  const lean = Math.max(-0.45, Math.min(0.45, slope * 0.55 + (state.pumping ? 0.18 : 0)));

  ctx.save();
  ctx.translate(playerScreenX, state.riderY);

  if (!state.airborne) {
    ctx.rotate(lean);
  } else {
    ctx.rotate(lean + state.vy * 0.035);
  }

  ctx.fillStyle = "#d9e7ff";
  ctx.beginPath();
  ctx.arc(0, -22, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7ee7ff";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(0, 3);
  ctx.stroke();

  ctx.strokeStyle = "#9dafff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(10, -2);
  ctx.moveTo(0, 3);
  ctx.lineTo(-8, 12);
  ctx.lineTo(11, 13);
  ctx.stroke();

  ctx.strokeStyle = "#ecf3ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, 14);
  ctx.lineTo(15, 14);
  ctx.stroke();

  ctx.restore();
}

function drawTimer() {
  ctx.fillStyle = "rgba(236, 243, 255, 0.85)";
  ctx.font = "600 16px Inter, system-ui";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.ceil(state.remainingTime)}s`, width - 16, height - 20);
}

function frame(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;
  state.t = ts;

  update(dt);
  drawBackground();
  drawTrack();
  drawRider();
  if (state.running) drawTimer();

  requestAnimationFrame(frame);
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

window.addEventListener("pointerdown", () => onPress(true), { passive: true });
window.addEventListener("pointerup", () => onPress(false), { passive: true });
window.addEventListener("pointercancel", () => onPress(false), { passive: true });
window.addEventListener("resize", resize);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.error("SW registration failed", error);
    }
  });
}

resize();
requestAnimationFrame(frame);
