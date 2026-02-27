const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const totalScore = document.getElementById("totalScore");
const timerValue = document.getElementById("timerValue");
const comboBankValue = document.getElementById("comboBankValue");
const comboBubble = document.getElementById("comboBubble");
const distanceValue = document.getElementById("distanceValue");
const speedValue = document.getElementById("speedValue");
const floatingLayer = document.getElementById("floatingLayer");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const bestCombo = document.getElementById("bestCombo");
const rotateNotice = document.getElementById("rotateNotice");

const easyModeButton = document.getElementById("easyModeButton");
const riderModeButton = document.getElementById("riderModeButton");
const restartButton = document.getElementById("restartButton");
const menuButton = document.getElementById("menuButton");

const menuToggle = document.getElementById("menuToggle");
const runMenu = document.getElementById("runMenu");
const runMenuClose = document.getElementById("runMenuClose");
const menuRestart = document.getElementById("menuRestart");
const menuBestScore = document.getElementById("menuBestScore");
const menuChangeMode = document.getElementById("menuChangeMode");

const MODES = {
  EASY: "easy",
  RIDER: "rider",
};

const RUN_DURATION = 60;
const COMBO_TIMEOUT = 1.8;
const BEST_SCORE_KEY = "flowline-rider-v0.13.1-best-score";

const physics = {
  gravity: 28,
  pedalAccel: 3,
  rollingFriction: 1.9,
  airDrag: 0.14,
  minSpeed: 2,
  maxSpeed: 17.2,
  maxVisibleJumpVy: 14,
  chargeCapSeconds: 1,
  jumpBaseImpulse: 6.4,
  jumpChargeImpulse: 6.8,
  airbornePitchDamping: 2.8,
  uprightStiffness: 23,
  uprightDamping: 8.4,
  suspensionStiffness: 26,
  suspensionDamping: 9.4,
  hardCrashPitch: 1.35,
  hardCrashAngular: 8.8,
  recoverablePitch: 0.88,
  recoverableAngular: 6.4,
};

const rider = {
  wheelRadius: 11,
  wheelBase: 42,
  bodyHeight: 23,
  comHeight: 27,
};

const terrainConfig = {
  lengthMultiplier: 1,
  hillHeightMultiplier: 1,
  hillSpacingMultiplier: 1.19,
};

const cameraConfig = {
  followSmoothness: 1,
  zoomLevel: 0.89,
};

const state = {
  mode: MODES.RIDER,
  running: false,
  over: false,
  orientationBlocked: false,
  worldX: 0,
  riderY: 0,
  vx: 9,
  vy: 0,
  airborne: false,
  holdActive: false,
  pedaling: false,
  descending: false,
  supermanActive: false,
  supermanBlend: 0,
  supermanHoldTime: 0,
  jumpAirTime: 0,
  charge: 0,
  chargeRatio: 0,
  angle: 0,
  angularVelocity: 0,
  terrainAngle: 0,
  totalScore: 0,
  comboCount: 0,
  comboMultiplier: 1,
  comboBank: 0,
  comboGraceTimer: 0,
  bestComboMultiplier: 1,
  displaySpeed: 0,
  distanceMeters: 0,
  jumpStartY: 0,
  jumpStartX: 0,
  jumpPeakY: 0,
  jumpFromBump: false,
  suspension: 0,
  suspensionVel: 0,
  clock: 0,
  cameraWorldX: 0,
  timeLeft: RUN_DURATION,
};

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;
let runMenuOpen = false;
let bestScore = 0;
const floatingScores = [];

function isLandscape() {
  return window.matchMedia("(orientation: landscape)").matches;
}

function isEasyMode() {
  return state.mode === MODES.EASY;
}

function isRiderMode() {
  return state.mode === MODES.RIDER;
}

function handleOrientation() {
  const blocked = !isLandscape();
  state.orientationBlocked = blocked;
  rotateNotice.classList.toggle("visible", blocked);
  if (blocked) {
    state.holdActive = false;
    state.pedaling = false;
  }
}

function terrainY(worldX) {
  const sampleX = worldX / terrainConfig.lengthMultiplier;
  const spacingScale = 1 / terrainConfig.hillSpacingMultiplier;
  const base = height * 0.69;
  return (
    base +
    (Math.sin(sampleX * 0.0082 * spacingScale) * 44 +
      Math.sin(sampleX * 0.004 * spacingScale + 0.54) * 32 +
      Math.sin(sampleX * 0.0018 * spacingScale + 1.9) * 16) *
      terrainConfig.hillHeightMultiplier
  );
}

function terrainSlope(worldX) {
  const dx = 8;
  return (terrainY(worldX + dx) - terrainY(worldX - dx)) / (2 * dx);
}

function terrainAngle(worldX) {
  return Math.atan(terrainSlope(worldX));
}

function normalizeAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function loadBestScore() {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const parsed = Number(raw);
  bestScore = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function saveBestScore() {
  localStorage.setItem(BEST_SCORE_KEY, String(Math.round(bestScore)));
}

function refreshBestScoreButton() {
  menuBestScore.textContent = `Best Score: ${Math.round(bestScore)}`;
}

function openRunMenu() {
  runMenuOpen = true;
  runMenu.classList.add("visible");
  runMenu.setAttribute("aria-hidden", "false");
  refreshBestScoreButton();
}

function closeRunMenu() {
  runMenuOpen = false;
  runMenu.classList.remove("visible");
  runMenu.setAttribute("aria-hidden", "true");
}

function resetCombo() {
  state.comboCount = 0;
  state.comboMultiplier = 1;
  state.comboBank = 0;
  state.comboGraceTimer = 0;
  comboBubble.classList.remove("visible");
}

function resetRun(mode = state.mode) {
  state.mode = mode;
  state.over = false;
  state.running = true;
  state.worldX = 0;
  state.cameraWorldX = 0;
  state.vx = 9;
  state.vy = 0;
  state.airborne = false;
  state.holdActive = false;
  state.pedaling = false;
  state.descending = false;
  state.supermanActive = false;
  state.supermanBlend = 0;
  state.supermanHoldTime = 0;
  state.jumpAirTime = 0;
  state.charge = 0;
  state.chargeRatio = 0;
  state.angle = terrainAngle(0);
  state.angularVelocity = 0;
  state.terrainAngle = state.angle;
  state.riderY = terrainY(0) - rider.wheelRadius - rider.bodyHeight;
  state.totalScore = 0;
  state.bestComboMultiplier = 1;
  state.displaySpeed = 0;
  state.distanceMeters = 0;
  state.jumpStartY = state.riderY;
  state.jumpStartX = state.worldX;
  state.jumpPeakY = state.riderY;
  state.jumpFromBump = false;
  state.suspension = 0;
  state.suspensionVel = 0;
  state.clock = 0;
  state.timeLeft = RUN_DURATION;
  floatingScores.length = 0;
  floatingLayer.innerHTML = "";

  closeRunMenu();
  resetCombo();
  updateHud();
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  hud.classList.remove("hidden");
}

function showMenu() {
  state.running = false;
  state.over = false;
  closeRunMenu();
  resetCombo();
  hud.classList.add("hidden");
  gameOverScreen.classList.remove("visible");
  startScreen.classList.add("visible");
}

function endRun() {
  payoutCombo(true);
  state.running = false;
  state.over = true;
  state.holdActive = false;
  state.pedaling = false;
  state.charge = 0;
  state.chargeRatio = 0;

  if (state.totalScore > bestScore) {
    bestScore = state.totalScore;
    saveBestScore();
    refreshBestScoreButton();
  }

  finalScore.textContent = Math.round(state.totalScore);
  bestCombo.textContent = `x${state.bestComboMultiplier}`;
  gameOverScreen.classList.add("visible");
}

function addFloatingScore(text, worldX, worldY) {
  const node = document.createElement("div");
  node.className = "floating-score";
  node.textContent = text;
  floatingLayer.appendChild(node);

  floatingScores.push({
    node,
    worldX,
    worldY,
    age: 0,
    ttl: 1,
    drift: 30,
  });
}

function updateFloatingScores(dt) {
  const playerScreenX = width * 0.3;
  const startX = state.cameraWorldX - playerScreenX;

  for (let i = floatingScores.length - 1; i >= 0; i -= 1) {
    const item = floatingScores[i];
    item.age += dt;
    const progress = Math.min(1, item.age / item.ttl);
    const x = item.worldX - startX;
    const y = item.worldY - progress * item.drift;

    item.node.style.left = `${x}px`;
    item.node.style.top = `${y}px`;
    item.node.style.opacity = String(1 - progress);

    if (item.age >= item.ttl) {
      item.node.remove();
      floatingScores.splice(i, 1);
    }
  }
}

function updateComboBubble() {
  if (state.comboCount > 0) {
    comboBubble.textContent = `x${state.comboMultiplier}`;
    comboBubble.classList.add("visible");
  } else {
    comboBubble.classList.remove("visible");
  }
}

function payoutCombo(force = false) {
  if (state.comboCount <= 0 || state.comboBank <= 0) {
    if (force) resetCombo();
    return;
  }

  if (!force && state.comboGraceTimer > 0) return;

  const payout = state.comboBank * state.comboMultiplier;
  state.totalScore += payout;
  animateComboPayout(payout);
  resetCombo();
  updateHud();
}

function onPressStart() {
  if (!state.running || state.orientationBlocked || runMenuOpen) return;
  state.holdActive = true;

  if (isRiderMode() && state.airborne && !state.descending) {
    state.supermanActive = true;
  }
}

function applyJumpFromCharge() {
  if (state.chargeRatio <= 0.04) return;

  const jumpImpulse = Math.min(
    physics.maxVisibleJumpVy,
    physics.jumpBaseImpulse + physics.jumpChargeImpulse * state.chargeRatio
  );

  state.airborne = true;
  state.vy = -jumpImpulse;
  state.pedaling = false;
  state.descending = false;
  state.supermanActive = false;
  state.supermanBlend = 0;
  state.supermanHoldTime = 0;
  state.jumpAirTime = 0;
  state.jumpStartY = state.riderY;
  state.jumpPeakY = state.riderY;
  state.jumpStartX = state.worldX;
  state.jumpFromBump = true;
  state.charge = 0;
  state.chargeRatio = 0;

  const riderTop = state.riderY - 34;
  if (riderTop < 24) state.vy = Math.min(state.vy, -4.2);
}

function onPressEnd() {
  if (!state.running || state.orientationBlocked || runMenuOpen) return;
  state.holdActive = false;

  if (state.airborne) {
    state.supermanActive = false;
    state.pedaling = false;
    return;
  }

  applyJumpFromCharge();
  if (!state.airborne) {
    state.charge = 0;
    state.chargeRatio = 0;
    state.pedaling = false;
  }
}

function updateCharge(dt, canCharge) {
  state.pedaling = state.holdActive && canCharge;
  if (state.pedaling) state.charge = Math.min(physics.chargeCapSeconds, state.charge + dt);
  state.chargeRatio += (Math.min(1, state.charge / physics.chargeCapSeconds) - state.chargeRatio) * Math.min(1, dt * 16);
}

function updateGroundPhysics(dt) {
  const centerX = state.worldX;
  const slope = terrainSlope(centerX);
  const slopeNorm = Math.sqrt(1 + slope * slope);
  const gravityAlong = (physics.gravity * slope) / slopeNorm;

  state.vx += gravityAlong * dt;

  updateCharge(dt, true);
  if (state.pedaling) state.vx += physics.pedalAccel * dt;

  const friction = physics.rollingFriction * dt;
  if (state.vx > friction) state.vx -= friction;
  else if (state.vx < -friction) state.vx += friction;
  else state.vx = 0;

  state.vx = Math.max(physics.minSpeed, Math.min(physics.maxSpeed, state.vx));
  state.worldX += state.vx * dt * 60;

  state.terrainAngle = terrainAngle(state.worldX);
  state.riderY = terrainY(state.worldX) - rider.wheelRadius - rider.bodyHeight;

  const crouchBias = state.pedaling ? state.chargeRatio * 0.18 : 0;
  const targetAngle = state.terrainAngle - crouchBias;
  const angleError = normalizeAngle(targetAngle - state.angle);
  const stabilizeTorque = angleError * physics.uprightStiffness - state.angularVelocity * physics.uprightDamping;

  state.angularVelocity += stabilizeTorque * dt;
  state.angle += state.angularVelocity * dt;

  if (isEasyMode()) {
    state.angle += normalizeAngle(state.terrainAngle - state.angle) * Math.min(1, dt * 8.5);
    state.angularVelocity *= Math.max(0, 1 - dt * 8);
  }
}

function computeJumpScore() {
  const jumpHeight = Math.max(0, state.jumpStartY - state.jumpPeakY);
  const normalizedHeight = Math.min(1, jumpHeight / 70);
  const normalizedAirtime = Math.min(1, state.jumpAirTime / 1.2);
  const weighted = normalizedHeight * 0.65 + normalizedAirtime * 0.35;
  const curved = Math.pow(weighted, 0.72);

  let jumpAward = 10 + curved * 40;
  if (isRiderMode()) jumpAward += Math.min(10, state.supermanHoldTime * 9.5);
  return Math.max(10, Math.min(50, jumpAward));
}

function animateComboPayout(payout) {
  const source = comboBankValue.getBoundingClientRect();
  const target = totalScore.getBoundingClientRect();
  const node = document.createElement("div");
  node.className = "combo-transfer";
  node.textContent = `+${Math.round(payout)}`;
  node.style.left = `${source.left}px`;
  node.style.top = `${source.top}px`;
  floatingLayer.appendChild(node);

  requestAnimationFrame(() => {
    node.style.transform = `translate(${target.left - source.left}px, ${target.top - source.top}px)`;
    node.style.opacity = "0";
  });

  setTimeout(() => node.remove(), 560);
}

function evaluateLanding() {
  const terrain = terrainAngle(state.worldX);
  const pitchDelta = normalizeAngle(state.angle - terrain);
  const angVel = Math.abs(state.angularVelocity);

  if (isRiderMode()) {
    if (state.supermanBlend > 0.25 || state.supermanActive) {
      endRun();
      return;
    }

    if (
      Math.abs(pitchDelta) > physics.hardCrashPitch ||
      angVel > physics.hardCrashAngular ||
      (Math.abs(pitchDelta) > physics.recoverablePitch && angVel > physics.recoverableAngular)
    ) {
      endRun();
      return;
    }
  }

  state.airborne = false;
  state.vy = 0;
  state.riderY = terrainY(state.worldX) - rider.wheelRadius - rider.bodyHeight;
  state.terrainAngle = terrain;
  state.suspensionVel -= 1.8;

  const landedOnDescendingSlope = terrainSlope(state.worldX) < -0.02;
  const validScoreJump = state.jumpFromBump && landedOnDescendingSlope;

  if (validScoreJump) {
    const jumpAward = computeJumpScore();
    state.comboCount += 1;
    state.comboMultiplier = Math.max(1, state.comboCount);
    state.bestComboMultiplier = Math.max(state.bestComboMultiplier, state.comboMultiplier);
    state.comboBank += jumpAward;
    state.comboGraceTimer = COMBO_TIMEOUT;
    addFloatingScore(`+${Math.round(jumpAward)}`, state.worldX - 18, state.riderY - 30);
  } else if (state.comboCount > 0) {
    state.comboGraceTimer = 0;
    payoutCombo();
  }

  updateComboBubble();
  state.supermanHoldTime = 0;
  state.jumpAirTime = 0;
  state.jumpFromBump = false;

  if (state.holdActive) {
    updateCharge(0.016, true);
  } else {
    state.pedaling = false;
    state.charge = 0;
    state.chargeRatio = 0;
  }
}

function updateAirPhysics(dt) {
  state.vy += physics.gravity * dt;
  state.descending = state.vy > 0;
  state.jumpAirTime += dt;
  state.jumpPeakY = Math.min(state.jumpPeakY, state.riderY);

  if (!state.holdActive || isEasyMode()) state.supermanActive = false;
  if (state.supermanActive) state.supermanHoldTime += dt;

  const supermanTarget = state.supermanActive ? 1 : 0;
  const blendRate = state.supermanActive ? 8 : 18;
  state.supermanBlend += (supermanTarget - state.supermanBlend) * Math.min(1, dt * blendRate);

  updateCharge(dt, state.descending);

  state.angularVelocity *= Math.max(0, 1 - physics.airbornePitchDamping * dt);
  state.angle += state.angularVelocity * dt;

  if (isEasyMode()) {
    state.angle += normalizeAngle(state.terrainAngle - state.angle) * Math.min(1, dt * 4.8);
    state.angularVelocity *= Math.max(0, 1 - dt * 4);
  }

  state.vx = Math.max(physics.minSpeed, state.vx - physics.airDrag * dt);
  state.worldX += state.vx * dt * 60;
  state.riderY += state.vy * dt * 60;

  const groundY = terrainY(state.worldX) - rider.wheelRadius - rider.bodyHeight;
  if (state.riderY >= groundY) {
    state.riderY = groundY;
    evaluateLanding();
  }
}

function updateSuspension(dt) {
  state.suspensionVel +=
    (-state.suspension * physics.suspensionStiffness - state.suspensionVel * physics.suspensionDamping) * dt;
  state.suspension += state.suspensionVel * dt;
}

function updateHud() {
  totalScore.textContent = Math.round(state.totalScore);
  comboBankValue.textContent = Math.round(state.comboBank);
  timerValue.textContent = `${Math.max(0, state.timeLeft).toFixed(1)} s`;
  distanceValue.textContent = `${Math.round(state.distanceMeters)} m`;
  speedValue.textContent = `${state.displaySpeed.toFixed(1)} m/s`;
  updateComboBubble();
}

function updateCamera(dt) {
  const t = Math.min(1, dt * 60 * cameraConfig.followSmoothness);
  state.cameraWorldX += (state.worldX - state.cameraWorldX) * t;
}

function update(dt) {
  if (!state.running || state.orientationBlocked || runMenuOpen) return;

  state.clock += dt;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  state.displaySpeed += (state.vx - state.displaySpeed) * Math.min(1, dt * 8);

  if (state.airborne) updateAirPhysics(dt);
  else updateGroundPhysics(dt);

  if (!state.running) return;

  if (state.comboGraceTimer > 0) {
    state.comboGraceTimer -= dt;
    if (state.comboGraceTimer <= 0) payoutCombo();
  }

  const riderTop = state.riderY - 40;
  if (riderTop < 10 && state.vy < -3.6) state.vy = -3.6;

  state.distanceMeters += (state.vx * dt * 60) / 10;

  updateSuspension(dt);
  updateCamera(dt);
  updateFloatingScores(dt);
  updateHud();

  if (state.timeLeft <= 0) endRun();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#0d1732");
  grad.addColorStop(0.55, "#0a1227");
  grad.addColorStop(1, "#090e1d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(135, 179, 113, 0.16)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.68);
  for (let x = 0; x <= width; x += 8) {
    const y = height * 0.68 + Math.sin((x + state.clock * 26) * 0.005) * 8;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(162, 196, 142, 0.14)";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.76);
  for (let x = 0; x <= width; x += 10) {
    const y = height * 0.76 + Math.sin((x + 120 + state.clock * 18) * 0.004) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
}

function drawTrack() {
  const playerScreenX = width * 0.3;
  const startX = state.cameraWorldX - playerScreenX - 120;

  ctx.beginPath();
  for (let x = 0; x <= width + 240; x += 8) {
    const world = startX + x;
    const y = terrainY(world);
    if (x === 0) ctx.moveTo(-120, y);
    else ctx.lineTo(x - 120, y);
  }

  ctx.lineTo(width + 120, height + 120);
  ctx.lineTo(-120, height + 120);
  ctx.closePath();

  const fill = ctx.createLinearGradient(0, height * 0.44, 0, height);
  fill.addColorStop(0, "#2f4e2f");
  fill.addColorStop(1, "#18291d");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  for (let world = startX; world <= startX + width + 240; world += 4) {
    const x = world - startX - 120;
    const y = terrainY(world);
    if (world === startX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#bde5b6";
  ctx.stroke();
}

function drawChargeAboveRider(playerX, riderY) {
  if (state.chargeRatio <= 0.01 && !state.pedaling) return;

  const barWidth = 74;
  const barHeight = 8;
  const x = playerX - barWidth * 0.5;
  const y = riderY - 58;

  ctx.fillStyle = "rgba(10, 16, 28, 0.75)";
  ctx.strokeStyle = "rgba(236,243,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, barWidth, barHeight, 99);
  ctx.fill();
  ctx.stroke();

  const fillW = Math.max(0, Math.min(barWidth, barWidth * state.chargeRatio));
  const fillGrad = ctx.createLinearGradient(x, y, x + barWidth, y);
  fillGrad.addColorStop(0, "#7ee7ff");
  fillGrad.addColorStop(1, "#a0ffcb");

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, fillW, barHeight, 99);
  ctx.fill();
}

function drawRider() {
  const playerScreenX = width * 0.3;
  const riderScreenX = state.worldX - state.cameraWorldX + playerScreenX;
  const compress = Math.max(-8, Math.min(8, state.suspension * 120));
  const riderY = state.riderY + compress;

  const pedalSpeed = state.pedaling ? 8 : 2.6;
  const pedalPhase = state.clock * pedalSpeed;
  const crouch = state.pedaling && !state.airborne ? state.chargeRatio * 6 : 0;
  const extend = state.airborne ? Math.max(-2.8, -state.vy * 0.11) : 0;
  const superman = isRiderMode() ? state.supermanBlend : 0;

  const frontWheel = { x: 16, y: 16 };
  const rearWheel = { x: -16, y: 16 };
  const crank = { x: -1, y: 10 };
  const pedalRadius = 6;

  const footFront = {
    x: crank.x + Math.cos(pedalPhase) * pedalRadius,
    y: crank.y + Math.sin(pedalPhase) * pedalRadius,
  };
  const footBack = {
    x: crank.x + Math.cos(pedalPhase + Math.PI) * pedalRadius,
    y: crank.y + Math.sin(pedalPhase + Math.PI) * pedalRadius,
  };

  ctx.save();
  ctx.translate(riderScreenX, riderY);
  ctx.rotate(state.angle);

  const hip = { x: -1 - superman * 12, y: -crouch + extend + superman * 2.2 };
  const shoulder = { x: 2 - superman * 20, y: -11 - crouch * 0.65 + extend * 0.45 + superman * 2.8 };
  const head = { x: 4 - superman * 28, y: -22 - crouch * 0.3 + extend * 0.55 + superman * 3.2 };
  const handlebar = { x: 12, y: 2 };
  const seat = { x: -8, y: 5 };
  const supermanReach = {
    x: shoulder.x - 15 - superman * 8,
    y: shoulder.y + 1.5 + superman * 0.8,
  };
  const supermanLegFront = {
    x: hip.x - 17 - superman * 7,
    y: hip.y + 7 + superman * 1.3,
  };
  const supermanLegBack = {
    x: hip.x - 21 - superman * 7.5,
    y: hip.y + 8.8 + superman * 1.4,
  };

  ctx.strokeStyle = "#8fe8ff";
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(rearWheel.x, rearWheel.y);
  ctx.lineTo(seat.x, seat.y);
  ctx.lineTo(frontWheel.x, frontWheel.y);
  ctx.closePath();
  ctx.moveTo(seat.x, seat.y);
  ctx.lineTo(handlebar.x, handlebar.y);
  ctx.moveTo(crank.x, crank.y);
  ctx.lineTo(frontWheel.x, frontWheel.y);
  ctx.stroke();

  ctx.strokeStyle = "#ecf3ff";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(frontWheel.x, frontWheel.y, rider.wheelRadius * 0.58, 0, Math.PI * 2);
  ctx.arc(rearWheel.x, rearWheel.y, rider.wheelRadius * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#9dafff";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(crank.x, crank.y);
  ctx.lineTo(footFront.x, footFront.y);
  ctx.moveTo(crank.x, crank.y);
  ctx.lineTo(footBack.x, footBack.y);
  ctx.stroke();

  ctx.strokeStyle = "#7ee7ff";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.stroke();

  ctx.fillStyle = "#d9e7ff";
  ctx.beginPath();
  ctx.arc(head.x, head.y, 7.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#9dafff";
  ctx.lineWidth = 3.7;
  ctx.beginPath();
  const armFront = {
    x: (handlebar.x - 1) * (1 - superman) + supermanReach.x * superman,
    y: (handlebar.y + 1) * (1 - superman) + supermanReach.y * superman,
  };
  const legFront = {
    x: footFront.x * (1 - superman) + supermanLegFront.x * superman,
    y: footFront.y * (1 - superman) + supermanLegFront.y * superman,
  };
  const legBack = {
    x: footBack.x * (1 - superman) + supermanLegBack.x * superman,
    y: footBack.y * (1 - superman) + supermanLegBack.y * superman,
  };

  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(armFront.x, armFront.y);
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(legFront.x, legFront.y);
  ctx.moveTo(hip.x + 0.8, hip.y + 0.4);
  ctx.lineTo(legBack.x, legBack.y);
  ctx.stroke();

  if (superman > 0.16) {
    ctx.strokeStyle = "rgba(126, 231, 255, 0.35)";
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i += 1) {
      const offset = i * 4;
      ctx.beginPath();
      ctx.moveTo(head.x + 6 + offset, head.y + 1 + i * 1.5);
      ctx.lineTo(head.x + 16 + offset * 1.5, head.y + 2 + i * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
  drawChargeAboveRider(riderScreenX, riderY);
}

function frame(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;

  handleOrientation();
  update(dt);

  drawBackground();
  if (!state.orientationBlocked) {
    ctx.save();
    const zoom = cameraConfig.zoomLevel;
    const cx = width * 0.5;
    const cy = height * 0.5;
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    drawTrack();
    drawRider();
    ctx.restore();
  }

  requestAnimationFrame(frame);
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
}

easyModeButton.addEventListener("click", () => resetRun(MODES.EASY));
riderModeButton.addEventListener("click", () => resetRun(MODES.RIDER));
restartButton.addEventListener("click", () => resetRun(state.mode));
menuButton.addEventListener("click", showMenu);

window.addEventListener("pointerdown", onPressStart, { passive: true });
window.addEventListener("pointerup", onPressEnd, { passive: true });
window.addEventListener("pointercancel", onPressEnd, { passive: true });
window.addEventListener("resize", () => {
  resize();
  handleOrientation();
});

menuToggle.addEventListener("click", () => {
  if (runMenuOpen) closeRunMenu();
  else openRunMenu();
});

runMenuClose.addEventListener("click", closeRunMenu);
runMenu.addEventListener("click", (event) => {
  if (event.target === runMenu) closeRunMenu();
});

menuRestart.addEventListener("click", () => {
  closeRunMenu();
  if (state.running) resetRun(state.mode);
});

menuBestScore.addEventListener("click", refreshBestScoreButton);
menuChangeMode.addEventListener("click", () => {
  closeRunMenu();
  showMenu();
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

loadBestScore();
refreshBestScoreButton();
resize();
handleOrientation();
updateHud();
requestAnimationFrame(frame);
