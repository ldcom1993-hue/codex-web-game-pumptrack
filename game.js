const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const totalScore = document.getElementById("totalScore");
const timerValue = document.getElementById("timerValue");
const distanceValue = document.getElementById("distanceValue");
const speedValue = document.getElementById("speedValue");
const floatingLayer = document.getElementById("floatingLayer");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const finalScore = document.getElementById("finalScore");
const finalDistance = document.getElementById("finalDistance");
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
const BEST_SCORE_KEY = "flowline-rider-v0.15.1-best-score";

const PARALLAX = {
  hillsSpeed: 0.16,
  midSpeed: 0.4,
  cloudDriftFast: 7,
  cloudDriftSlow: 3.8,
  cloudSpeedScaleFast: 0.04,
  cloudSpeedScaleSlow: 0.02,
  birdSpawnMin: 6.5,
  birdSpawnMax: 11,
};

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
  jumpActive: false,
  jumpLaunchX: 0,
  jumpLaunchSlope: 0,
  jumpPeakX: 0,
  jumpPeakSlope: 0,
  displaySpeed: 0,
  distanceMeters: 0,
  jumpStartY: 0,
  jumpLaunchY: 0,
  jumpStartX: 0,
  jumpPeakY: 0,
  jumpFromBump: false,
  suspension: 0,
  suspensionVel: 0,
  clock: 0,
  cameraWorldX: 0,
  timeLeft: RUN_DURATION,
  prevGroundSlope: 0,
  birdTimer: 0,
  finishPulse: 0,
  finishFade: 0,
};

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;
let runMenuOpen = false;
let bestScore = 0;
const floatingScores = [];
const parallaxClouds = [];
const parallaxMidObjects = [];
const birds = [];

const MID_OBJECT_TYPES = ["treeTall", "treeRound", "forest", "fence", "windmill", "barn", "bush", "animal"];

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function spawnBird() {
  const direction = Math.random() > 0.5 ? 1 : -1;
  const yBand = randomRange(height * 0.13, height * 0.32);
  const speed = randomRange(26, 42);
  birds.push({
    direction,
    x: direction > 0 ? -90 : width + 90,
    y: yBand,
    speed,
    size: randomRange(0.7, 1.18),
    wingPhase: Math.random() * Math.PI * 2,
  });
}

function initParallax() {
  parallaxClouds.length = 0;
  parallaxMidObjects.length = 0;

  for (let i = 0; i < 12; i += 1) {
    parallaxClouds.push({
      x: i * randomRange(120, 230),
      yRatio: randomRange(0.1, 0.34),
      width: randomRange(64, 180),
      height: randomRange(22, 52),
      driftOffset: randomRange(0, 500),
      layer: i % 2,
      alpha: randomRange(0.17, 0.36),
    });
  }

  let cursor = 0;
  while (cursor < 7000) {
    cursor += randomRange(150, 360);
    if (Math.random() < 0.24) continue;
    parallaxMidObjects.push({
      x: cursor,
      yRatio: randomRange(0.59, 0.67),
      scale: randomRange(0.66, 1.12),
      type: pickRandom(MID_OBJECT_TYPES),
      variant: Math.floor(randomRange(0, 3.99)),
    });
  }

  birds.length = 0;
  state.birdTimer = randomRange(3, 6.5);
}

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
  state.displaySpeed = 0;
  state.distanceMeters = 0;
  state.jumpStartY = state.riderY;
  state.jumpLaunchY = state.riderY;
  state.jumpStartX = state.worldX;
  state.jumpPeakY = state.riderY;
  state.jumpFromBump = false;
  state.jumpActive = false;
  state.jumpLaunchX = state.worldX;
  state.jumpLaunchSlope = terrainSlope(state.worldX);
  state.jumpPeakX = state.worldX;
  state.jumpPeakSlope = state.jumpLaunchSlope;
  state.suspension = 0;
  state.suspensionVel = 0;
  state.clock = 0;
  state.timeLeft = RUN_DURATION;
  state.prevGroundSlope = terrainSlope(0);
  state.birdTimer = randomRange(PARALLAX.birdSpawnMin, PARALLAX.birdSpawnMax);
  state.finishPulse = 0;
  state.finishFade = 0;
  birds.length = 0;
  floatingScores.length = 0;
  floatingLayer.innerHTML = "";

  closeRunMenu();
  updateHud();
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  hud.classList.remove("hidden");
}

function showMenu() {
  state.running = false;
  state.over = false;
  closeRunMenu();
  hud.classList.add("hidden");
  gameOverScreen.classList.remove("visible");
  startScreen.classList.add("visible");
}

function endRun() {
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
  finalDistance.textContent = `${Math.round(state.distanceMeters)} m`;
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
  state.jumpLaunchY = state.riderY;
  state.jumpPeakY = state.riderY;
  state.jumpStartX = state.worldX;
  state.jumpFromBump = true;
  state.jumpActive = true;
  state.jumpLaunchX = state.worldX;
  state.jumpLaunchSlope = terrainSlope(state.worldX);
  state.jumpPeakX = state.worldX;
  state.jumpPeakSlope = state.jumpLaunchSlope;
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
  state.prevGroundSlope = slope;
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
  if (!state.jumpFromBump || !state.jumpActive) return 0;

  const jumpHeight = Math.max(0, state.jumpStartY - state.jumpPeakY);
  const normalizedHeight = Math.min(1, jumpHeight / 72);
  const normalizedAirtime = Math.min(1, state.jumpAirTime / 1.15);
  const weighted = normalizedHeight * 0.64 + normalizedAirtime * 0.36;
  const curved = Math.pow(weighted, 0.74);

  const jumpAward = 10 + curved * 40;
  return Math.max(10, Math.min(50, jumpAward));
}


function addLandingFeedback(text, worldX, worldY) {
  const node = document.createElement("div");
  node.className = "floating-score landing-feedback";
  node.textContent = text;
  node.dataset.feedback = text.toLowerCase();
  floatingLayer.appendChild(node);

  floatingScores.push({
    node,
    worldX,
    worldY,
    age: 0,
    ttl: 0.8,
    drift: 26,
  });
}

function isPerfectLanding(terrainSlopeAtLanding) {
  const peakClearance = state.jumpLaunchY - state.jumpPeakY;
  const jumpTravel = state.worldX - state.jumpLaunchX;
  const clearedBumpPeak = state.jumpPeakX > state.jumpLaunchX + 8 && state.jumpPeakSlope >= 0.01;
  const launchFromUphill = state.jumpLaunchSlope > 0.012;
  const landingOnDescendingSlope = terrainSlopeAtLanding < -0.03;
  const alignedPosture = Math.abs(normalizeAngle(state.angle - state.terrainAngle)) < 0.34;
  const notSupermanAtContact = isEasyMode() || (!state.supermanActive && state.supermanBlend < 0.2);
  const hadMeaningfulAir = state.jumpAirTime > 0.11 && peakClearance > 6;
  const descentZoneQuality = Math.min(1, Math.max(0, (-terrainSlopeAtLanding - 0.03) / 0.17));
  const travelQuality = Math.min(1, Math.max(0, (jumpTravel - 22) / 34));
  const inOptimalZone = descentZoneQuality > 0.25 && travelQuality > 0.32;

  return (
    launchFromUphill &&
    hadMeaningfulAir &&
    clearedBumpPeak &&
    landingOnDescendingSlope &&
    inOptimalZone &&
    alignedPosture &&
    notSupermanAtContact
  );
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
  state.prevGroundSlope = terrainSlope(state.worldX);
  state.suspensionVel -= 1.8;

  const landingSlope = terrainSlope(state.worldX);
  if (state.jumpActive) {
    const jumpAward = computeJumpScore();
    if (jumpAward > 0) {
      const baseScore = Math.round(jumpAward);
      const perfectLanding = isPerfectLanding(landingSlope);
      let totalAward = baseScore;

      if (perfectLanding) {
        totalAward = Math.round(baseScore * 1.5);
        addLandingFeedback("PERFECT", state.worldX - 10, state.riderY - 40);
      } else {
        addLandingFeedback("GOOD", state.worldX - 10, state.riderY - 40);
      }

      if (isRiderMode() && state.supermanHoldTime > 0.08) {
        const supermanBonus = Math.round(Math.min(26, 8 + state.supermanHoldTime * 18));
        totalAward += supermanBonus;
      }

      state.totalScore += totalAward;
      addFloatingScore(`+${totalAward}`, state.worldX, state.riderY - 58);
      updateHud();
    }
  }

  state.supermanHoldTime = 0;
  state.jumpAirTime = 0;
  state.jumpFromBump = false;
  state.jumpActive = false;
  state.jumpLaunchX = state.worldX;
  state.jumpLaunchSlope = terrainSlope(state.worldX);
  state.jumpPeakX = state.worldX;
  state.jumpPeakSlope = state.jumpLaunchSlope;

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
  if (state.riderY < state.jumpPeakY) {
    state.jumpPeakY = state.riderY;
    state.jumpPeakX = state.worldX;
    state.jumpPeakSlope = terrainSlope(state.worldX);
  }

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
  timerValue.textContent = `${Math.max(0, state.timeLeft).toFixed(1)} s`;
  distanceValue.textContent = `${Math.round(state.distanceMeters)} m`;
  speedValue.textContent = `${state.displaySpeed.toFixed(1)} m/s`;
}

function updateCamera(dt) {
  const t = Math.min(1, dt * 60 * cameraConfig.followSmoothness);
  state.cameraWorldX += (state.worldX - state.cameraWorldX) * t;
}

function update(dt) {
  if (!state.running || state.orientationBlocked || runMenuOpen) return;

  state.clock += dt;
  state.finishPulse += dt * 4.2;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  state.displaySpeed += (state.vx - state.displaySpeed) * Math.min(1, dt * 8);

  if (state.airborne) updateAirPhysics(dt);
  else updateGroundPhysics(dt);

  if (!state.running) return;

  const finishProgress = 1 - state.timeLeft / RUN_DURATION;
  state.finishFade += (Math.max(0, finishProgress - 0.88) - state.finishFade) * Math.min(1, dt * 3.2);

  state.birdTimer -= dt;
  if (state.birdTimer <= 0) {
    spawnBird();
    state.birdTimer = randomRange(PARALLAX.birdSpawnMin, PARALLAX.birdSpawnMax);
  }

  for (let i = birds.length - 1; i >= 0; i -= 1) {
    const bird = birds[i];
    bird.x += bird.speed * bird.direction * dt;
    bird.wingPhase += dt * 8.5;
    if ((bird.direction > 0 && bird.x > width + 120) || (bird.direction < 0 && bird.x < -120)) {
      birds.splice(i, 1);
    }
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

function drawCloud(x, y, cloudWidth, cloudHeight, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(x, y, x, y + cloudHeight);
  grad.addColorStop(0, "rgba(255,255,255,0.86)");
  grad.addColorStop(1, "rgba(222,236,255,0.38)");
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.ellipse(x, y, cloudWidth * 0.22, cloudHeight * 0.3, 0, 0, Math.PI * 2);
  ctx.ellipse(x + cloudWidth * 0.22, y - cloudHeight * 0.1, cloudWidth * 0.26, cloudHeight * 0.36, 0, 0, Math.PI * 2);
  ctx.ellipse(x + cloudWidth * 0.47, y, cloudWidth * 0.29, cloudHeight * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(x + cloudWidth * 0.72, y + cloudHeight * 0.02, cloudWidth * 0.22, cloudHeight * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBird(bird) {
  const flap = Math.sin(bird.wingPhase) * 4.2;
  const w = 18 * bird.size;
  const h = 8 * bird.size;

  ctx.save();
  ctx.translate(bird.x, bird.y);
  if (bird.direction < 0) ctx.scale(-1, 1);
  ctx.strokeStyle = "rgba(74, 92, 108, 0.8)";
  ctx.lineWidth = 1.6 * bird.size;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(w * 0.5, -h - flap * 0.2, w, flap * 0.2);
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-w * 0.5, -h + flap * 0.2, -w, -flap * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawWindmill(screenX, baseY, scale, spin) {
  const h = 48 * scale;
  ctx.fillStyle = "#7d8b71";
  ctx.beginPath();
  ctx.moveTo(screenX - 6 * scale, baseY);
  ctx.lineTo(screenX + 6 * scale, baseY);
  ctx.lineTo(screenX + 2.5 * scale, baseY - h);
  ctx.lineTo(screenX - 2.5 * scale, baseY - h);
  ctx.closePath();
  ctx.fill();

  const hubX = screenX;
  const hubY = baseY - h + 6 * scale;
  ctx.fillStyle = "#dde3d1";
  ctx.beginPath();
  ctx.arc(hubX, hubY, 3 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(228, 234, 219, 0.9)";
  ctx.lineWidth = 2 * scale;
  for (let i = 0; i < 4; i += 1) {
    const a = spin + (Math.PI * 0.5 * i);
    ctx.beginPath();
    ctx.moveTo(hubX, hubY);
    ctx.lineTo(hubX + Math.cos(a) * 18 * scale, hubY + Math.sin(a) * 18 * scale);
    ctx.stroke();
  }
}

function drawMidObject(obj, screenX, baselineY) {
  const s = obj.scale;
  const bob = Math.sin(state.clock * 0.7 + obj.x * 0.01) * 1.1;
  const y = baselineY + bob;

  if (obj.type === "treeTall") {
    ctx.fillStyle = "#6f8260";
    ctx.fillRect(screenX - 2 * s, y - 36 * s, 4 * s, 36 * s);
    ctx.fillStyle = "#89a37d";
    ctx.beginPath();
    ctx.arc(screenX, y - 40 * s, 15 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (obj.type === "treeRound") {
    ctx.fillStyle = "#6d7d5e";
    ctx.fillRect(screenX - 3 * s, y - 28 * s, 6 * s, 28 * s);
    ctx.fillStyle = "#94b086";
    ctx.beginPath();
    ctx.arc(screenX - 7 * s, y - 32 * s, 10 * s, 0, Math.PI * 2);
    ctx.arc(screenX + 5 * s, y - 34 * s, 11 * s, 0, Math.PI * 2);
    ctx.arc(screenX, y - 42 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (obj.type === "forest") {
    ctx.fillStyle = "rgba(111, 137, 101, 0.82)";
    for (let i = 0; i < 4; i += 1) {
      const ox = (i - 1.5) * 12 * s;
      ctx.beginPath();
      ctx.arc(screenX + ox, y - 25 * s - (i % 2) * 4 * s, 12 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (obj.type === "fence") {
    ctx.strokeStyle = "#9a8264";
    ctx.lineWidth = 2 * s;
    for (let i = 0; i < 4; i += 1) {
      const ox = i * 11 * s;
      ctx.beginPath();
      ctx.moveTo(screenX + ox, y - 2 * s);
      ctx.lineTo(screenX + ox, y - 16 * s);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(screenX - 1 * s, y - 7 * s);
    ctx.lineTo(screenX + 34 * s, y - 8 * s);
    ctx.moveTo(screenX - 1 * s, y - 12 * s);
    ctx.lineTo(screenX + 34 * s, y - 13 * s);
    ctx.stroke();
  } else if (obj.type === "windmill") {
    drawWindmill(screenX, y, s, state.clock * 0.45 + obj.variant);
  } else if (obj.type === "barn") {
    ctx.fillStyle = "#a07058";
    ctx.fillRect(screenX - 16 * s, y - 22 * s, 32 * s, 22 * s);
    ctx.fillStyle = "#7d4e3f";
    ctx.beginPath();
    ctx.moveTo(screenX - 20 * s, y - 22 * s);
    ctx.lineTo(screenX, y - 35 * s);
    ctx.lineTo(screenX + 20 * s, y - 22 * s);
    ctx.closePath();
    ctx.fill();
  } else if (obj.type === "animal") {
    ctx.fillStyle = "#d0c5ae";
    ctx.beginPath();
    ctx.ellipse(screenX, y - 7 * s, 10 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const idle = Math.sin(state.clock * 1.2 + obj.x * 0.008) * 1.6;
    ctx.beginPath();
    ctx.arc(screenX + 8 * s, y - 10 * s + idle, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#8fab82";
    ctx.beginPath();
    ctx.arc(screenX, y - 6 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#d7e8ff");
  sky.addColorStop(0.62, "#bdd8f4");
  sky.addColorStop(1, "#9fc099");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  for (const cloud of parallaxClouds) {
    const layerDrift = cloud.layer === 0 ? PARALLAX.cloudDriftSlow : PARALLAX.cloudDriftFast;
    const riderInfluence = cloud.layer === 0 ? PARALLAX.cloudSpeedScaleSlow : PARALLAX.cloudSpeedScaleFast;
    const cycle = width + cloud.width * 3;
    const drift = state.clock * layerDrift + state.cameraWorldX * riderInfluence;
    const x = ((cloud.x + cloud.driftOffset + drift) % cycle) - cloud.width * 1.5;
    const y = height * cloud.yRatio;
    drawCloud(x, y, cloud.width, cloud.height, cloud.alpha);
  }

  for (const bird of birds) drawBird(bird);

  const horizon = height * 0.68;
  const hillOffset = state.cameraWorldX * PARALLAX.hillsSpeed;

  ctx.fillStyle = "#a8c4b2";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 10);
  for (let x = -10; x <= width + 10; x += 10) {
    const world = x + hillOffset;
    const y =
      horizon - 176 +
      Math.sin(world * 0.0022) * 42 +
      Math.sin(world * 0.0009 + 1.5) * 28 +
      Math.sin(world * 0.004 + 0.4) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#90af9c";
  ctx.beginPath();
  ctx.moveTo(0, horizon + 36);
  for (let x = -10; x <= width + 10; x += 8) {
    const world = x + hillOffset * 1.24;
    const y =
      horizon - 126 +
      Math.sin(world * 0.0035 + 0.2) * 34 +
      Math.sin(world * 0.0013 + 2) * 24 +
      Math.sin(world * 0.006 + 0.9) * 8;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();

  const playerScreenX = width * 0.3;
  const startX = state.cameraWorldX - playerScreenX;
  for (const obj of parallaxMidObjects) {
    const screenX = (obj.x - startX) * PARALLAX.midSpeed;
    if (screenX < -80 || screenX > width + 80) continue;
    drawMidObject(obj, screenX, height * obj.yRatio);
  }
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

  ctx.strokeStyle = "rgba(13, 25, 32, 0.36)";
  ctx.lineWidth = 6.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rearWheel.x, rearWheel.y);
  ctx.lineTo(seat.x, seat.y);
  ctx.lineTo(frontWheel.x, frontWheel.y);
  ctx.closePath();
  ctx.moveTo(seat.x, seat.y);
  ctx.lineTo(handlebar.x, handlebar.y);
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.stroke();

  ctx.strokeStyle = "#2d5f76";
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

  ctx.strokeStyle = "#f4f8ff";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(frontWheel.x, frontWheel.y, rider.wheelRadius * 0.58, 0, Math.PI * 2);
  ctx.arc(rearWheel.x, rearWheel.y, rider.wheelRadius * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#334d7f";
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(crank.x, crank.y);
  ctx.lineTo(footFront.x, footFront.y);
  ctx.moveTo(crank.x, crank.y);
  ctx.lineTo(footBack.x, footBack.y);
  ctx.stroke();

  ctx.strokeStyle = "#163b4a";
  ctx.lineWidth = 4.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.stroke();

  ctx.fillStyle = "#f2f7ff";
  ctx.beginPath();
  ctx.arc(head.x, head.y, 7.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2a446f";
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


function drawFinishIndicator() {
  if (!state.running && state.finishFade <= 0.02) return;

  const indicatorWorldX = state.worldX + 56;
  const playerScreenX = width * 0.3;
  const indicatorX = indicatorWorldX - state.cameraWorldX + playerScreenX;
  const baseY = state.riderY - 56;
  const visible = Math.min(1, Math.max(0, state.finishFade * 1.35));
  const flutter = Math.sin(state.finishPulse) * 2.6;
  if (visible < 0.03) return;

  ctx.save();
  ctx.globalAlpha = visible;

  ctx.strokeStyle = "rgba(44, 62, 52, 0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(indicatorX, baseY + 34);
  ctx.lineTo(indicatorX, baseY - 20);
  ctx.stroke();

  ctx.fillStyle = "rgba(232, 245, 235, 0.95)";
  ctx.beginPath();
  ctx.moveTo(indicatorX + 2, baseY - 16);
  ctx.quadraticCurveTo(indicatorX + 17, baseY - 21 + flutter * 0.3, indicatorX + 28, baseY - 13 + flutter);
  ctx.quadraticCurveTo(indicatorX + 18, baseY - 3 + flutter * 0.2, indicatorX + 2, baseY - 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(121, 163, 132, 0.95)";
  ctx.fillRect(indicatorX + 11, baseY - 14, 6, 6);
  ctx.fillStyle = "rgba(66, 108, 80, 0.95)";
  ctx.fillRect(indicatorX + 17, baseY - 14, 6, 6);
  ctx.fillRect(indicatorX + 11, baseY - 8, 6, 6);
  ctx.fillStyle = "rgba(232, 245, 235, 0.95)";
  ctx.fillRect(indicatorX + 17, baseY - 8, 6, 6);

  ctx.restore();
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
    drawFinishIndicator();
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

  if (!parallaxClouds.length || !parallaxMidObjects.length) initParallax();
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
