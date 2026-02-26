const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const progressHud = document.getElementById("progressHud");
const speedValue = document.getElementById("speedValue");
const timerValue = document.getElementById("timerValue");
const progressFill = document.getElementById("progressFill");
const progressDot = document.getElementById("progressDot");
const checkpointMarks = document.getElementById("checkpointMarks");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const gameOverTitle = document.getElementById("gameOverTitle");
const finalScore = document.getElementById("finalScore");
const finalTime = document.getElementById("finalTime");
const feedback = document.getElementById("feedback");
const rotateNotice = document.getElementById("rotateNotice");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const WORLD_SCALE = {
  metersPerRiderHeight: 1.7,
  metersPerWheelDiameter: 0.7,
};


const LEVEL_LENGTH = 760;
const CHECKPOINT_SPACING = 160;
const checkpoints = Array.from({ length: Math.floor(LEVEL_LENGTH / CHECKPOINT_SPACING) }, (_, index) => {
  const x = (index + 1) * CHECKPOINT_SPACING;
  return {
    id: index,
    x,
    y: 0,
    angle: 0,
  };
});

const physics = {
  gravity: 18.8,
  pedalAccelMin: 0.85,
  pedalAccelMid: 1.75,
  pedalAccelMax: 2.85,
  rollingFriction: 0.16,
  airDrag: 0.045,
  minSpeed: 0.55,
  maxSpeed: 18,
  maxVisibleJumpVy: 14,
  chargeCapSeconds: 1.5,
  jumpBaseImpulse: 6.4,
  jumpChargeImpulse: 6.8,
  flipImpulse: 7.8,
  airbornePitchDamping: 1.9,
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
  wheelRadius: 10,
  wheelBase: 38,
  bodyHeight: 20,
  comHeight: 24,
};

const camera = {
  x: 0,
  y: 0,
  zoom: 1,
};

const state = {
  running: false,
  over: false,
  orientationBlocked: false,
  crashed: false,
  respawnTimer: 0,
  crashFlash: 0,
  worldX: 0,
  riderY: 0,
  vx: 5.6,
  vy: 0,
  airborne: false,
  holdActive: false,
  pedaling: false,
  descending: false,
  charge: 0,
  chargeRatio: 0,
  angle: 0,
  angularVelocity: 0,
  terrainAngle: 0,
  score: 0,
  displaySpeed: 0,
  suspension: 0,
  suspensionVel: 0,
  tipTimer: 0,
  clock: 0,
  timer: 0,
  timerStarted: false,
  timerFinished: false,
  checkpointIndex: -1,
  respawn: {
    x: 0,
    y: 0,
    angle: 0,
    speed: 5.6,
  },
};

const terrainConfig = {
  minSegmentLength: 22,
  maxSegmentLength: 78,
};

let terrainSegments = [];

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;

function isLandscape() {
  return window.matchMedia("(orientation: landscape)").matches;
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
  const base = height * 0.67;
  return base + terrainElevation(worldX);
}

function seededRandom(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let n = Math.imul(t ^ (t >>> 15), t | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function pickSlope(rand, index) {
  const pattern = index % 6;
  if (pattern === 0) return (rand() - 0.5) * 0.08;
  if (pattern === 1 || pattern === 2) return -(0.06 + rand() * 0.1);
  if (pattern === 3 || pattern === 4) return 0.08 + rand() * 0.12;
  return (rand() - 0.5) * 0.14;
}

function buildTerrainSegments() {
  const rand = seededRandom(1010);
  terrainSegments = [];
  let x = 0;
  let elevation = 0;
  let index = 0;

  while (x < LEVEL_LENGTH) {
    const slope = pickSlope(rand, index);
    const minLen = slope > 0.1 ? 34 : terrainConfig.minSegmentLength;
    const maxLen = slope < -0.08 ? terrainConfig.maxSegmentLength : 66;
    const length = Math.min(LEVEL_LENGTH - x, minLen + rand() * (maxLen - minLen));

    const startX = x;
    const startElevation = elevation;
    let endElevation = startElevation + slope * length;
    endElevation = Math.max(-260, Math.min(260, endElevation));

    const waveAmp = index % 4 === 2 ? 0 : 12 + rand() * 18;
    const waveCycles = 0.22 + rand() * 0.45;
    const phase = rand() * Math.PI * 2;

    terrainSegments.push({
      startX,
      endX: startX + length,
      startElevation,
      endElevation,
      waveAmp,
      waveCycles,
      phase,
    });

    x += length;
    elevation = endElevation;
    index += 1;
  }
}

function terrainElevation(worldX) {
  const x = Math.max(0, Math.min(LEVEL_LENGTH, worldX));
  const segment =
    terrainSegments.find((item) => x >= item.startX && x <= item.endX) || terrainSegments[terrainSegments.length - 1];

  if (!segment) return 0;

  const range = Math.max(0.0001, segment.endX - segment.startX);
  const t = Math.max(0, Math.min(1, (x - segment.startX) / range));
  const smoothT = t * t * (3 - 2 * t);
  const base = segment.startElevation + (segment.endElevation - segment.startElevation) * smoothT;
  const wave = Math.sin((t * segment.waveCycles + segment.phase) * Math.PI * 2) * segment.waveAmp;
  return base + wave;
}

function terrainSlope(worldX) {
  const dx = 10;
  return (terrainY(worldX + dx) - terrainY(worldX - dx)) / (2 * dx);
}

function terrainAngle(worldX) {
  return Math.atan(terrainSlope(worldX));
}

function normalizeAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  const cents = Math.floor((totalSeconds % 1) * 100)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}.${cents}`;
}

function buildCheckpointMarks() {
  checkpointMarks.innerHTML = "";
  checkpoints.forEach((checkpoint) => {
    checkpoint.y = terrainY(checkpoint.x) - rider.wheelRadius - rider.bodyHeight;
    checkpoint.angle = terrainAngle(checkpoint.x);

    const mark = document.createElement("span");
    mark.className = "checkpoint-mark";
    mark.style.left = `${(checkpoint.x / LEVEL_LENGTH) * 100}%`;
    mark.dataset.index = checkpoint.id;
    checkpointMarks.appendChild(mark);
  });
}

function updateCheckpointMarks() {
  checkpointMarks.querySelectorAll(".checkpoint-mark").forEach((mark) => {
    mark.classList.toggle("active", Number(mark.dataset.index) <= state.checkpointIndex);
  });
}

function resetRun() {
  const startAngle = terrainAngle(0);
  state.over = false;
  state.running = true;
  state.crashed = false;
  state.respawnTimer = 0;
  state.crashFlash = 0;
  state.worldX = 0;
  state.vx = 4.2;
  state.vy = 0;
  state.airborne = false;
  state.holdActive = false;
  state.pedaling = false;
  state.descending = false;
  state.charge = 0;
  state.chargeRatio = 0;
  state.angle = startAngle;
  state.angularVelocity = 0;
  state.terrainAngle = startAngle;
  state.riderY = terrainY(0) - rider.wheelRadius - rider.bodyHeight;
  state.score = 0;
  state.displaySpeed = 0;
  state.suspension = 0;
  state.suspensionVel = 0;
  state.tipTimer = 0;
  state.timer = 0;
  state.timerStarted = false;
  state.timerFinished = false;
  state.checkpointIndex = -1;
  state.respawn = {
    x: 0,
    y: state.riderY,
    angle: startAngle,
    speed: 5.6,
  };

  camera.x = 0;
  camera.y = state.riderY;
  camera.zoom = 1;

  updateHud();
  updateCheckpointMarks();
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  hud.classList.remove("hidden");
  progressHud.classList.remove("hidden");
}

function endRun(crash = false) {
  state.running = false;
  state.over = true;
  state.holdActive = false;
  state.pedaling = false;
  state.charge = 0;
  state.chargeRatio = 0;
  state.timerFinished = !crash;

  gameOverTitle.textContent = crash ? "Crash" : "Ride Complete";
  finalScore.textContent = Math.round(state.score);
  finalTime.textContent = formatTime(state.timer);
  gameOverScreen.classList.add("visible");
}

function showFeedback(text, kind = "normal", duration = 500) {
  feedback.textContent = text;
  feedback.classList.add("visible");
  feedback.classList.toggle("crash", kind === "crash");
  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(() => feedback.classList.remove("visible"), duration);
}

function onPressStart() {
  if (!state.running || state.orientationBlocked || state.crashed) return;
  state.holdActive = true;

  if (state.airborne && !state.descending) {
    state.angularVelocity += physics.flipImpulse;
    showFeedback("Flip", "normal", 280);
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
  state.charge = 0;
  state.chargeRatio = 0;

  const riderTop = state.riderY - 34;
  if (riderTop < 24) {
    state.vy = Math.min(state.vy, -4.2);
  }
}

function onPressEnd() {
  if (!state.running || state.orientationBlocked || state.crashed) return;
  state.holdActive = false;

  if (state.airborne) {
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

function triggerCrash(reason) {
  state.crashed = true;
  state.respawnTimer = 0.22;
  state.crashFlash = 0.2;
  state.airborne = false;
  state.holdActive = false;
  state.pedaling = false;
  state.vy = 0;
  showFeedback(reason, "crash", 320);
}

function respawnAtCheckpoint() {
  state.crashed = false;
  state.respawnTimer = 0;
  state.worldX = state.respawn.x;
  state.riderY = state.respawn.y;
  state.vx = Math.max(physics.minSpeed, state.respawn.speed);
  state.vy = 0;
  state.angle = state.respawn.angle;
  state.terrainAngle = state.respawn.angle;
  state.angularVelocity = 0;
  state.tipTimer = 0;
  state.charge = 0;
  state.chargeRatio = 0;
  state.airborne = false;
  state.suspensionVel -= 1.1;

  showFeedback(state.checkpointIndex >= 0 ? "Checkpoint restart" : "Restart", "normal", 320);
}

function updateCharge(dt, canCharge) {
  state.pedaling = state.holdActive && canCharge;
  if (state.pedaling) {
    state.charge = Math.min(physics.chargeCapSeconds, state.charge + dt);
  }
  state.chargeRatio += (Math.min(1, state.charge / physics.chargeCapSeconds) - state.chargeRatio) * Math.min(1, dt * 16);
}

function updateGroundPhysics(dt) {
  const centerX = state.worldX;
  const slope = terrainSlope(centerX);
  const slopeNorm = Math.sqrt(1 + slope * slope);
  const gravityAlong = (-physics.gravity * slope) / slopeNorm;

  state.vx += gravityAlong * dt;

  updateCharge(dt, true);
  if (state.pedaling) {
    const pedalTime = state.charge;
    let pedalAccel = physics.pedalAccelMin;
    if (pedalTime > 1.05) {
      pedalAccel = physics.pedalAccelMax;
    } else if (pedalTime > 0.25) {
      const midBlend = (pedalTime - 0.25) / 0.8;
      pedalAccel = physics.pedalAccelMid + (physics.pedalAccelMax - physics.pedalAccelMid) * Math.max(0, Math.min(1, midBlend));
    }
    state.vx += pedalAccel * dt;
  }

  const friction = physics.rollingFriction * dt;
  if (state.vx > friction) state.vx -= friction;
  else if (state.vx < -friction) state.vx += friction;
  else state.vx = 0;

  state.vx = Math.max(physics.minSpeed, Math.min(physics.maxSpeed, state.vx));
  state.worldX += state.vx * dt;

  state.terrainAngle = terrainAngle(state.worldX);
  state.riderY = terrainY(state.worldX) - rider.wheelRadius - rider.bodyHeight;

  const crouchBias = state.pedaling ? state.chargeRatio * 0.18 : 0;
  const targetAngle = state.terrainAngle - crouchBias;
  const angleError = normalizeAngle(targetAngle - state.angle);
  const stabilizeTorque = angleError * physics.uprightStiffness - state.angularVelocity * physics.uprightDamping;

  state.angularVelocity += stabilizeTorque * dt;
  state.angle += state.angularVelocity * dt;

  const comProjection = Math.sin(normalizeAngle(state.angle - state.terrainAngle)) * rider.comHeight;
  const supportHalf = rider.wheelBase * 0.5;
  if (Math.abs(comProjection) > supportHalf) {
    state.tipTimer += dt;
  } else {
    state.tipTimer = Math.max(0, state.tipTimer - dt * 2);
  }

  if (Math.abs(normalizeAngle(state.angle - state.terrainAngle)) > physics.hardCrashPitch || state.tipTimer > 0.28) {
    triggerCrash("Lost balance");
  }
}

function evaluateLanding() {
  const terrain = terrainAngle(state.worldX);
  const pitchDelta = normalizeAngle(state.angle - terrain);
  const angVel = Math.abs(state.angularVelocity);

  if (Math.abs(pitchDelta) > physics.hardCrashPitch || angVel > physics.hardCrashAngular) {
    triggerCrash("Hard impact");
    return;
  }

  if (Math.abs(pitchDelta) > physics.recoverablePitch && angVel > physics.recoverableAngular) {
    triggerCrash("Could not recover");
    return;
  }

  state.airborne = false;
  state.vy = 0;
  state.riderY = terrainY(state.worldX) - rider.wheelRadius - rider.bodyHeight;
  state.terrainAngle = terrain;
  state.suspensionVel -= 1.8;
  state.tipTimer = 0;
  showFeedback("Landing", "normal", 280);

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

  updateCharge(dt, state.descending);

  state.angularVelocity *= Math.max(0, 1 - physics.airbornePitchDamping * dt);
  state.angle += state.angularVelocity * dt;

  state.vx = Math.max(physics.minSpeed, state.vx - physics.airDrag * dt);
  state.worldX += state.vx * dt;
  state.riderY += state.vy * dt;

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

function updateCheckpointState() {
  const next = checkpoints[state.checkpointIndex + 1];
  if (!next || state.worldX < next.x) return;

  state.checkpointIndex += 1;
  state.respawn = {
    x: next.x,
    y: next.y,
    angle: next.angle,
    speed: Math.max(physics.minSpeed + 1, state.vx),
  };
  updateCheckpointMarks();
  showFeedback("Checkpoint", "normal", 380);
}

function updateCamera(dt) {
  const lookAhead = 34 + state.vx * 3.8;
  const targetX = Math.min(LEVEL_LENGTH, state.worldX + lookAhead);
  const jumpLift = state.airborne ? -36 - Math.min(40, Math.abs(state.vy) * 2.8) : 0;
  const targetY = state.riderY + jumpLift;

  const speedZoom = Math.min(0.14, Math.max(0, (state.vx - 7) * 0.02));
  const airZoom = state.airborne ? 0.06 : 0;
  const targetZoom = 1 - speedZoom - airZoom;

  const smooth = state.crashed ? 3.8 : 4.8;
  camera.x += (targetX - camera.x) * Math.min(1, dt * smooth);
  camera.y += (targetY - camera.y) * Math.min(1, dt * 4.2);
  camera.zoom += (targetZoom - camera.zoom) * Math.min(1, dt * 3.2);

  const riderScreenX = (state.worldX - camera.x) * camera.zoom + width * 0.34;
  const margin = 82;
  if (riderScreenX < margin) {
    camera.x -= (margin - riderScreenX) / camera.zoom;
  } else if (riderScreenX > width - margin) {
    camera.x += (riderScreenX - (width - margin)) / camera.zoom;
  }
}

function updateHud() {
  state.displaySpeed += (state.vx - state.displaySpeed) * 0.18;
  speedValue.textContent = state.displaySpeed.toFixed(1);
  timerValue.textContent = formatTime(state.timer);

  const progress = Math.max(0, Math.min(1, state.worldX / LEVEL_LENGTH));
  const percent = progress * 100;
  progressFill.style.width = `${percent}%`;
  progressDot.style.left = `${percent}%`;
}

function update(dt) {
  if (!state.running || state.orientationBlocked) return;

  state.clock += dt;
  if (state.crashFlash > 0) {
    state.crashFlash = Math.max(0, state.crashFlash - dt);
  }

  if (state.crashed) {
    state.respawnTimer -= dt;
    updateCamera(dt);
    updateHud();
    if (state.respawnTimer <= 0) {
      respawnAtCheckpoint();
    }
    return;
  }

  if (!state.timerStarted && Math.abs(state.vx) > 2.2 && state.worldX > 3) {
    state.timerStarted = true;
  }
  if (state.timerStarted && !state.timerFinished) {
    state.timer += dt;
  }

  if (state.airborne) updateAirPhysics(dt);
  else updateGroundPhysics(dt);

  if (state.worldX >= LEVEL_LENGTH) {
    state.worldX = LEVEL_LENGTH;
    state.timerFinished = true;
    endRun(false);
    return;
  }

  const riderTop = state.riderY - 40;
  if (riderTop < 10 && state.vy < -3.6) {
    state.vy = -3.6;
  }

  updateCheckpointState();
  updateSuspension(dt);
  state.score += state.vx * dt * (state.airborne ? 0.9 : 1.2);
  updateCamera(dt);
  updateHud();
}

function toScreen(worldX, worldY) {
  return {
    x: (worldX - camera.x) * camera.zoom + width * 0.34,
    y: (worldY - camera.y) * camera.zoom + height * 0.54,
  };
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#101a35");
  grad.addColorStop(1, "#090e1d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 4; i += 1) {
    const speedFactor = 0.08 + i * 0.035;
    const y = height * (0.2 + i * 0.12) + Math.sin(state.clock * 0.22 + i) * 8;
    const offset = -(camera.x * speedFactor) % (width + 140);
    ctx.fillStyle = "rgba(126, 231, 255, 0.07)";
    for (let x = offset - 140; x < width + 140; x += 190) {
      ctx.fillRect(x, y, 110, 2);
    }
  }
}

function drawTrack() {
  const worldStart = camera.x - width * 0.45 / camera.zoom;
  const worldEnd = camera.x + width * 0.85 / camera.zoom;
  const step = 8;

  ctx.beginPath();
  for (let world = worldStart; world <= worldEnd; world += step) {
    const p = toScreen(world, terrainY(world));
    if (world === worldStart) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }

  ctx.lineTo(width + 40, height + 80);
  ctx.lineTo(-40, height + 80);
  ctx.closePath();

  const fill = ctx.createLinearGradient(0, height * 0.4, 0, height);
  fill.addColorStop(0, "#243260");
  fill.addColorStop(1, "#0f1730");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  for (let world = worldStart; world <= worldEnd; world += 4) {
    const p = toScreen(world, terrainY(world));
    if (world === worldStart) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#8fe8ff";
  ctx.stroke();
}

function drawCheckpoints() {
  for (const checkpoint of checkpoints) {
    if (checkpoint.x > LEVEL_LENGTH) continue;

    const ground = toScreen(checkpoint.x, terrainY(checkpoint.x));
    if (ground.x < -30 || ground.x > width + 30) continue;

    const activated = checkpoint.id <= state.checkpointIndex;
    const poleTopY = ground.y - 42 * camera.zoom;

    ctx.strokeStyle = activated ? "#66ffc3" : "#f1c389";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ground.x, ground.y - 2);
    ctx.lineTo(ground.x, poleTopY);
    ctx.stroke();

    ctx.fillStyle = activated ? "rgba(76,255,176,0.86)" : "rgba(255,209,148,0.84)";
    ctx.beginPath();
    ctx.moveTo(ground.x, poleTopY);
    ctx.lineTo(ground.x + 14 * camera.zoom, poleTopY + 8 * camera.zoom);
    ctx.lineTo(ground.x, poleTopY + 14 * camera.zoom);
    ctx.closePath();
    ctx.fill();
  }
}

function drawChargeAboveRider(playerScreenX, riderY) {
  if (state.chargeRatio <= 0.01 && !state.pedaling) return;

  const barWidth = 74;
  const barHeight = 8;
  const x = playerScreenX - barWidth * 0.5;
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
  const player = toScreen(state.worldX, state.riderY);
  const compress = Math.max(-8, Math.min(8, state.suspension * 120));
  const riderYPos = player.y + compress;

  const pedalSpeed = state.pedaling ? 8 : 2.6;
  const pedalPhase = state.clock * pedalSpeed;
  const crouch = state.pedaling && !state.airborne ? state.chargeRatio * 6 : 0;
  const extend = state.airborne ? Math.max(-2.8, -state.vy * 0.11) : 0;

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
  ctx.translate(player.x, riderYPos);
  ctx.rotate(state.angle);
  ctx.scale(camera.zoom, camera.zoom);

  const hip = { x: -1, y: -crouch + extend };
  const shoulder = { x: 2, y: -11 - crouch * 0.65 + extend * 0.45 };
  const head = { x: 4, y: -22 - crouch * 0.3 + extend * 0.55 };
  const handlebar = { x: 12, y: 2 };
  const seat = { x: -8, y: 5 };

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
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(handlebar.x - 1, handlebar.y + 1);
  ctx.moveTo(hip.x, hip.y);
  ctx.lineTo(footFront.x, footFront.y);
  ctx.moveTo(hip.x + 0.8, hip.y + 0.4);
  ctx.lineTo(footBack.x, footBack.y);
  ctx.stroke();

  ctx.restore();

  drawChargeAboveRider(player.x, riderYPos);
}

function drawOverlayTelemetry() {
  ctx.fillStyle = "rgba(236,243,255,0.9)";
  ctx.font = "600 13px Inter, system-ui";
  const status = state.crashed
    ? "Respawning"
    : state.airborne
      ? state.descending
        ? "Air / Descend"
        : "Air / Ascend"
      : state.pedaling
        ? "Pedaling"
        : "Coasting";
  ctx.fillText(`State: ${status}`, 16, height - 18);
}

function drawCrashFlash() {
  if (state.crashFlash <= 0) return;
  ctx.fillStyle = `rgba(255, 80, 80, ${state.crashFlash * 0.35})`;
  ctx.fillRect(0, 0, width, height);
}

function frame(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;

  handleOrientation();
  update(dt);

  drawBackground();
  if (!state.orientationBlocked) {
    drawTrack();
    drawCheckpoints();
    drawRider();
    drawOverlayTelemetry();
    drawCrashFlash();
  }

  requestAnimationFrame(frame);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  buildTerrainSegments();
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildCheckpointMarks();
}

startButton.addEventListener("click", resetRun);
restartButton.addEventListener("click", resetRun);
window.addEventListener("pointerdown", onPressStart, { passive: true });
window.addEventListener("pointerup", onPressEnd, { passive: true });
window.addEventListener("pointercancel", onPressEnd, { passive: true });
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
