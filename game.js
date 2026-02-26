const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const speedValue = document.getElementById("speedValue");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const gameOverTitle = document.getElementById("gameOverTitle");
const finalScore = document.getElementById("finalScore");
const feedback = document.getElementById("feedback");
const rotateNotice = document.getElementById("rotateNotice");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const tuningToggle = document.getElementById("tuningToggle");
const tuningPanel = document.getElementById("tuningPanel");
const tuningClose = document.getElementById("tuningClose");
const tuningControls = document.getElementById("tuningControls");
const resetTuning = document.getElementById("resetTuning");

const STORAGE_KEY = "flowline-rider-v0.11.0-tuning";

const physics = {
  gravity: 28,
  pedalAccel: 7.2,
  rollingFriction: 1.05,
  airDrag: 0.14,
  minSpeed: 2,
  maxSpeed: 29,
  maxVisibleJumpVy: 14,
  chargeCapSeconds: 1,
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
  wheelRadius: 11,
  wheelBase: 42,
  bodyHeight: 23,
  comHeight: 27,
};

const tuningDefaults = {
  physics: {
    gravity: 28,
    pedalAccel: 7.2,
    rollingFriction: 1.05,
    maxSpeed: 29,
  },
  terrain: {
    lengthMultiplier: 1,
    hillHeightMultiplier: 1,
    hillSpacingMultiplier: 1,
  },
  camera: {
    followSmoothness: 1,
    zoomLevel: 1,
  },
};

const tuning = structuredClone(tuningDefaults);

const tuningSchema = [
  { section: "physics", key: "gravity", label: "Gravity strength", min: 16, max: 40, step: 0.1 },
  { section: "physics", key: "pedalAccel", label: "Pedaling acceleration", min: 3, max: 14, step: 0.1 },
  { section: "physics", key: "rollingFriction", label: "Friction", min: 0.3, max: 2.2, step: 0.01 },
  { section: "physics", key: "maxSpeed", label: "Max speed", min: 12, max: 40, step: 0.1 },
  { section: "terrain", key: "lengthMultiplier", label: "Terrain length", min: 0.6, max: 1.8, step: 0.01 },
  { section: "terrain", key: "hillHeightMultiplier", label: "Hill height multiplier", min: 0.5, max: 2, step: 0.01 },
  { section: "terrain", key: "hillSpacingMultiplier", label: "Hill spacing multiplier", min: 0.6, max: 1.8, step: 0.01 },
  { section: "camera", key: "followSmoothness", label: "Follow smoothness", min: 0.05, max: 1, step: 0.01 },
  { section: "camera", key: "zoomLevel", label: "Zoom level", min: 0.8, max: 1.3, step: 0.01 },
];

const state = {
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
  cameraWorldX: 0,
};

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = 0;
let tuningPanelOpen = false;

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
  const sampleX = worldX / tuning.terrain.lengthMultiplier;
  const spacingScale = 1 / tuning.terrain.hillSpacingMultiplier;
  const base = height * 0.69;
  return (
    base +
    (Math.sin(sampleX * 0.0082 * spacingScale) * 44 +
      Math.sin(sampleX * 0.004 * spacingScale + 0.54) * 32 +
      Math.sin(sampleX * 0.0018 * spacingScale + 1.9) * 16) *
      tuning.terrain.hillHeightMultiplier
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

function syncPhysicsWithTuning() {
  physics.gravity = tuning.physics.gravity;
  physics.pedalAccel = tuning.physics.pedalAccel;
  physics.rollingFriction = tuning.physics.rollingFriction;
  physics.maxSpeed = tuning.physics.maxSpeed;
}

function saveTuning() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tuning));
}

function loadTuning() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    for (const config of tuningSchema) {
      const value = parsed?.[config.section]?.[config.key];
      if (typeof value === "number" && Number.isFinite(value)) {
        tuning[config.section][config.key] = Math.max(config.min, Math.min(config.max, value));
      }
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function setTuningValue(section, key, value) {
  tuning[section][key] = value;
  syncPhysicsWithTuning();
  saveTuning();
}

function makeTuningControl(config) {
  const row = document.createElement("label");
  row.className = "tuning-row";

  const title = document.createElement("span");
  title.className = "tuning-label";
  title.textContent = config.label;

  const value = document.createElement("span");
  value.className = "tuning-value";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(config.min);
  slider.max = String(config.max);
  slider.step = String(config.step);
  slider.value = String(tuning[config.section][config.key]);

  const refresh = () => {
    value.textContent = Number(slider.value).toFixed(config.step < 0.1 ? 2 : 1);
  };

  slider.addEventListener("input", () => {
    setTuningValue(config.section, config.key, Number(slider.value));
    refresh();
  });

  refresh();
  row.append(title, value, slider);
  tuningControls.appendChild(row);
}

function buildTuningUI() {
  tuningControls.innerHTML = "";
  for (const config of tuningSchema) {
    makeTuningControl(config);
  }
}

function openTuningPanel() {
  tuningPanelOpen = true;
  tuningPanel.classList.add("visible");
  tuningPanel.setAttribute("aria-hidden", "false");
}

function closeTuningPanel() {
  tuningPanelOpen = false;
  tuningPanel.classList.remove("visible");
  tuningPanel.setAttribute("aria-hidden", "true");
}

function resetRun() {
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
  state.charge = 0;
  state.chargeRatio = 0;
  state.angle = terrainAngle(0);
  state.angularVelocity = 0;
  state.terrainAngle = state.angle;
  state.riderY = terrainY(0) - rider.wheelRadius - rider.bodyHeight;
  state.score = 0;
  state.displaySpeed = 0;
  state.suspension = 0;
  state.suspensionVel = 0;
  state.tipTimer = 0;
  state.clock = 0;

  updateHud();
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  hud.classList.remove("hidden");
}

function endRun(crash = false) {
  state.running = false;
  state.over = true;
  state.holdActive = false;
  state.pedaling = false;
  state.charge = 0;
  state.chargeRatio = 0;

  gameOverTitle.textContent = crash ? "Crash" : "Ride Complete";
  finalScore.textContent = Math.round(state.score);
  gameOverScreen.classList.add("visible");
}

function showFeedback(text, kind = "normal", duration = 700) {
  feedback.textContent = text;
  feedback.classList.add("visible");
  feedback.classList.toggle("crash", kind === "crash");
  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(() => feedback.classList.remove("visible"), duration);
}

function onPressStart() {
  if (!state.running || state.orientationBlocked || tuningPanelOpen) return;
  state.holdActive = true;

  if (state.airborne && !state.descending) {
    state.angularVelocity += physics.flipImpulse;
    showFeedback("Flip", "normal", 320);
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
  if (!state.running || state.orientationBlocked || tuningPanelOpen) return;
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

function crash(reason) {
  showFeedback(reason, "crash", 1100);
  endRun(true);
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
  const gravityAlong = (physics.gravity * slope) / slopeNorm;

  state.vx += gravityAlong * dt;

  updateCharge(dt, true);
  if (state.pedaling) {
    state.vx += physics.pedalAccel * dt;
  }

  const friction = physics.rollingFriction * dt;
  if (state.vx > friction) state.vx -= friction;
  else if (state.vx < -friction) state.vx += friction;
  else state.vx = 0;

  state.vx = Math.max(physics.minSpeed, Math.min(physics.maxSpeed, state.vx));
  state.worldX += state.vx * dt * 60;

  state.terrainAngle = terrainAngle(state.worldX);
  const targetY = terrainY(state.worldX) - rider.wheelRadius - rider.bodyHeight;
  state.riderY = targetY;

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
    crash("Lost balance");
  }
}

function evaluateLanding() {
  const terrain = terrainAngle(state.worldX);
  const pitchDelta = normalizeAngle(state.angle - terrain);
  const angVel = Math.abs(state.angularVelocity);

  if (Math.abs(pitchDelta) > physics.hardCrashPitch || angVel > physics.hardCrashAngular) {
    crash("Hard impact");
    return;
  }

  if (Math.abs(pitchDelta) > physics.recoverablePitch && angVel > physics.recoverableAngular) {
    crash("Could not recover");
    return;
  }

  state.airborne = false;
  state.vy = 0;
  state.riderY = terrainY(state.worldX) - rider.wheelRadius - rider.bodyHeight;
  state.terrainAngle = terrain;
  state.suspensionVel -= 1.8;
  state.tipTimer = 0;
  showFeedback("Landing", "normal", 360);

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
  state.displaySpeed += (state.vx - state.displaySpeed) * 0.18;
  speedValue.textContent = state.displaySpeed.toFixed(1);
}

function updateCamera(dt) {
  const t = Math.min(1, dt * 60 * tuning.camera.followSmoothness);
  state.cameraWorldX += (state.worldX - state.cameraWorldX) * t;
}

function update(dt) {
  if (!state.running || state.orientationBlocked || tuningPanelOpen) return;

  state.clock += dt;
  if (state.airborne) updateAirPhysics(dt);
  else updateGroundPhysics(dt);

  if (!state.running) return;

  const riderTop = state.riderY - 40;
  if (riderTop < 10 && state.vy < -3.6) {
    state.vy = -3.6;
  }

  updateSuspension(dt);
  updateCamera(dt);
  state.score += state.vx * dt * (state.airborne ? 0.9 : 1.2);
  updateHud();
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#101a35");
  grad.addColorStop(1, "#090e1d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(126, 231, 255, 0.06)";
  for (let i = 0; i < 4; i += 1) {
    const y = height * 0.16 + i * 90 + Math.sin(state.clock * 0.35 + i * 0.8) * 8;
    ctx.fillRect(0, y, width, 2);
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

  const fill = ctx.createLinearGradient(0, height * 0.4, 0, height);
  fill.addColorStop(0, "#243260");
  fill.addColorStop(1, "#0f1730");
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
  ctx.strokeStyle = "#8fe8ff";
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

  drawChargeAboveRider(riderScreenX, riderY);
}

function drawOverlayTelemetry() {
  ctx.fillStyle = "rgba(236,243,255,0.9)";
  ctx.font = "600 13px Inter, system-ui";
  const status = state.airborne ? (state.descending ? "Air / Descend" : "Air / Ascend") : state.pedaling ? "Pedaling" : "Coasting";
  ctx.fillText(`State: ${status}`, 16, height - 18);
}

function frame(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;

  handleOrientation();
  update(dt);

  drawBackground();
  if (!state.orientationBlocked) {
    ctx.save();
    const zoom = tuning.camera.zoomLevel;
    const cx = width * 0.5;
    const cy = height * 0.5;
    ctx.translate(cx, cy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    drawTrack();
    drawRider();
    drawOverlayTelemetry();
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

startButton.addEventListener("click", resetRun);
restartButton.addEventListener("click", resetRun);
window.addEventListener("pointerdown", onPressStart, { passive: true });
window.addEventListener("pointerup", onPressEnd, { passive: true });
window.addEventListener("pointercancel", onPressEnd, { passive: true });
window.addEventListener("resize", () => {
  resize();
  handleOrientation();
});

tuningToggle.addEventListener("click", () => {
  if (tuningPanelOpen) closeTuningPanel();
  else openTuningPanel();
});
tuningClose.addEventListener("click", closeTuningPanel);
tuningPanel.addEventListener("click", (event) => {
  if (event.target === tuningPanel) closeTuningPanel();
});

resetTuning.addEventListener("click", () => {
  Object.assign(tuning.physics, tuningDefaults.physics);
  Object.assign(tuning.terrain, tuningDefaults.terrain);
  Object.assign(tuning.camera, tuningDefaults.camera);
  syncPhysicsWithTuning();
  saveTuning();
  buildTuningUI();
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

loadTuning();
syncPhysicsWithTuning();
buildTuningUI();
resize();
handleOrientation();
requestAnimationFrame(frame);
