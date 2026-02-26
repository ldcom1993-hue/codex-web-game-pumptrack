const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const speedValue = document.getElementById("speedValue");
const scoreValue = document.getElementById("scoreValue");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const feedback = document.getElementById("feedback");
const rotateNotice = document.getElementById("rotateNotice");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const state = {
  running: false,
  over: false,
  t: 0,
  worldX: 0,
  vx: 2.6,
  vy: 0,
  riderY: 0,
  airborne: false,
  pumping: false,
  score: 0,
  streak: 0,
  remainingTime: 70,
  trickWindow: 0,
  justLanded: false,
  spring: 0,
  springV: 0,
  displaySpeed: 0,
  orientationBlocked: false,
};

const gravity = 0.42;
const baseDrive = 0.003;
const pumpForce = 0.02;
const slopeAssist = 0.028;
const drag = 0.0038;
const rollingResistance = 0.0016;
const minSpeed = 2.0;
const maxSpeed = 8.6;

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;
let skyClouds = [];
let skyBirds = [];

function createSkyCloud(index) {
  return {
    seed: index * 73.17 + 21.3,
    y: 0.11 + Math.random() * 0.26,
    width: 90 + Math.random() * 140,
    height: 22 + Math.random() * 36,
    parallax: 0.08 + Math.random() * 0.12,
    drift: 0.8 + Math.random() * 1.4,
    alpha: 0.14 + Math.random() * 0.2,
  };
}

function createSkyBird(index) {
  return {
    seed: index * 131.9 + 47.1,
    y: 0.13 + Math.random() * 0.24,
    parallax: 0.22 + Math.random() * 0.2,
    drift: 2 + Math.random() * 2.4,
    size: 10 + Math.random() * 8,
    flapSpeed: 0.004 + Math.random() * 0.003,
    flapPhase: Math.random() * Math.PI * 2,
    alpha: 0.35 + Math.random() * 0.35,
  };
}

function initSky() {
  skyClouds = Array.from({ length: 7 }, (_, index) => createSkyCloud(index));
  skyBirds = Array.from({ length: 5 }, (_, index) => createSkyBird(index));
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!skyClouds.length || !skyBirds.length) {
    initSky();
  }
}

function isLandscape() {
  return window.matchMedia("(orientation: landscape)").matches;
}

function handleOrientation() {
  const blocked = !isLandscape();
  state.orientationBlocked = blocked;
  rotateNotice.classList.toggle("visible", blocked);
  if (blocked) {
    state.pumping = false;
  }
}

function terrainY(worldX) {
  const base = height * 0.67;
  return (
    base +
    Math.sin(worldX * 0.0068) * 56 +
    Math.sin(worldX * 0.0032 + 0.8) * 30 +
    Math.sin(worldX * 0.0016 + 2.4) * 14
  );
}

function terrainSlope(worldX) {
  const dx = 8;
  return (terrainY(worldX + dx) - terrainY(worldX - dx)) / (dx * 2);
}

function showFeedback(text) {
  feedback.textContent = text;
  feedback.classList.add("visible");
  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(() => feedback.classList.remove("visible"), 780);
}

function startGame() {
  state.running = true;
  state.over = false;
  state.worldX = 0;
  state.vx = 2.6;
  state.vy = 0;
  state.riderY = terrainY(0) - 18;
  state.airborne = false;
  state.pumping = false;
  state.score = 0;
  state.streak = 0;
  state.remainingTime = 70;
  state.trickWindow = 0;
  state.justLanded = false;
  state.spring = 0;
  state.springV = 0;
  state.displaySpeed = 0;

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
  if (!state.running || state.orientationBlocked) return;

  if (!state.airborne) {
    state.pumping = active;
    if (!active && state.trickWindow > 0) {
      state.airborne = true;
      state.vy = -5.6 - Math.min(1.2, state.vx * 0.08);
      state.streak += 1;
      state.score += 35 * state.streak;
      showFeedback(`Float x${state.streak}`);
    }
  } else if (active) {
    state.score += 6;
    showFeedback("Style +6");
  }
}

function update(dt) {
  if (!state.running || state.orientationBlocked) return;

  state.remainingTime -= dt;
  if (state.remainingTime <= 0) {
    endGame();
    return;
  }

  const frontWheelX = state.worldX + 18;
  const groundY = terrainY(frontWheelX);
  const slope = terrainSlope(frontWheelX);
  const downhill = Math.max(0, slope);
  const uphill = Math.max(0, -slope);

  if (!state.airborne) {
    state.vx += baseDrive;
    state.vx += downhill * slopeAssist;
    state.vx -= uphill * rollingResistance;

    if (state.pumping) {
      state.vx += 0.006 + downhill * pumpForce;
      state.springV += 0.028;
      state.score += (0.24 + downhill * 0.8) * dt * 60;
    } else {
      state.vx -= drag;
      state.springV -= 0.012;
    }

    state.vx = Math.max(minSpeed, Math.min(maxSpeed, state.vx));
    state.worldX += state.vx;
    state.riderY = groundY - 18;

    state.trickWindow = slope < -0.16 ? 0.18 : Math.max(0, state.trickWindow - dt);

    if (state.justLanded) {
      state.score += 20 * Math.max(1, state.streak);
      showFeedback("Clean landing");
      state.justLanded = false;
    }
  } else {
    state.vy += gravity;
    state.worldX += state.vx * 0.92;
    state.riderY += state.vy;

    const landingGround = terrainY(state.worldX + 18);
    if (state.riderY >= landingGround - 18) {
      state.riderY = landingGround - 18;
      state.airborne = false;
      state.vy = 0;
      state.justLanded = true;
      state.vx = Math.max(minSpeed, state.vx - 0.16);
      state.springV -= 0.08;
    }
  }

  state.springV += (-state.spring * 13 - state.springV * 5.2) * dt;
  state.spring += state.springV * dt;

  state.displaySpeed += (state.vx - state.displaySpeed) * Math.min(1, dt * 6);

  state.score += state.vx * dt * 3.3;
  speedValue.textContent = state.displaySpeed.toFixed(1);
  scoreValue.textContent = Math.round(state.score);
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#101a35");
  grad.addColorStop(1, "#090e1d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(126, 231, 255, 0.06)";
  for (let i = 0; i < 4; i++) {
    const y = height * 0.16 + i * 88 + Math.sin(state.t * 0.0005 + i * 0.8) * 12;
    ctx.fillRect(0, y, width, 2);
  }

  drawSkyLayers();
}

function drawSkyLayers() {
  for (const cloud of skyClouds) {
    const travel = state.worldX * cloud.parallax + state.t * 0.001 * cloud.drift;
    const baseX = ((cloud.seed * 97 - travel) % (width + cloud.width * 2)) - cloud.width;
    const bob = Math.sin(state.t * 0.00045 + cloud.seed) * 10;
    const y = height * cloud.y + bob;
    drawCloud(baseX, y, cloud);
    drawCloud(baseX + width + cloud.width * 1.4, y, cloud);
  }

  for (const bird of skyBirds) {
    const travel = state.worldX * bird.parallax + state.t * 0.001 * bird.drift;
    const x = ((bird.seed * 61 - travel) % (width + 120)) - 60;
    const glide = Math.sin(state.t * 0.0012 + bird.seed * 0.4) * 14;
    const y = height * bird.y + glide;
    drawBird(x, y, bird);
    drawBird(x + width + 90, y, bird);
  }
}

function drawCloud(x, y, cloud) {
  const puff = cloud.width * 0.26;
  ctx.save();
  ctx.globalAlpha = cloud.alpha;
  ctx.fillStyle = "#dce9ff";
  ctx.beginPath();
  ctx.ellipse(x, y, cloud.width * 0.38, cloud.height * 0.6, 0, 0, Math.PI * 2);
  ctx.ellipse(x + puff, y - cloud.height * 0.18, cloud.width * 0.34, cloud.height * 0.56, 0, 0, Math.PI * 2);
  ctx.ellipse(x - puff, y - cloud.height * 0.12, cloud.width * 0.3, cloud.height * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBird(x, y, bird) {
  const flap = Math.sin(state.t * bird.flapSpeed + bird.flapPhase);
  const wingSpread = bird.size * (0.95 + Math.abs(flap) * 0.6);
  const wingDrop = bird.size * (0.16 + flap * 0.22);

  ctx.save();
  ctx.strokeStyle = `rgba(214, 232, 255, ${bird.alpha})`;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - wingSpread * 0.45, y - wingDrop, x - wingSpread, y + wingDrop * 0.6);
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + wingSpread * 0.45, y - wingDrop, x + wingSpread, y + wingDrop * 0.6);
  ctx.stroke();

  ctx.restore();
}

function drawTrack() {
  const screenPlayerX = width * 0.3;
  const startX = state.worldX - screenPlayerX - 80;
  const endX = startX + width + 160;

  ctx.beginPath();
  for (let x = 0; x <= width + 160; x += 10) {
    const worldX = startX + x;
    const y = terrainY(worldX);
    if (x === 0) ctx.moveTo(-80, y);
    else ctx.lineTo(x - 80, y);
  }

  ctx.lineTo(width + 80, height + 80);
  ctx.lineTo(-80, height + 80);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(0, height * 0.4, 0, height);
  fillGrad.addColorStop(0, "#243260");
  fillGrad.addColorStop(1, "#0f1730");
  ctx.fillStyle = fillGrad;
  ctx.fill();

  ctx.beginPath();
  for (let worldX = startX; worldX <= endX; worldX += 6) {
    const x = worldX - startX - 80;
    const y = terrainY(worldX);
    if (worldX === startX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#8fe8ff";
  ctx.stroke();
}

function drawRider() {
  const playerScreenX = width * 0.3;
  const slope = terrainSlope(state.worldX + 18);
  const slopeLean = Math.max(-0.33, Math.min(0.33, slope * 0.44));
  const pumpLean = state.pumping ? 0.1 : 0;
  const airLean = state.airborne ? state.vy * 0.02 : 0;
  const lean = slopeLean + pumpLean + airLean;
  const compress = Math.max(-6, Math.min(6, state.spring * 140));
  const pedalPhase = state.worldX * 0.16 + state.t * 0.018;
  const pedalRadius = 5.5;
  const crankX = -2;
  const crankY = 10;
  const footFront = {
    x: crankX + Math.cos(pedalPhase) * pedalRadius,
    y: crankY + Math.sin(pedalPhase) * pedalRadius,
  };
  const footBack = {
    x: crankX + Math.cos(pedalPhase + Math.PI) * pedalRadius,
    y: crankY + Math.sin(pedalPhase + Math.PI) * pedalRadius,
  };

  ctx.save();
  ctx.translate(playerScreenX, state.riderY + compress);
  ctx.rotate(lean);

  const torsoTilt = state.airborne ? -2 : 0;
  const shoulder = { x: 1, y: -8 + torsoTilt };
  const hip = { x: -1, y: 0 };
  const seat = { x: -8, y: 5 };
  const frontWheel = { x: 14, y: 16 };
  const rearWheel = { x: -14, y: 16 };
  const handlebar = { x: 11, y: 2 };
  const pedalColor = "#9dafff";

  ctx.strokeStyle = "rgba(143, 232, 255, 0.2)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(crankX, crankY, pedalRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#8fe8ff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(rearWheel.x, rearWheel.y);
  ctx.lineTo(seat.x, seat.y);
  ctx.lineTo(frontWheel.x, frontWheel.y);
  ctx.closePath();
  ctx.moveTo(seat.x, seat.y);
  ctx.lineTo(handlebar.x, handlebar.y);
  ctx.moveTo(crankX, crankY);
  ctx.lineTo(frontWheel.x, frontWheel.y);
  ctx.stroke();

  ctx.strokeStyle = "#ecf3ff";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(frontWheel.x, frontWheel.y, 7, 0, Math.PI * 2);
  ctx.arc(rearWheel.x, rearWheel.y, 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = pedalColor;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(crankX, crankY);
  ctx.lineTo(footFront.x, footFront.y);
  ctx.moveTo(crankX, crankY);
  ctx.lineTo(footBack.x, footBack.y);
  ctx.stroke();

  ctx.strokeStyle = "#7ee7ff";
  ctx.lineWidth = 4.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.stroke();

  ctx.fillStyle = "#d9e7ff";
  ctx.beginPath();
  ctx.arc(2, -20 + torsoTilt, 7.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#9dafff";
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(handlebar.x - 1, handlebar.y + 1);
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(footFront.x, footFront.y);
  ctx.moveTo(hip.x + 0.8, hip.y + 0.4);
  ctx.lineTo(footBack.x, footBack.y);
  ctx.stroke();

  ctx.strokeStyle = "#d9e7ff";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(handlebar.x - 3, handlebar.y - 1.5);
  ctx.lineTo(handlebar.x + 2.8, handlebar.y - 1.5);
  ctx.moveTo(seat.x - 2.5, seat.y - 1.2);
  ctx.lineTo(seat.x + 1.5, seat.y - 1.2);
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

  handleOrientation();
  update(dt);
  drawBackground();

  if (!state.orientationBlocked) {
    drawTrack();
    drawRider();
    if (state.running) drawTimer();
  }

  requestAnimationFrame(frame);
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);

window.addEventListener("pointerdown", () => onPress(true), { passive: true });
window.addEventListener("pointerup", () => onPress(false), { passive: true });
window.addEventListener("pointercancel", () => onPress(false), { passive: true });
window.addEventListener("resize", () => {
  resize();
  handleOrientation();
});

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
handleOrientation();
requestAnimationFrame(frame);
