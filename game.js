const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const speedValue = document.getElementById("speedValue");
const chargeValue = document.getElementById("chargeValue");
const chargeFill = document.getElementById("chargeFill");
const chargeMarker = document.getElementById("chargeMarker");
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOver");
const gameOverTitle = document.getElementById("gameOverTitle");
const finalScore = document.getElementById("finalScore");
const feedback = document.getElementById("feedback");
const rotateNotice = document.getElementById("rotateNotice");

const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");

const physics = {
  gravity: 26,
  slopeGravity: 42,
  pedalAccel: 11,
  groundFriction: 1.6,
  airDrag: 0.11,
  maxSpeed: 34,
  minRollingSpeed: 2.8,
  jumpBaseImpulse: 8.6,
  jumpChargeImpulse: 8.5,
  chargeCapSeconds: 1,
  perfectMin: 0.74,
  perfectMax: 0.92,
  perfectJumpBonus: 1.4,
  perfectSpeedBonus: 1.25,
  flipTorque: 13,
  angularDamping: 1.2,
  landingAngleTolerance: 0.5,
  landingAngularTolerance: 5.3,
};

const rider = {
  wheelRadius: 11,
  wheelBase: 40,
  bodyHeight: 22,
};

const state = {
  running: false,
  over: false,
  orientationBlocked: false,
  worldX: 0,
  riderY: 0,
  vx: 9.5,
  vy: 0,
  airborne: false,
  holdActive: false,
  pedaling: false,
  charge: 0,
  chargeRatio: 0,
  canFlip: true,
  angle: 0,
  angularVelocity: 0,
  terrainAngle: 0,
  score: 0,
  displaySpeed: 0,
  suspension: 0,
  suspensionVel: 0,
  crashReason: "",
  clock: 0,
};

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
  return (
    base +
    Math.sin(worldX * 0.009) * 48 +
    Math.sin(worldX * 0.0042 + 0.45) * 34 +
    Math.sin(worldX * 0.0018 + 1.6) * 20
  );
}

function terrainSlope(worldX) {
  const dx = 10;
  return (terrainY(worldX + dx) - terrainY(worldX - dx)) / (dx * 2);
}

function terrainAngle(worldX) {
  return Math.atan(terrainSlope(worldX));
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function resetRun() {
  state.over = false;
  state.running = true;
  state.worldX = 0;
  state.vx = 9.5;
  state.vy = 0;
  state.airborne = false;
  state.holdActive = false;
  state.pedaling = false;
  state.charge = 0;
  state.chargeRatio = 0;
  state.canFlip = true;
  state.angle = terrainAngle(0);
  state.angularVelocity = 0;
  state.terrainAngle = state.angle;
  state.riderY = terrainY(0) - rider.wheelRadius - rider.bodyHeight;
  state.score = 0;
  state.displaySpeed = 0;
  state.suspension = 0;
  state.suspensionVel = 0;
  state.crashReason = "";
  state.clock = 0;
  updateHud();

  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  hud.classList.remove("hidden");
}

function endRun(crash = false, reason = "") {
  state.running = false;
  state.over = true;
  state.holdActive = false;
  state.pedaling = false;
  state.charge = 0;
  state.chargeRatio = 0;
  state.crashReason = reason;

  gameOverTitle.textContent = crash ? "Crash" : "Ride Complete";
  finalScore.textContent = Math.round(state.score);
  gameOverScreen.classList.add("visible");
}

function showFeedback(text, kind = "normal", duration = 760) {
  feedback.textContent = text;
  feedback.classList.add("visible");
  feedback.classList.toggle("perfect", kind === "perfect");
  feedback.classList.toggle("crash", kind === "crash");
  clearTimeout(showFeedback.timer);
  showFeedback.timer = setTimeout(() => feedback.classList.remove("visible"), duration);
}

function onPressStart() {
  if (!state.running || state.orientationBlocked) return;
  state.holdActive = true;

  if (state.airborne) {
    if (state.canFlip) {
      state.angularVelocity += physics.flipTorque;
      state.canFlip = false;
      showFeedback("Flip!", "normal", 460);
    }
    return;
  }

  state.pedaling = true;
}

function onPressEnd() {
  if (!state.running || state.orientationBlocked) return;
  state.holdActive = false;

  if (state.airborne) return;

  const ratio = state.chargeRatio;
  if (ratio > 0.08) {
    let jumpImpulse = physics.jumpBaseImpulse + physics.jumpChargeImpulse * ratio;
    let forwardBoost = 0;

    if (ratio >= physics.perfectMin && ratio <= physics.perfectMax) {
      jumpImpulse += physics.perfectJumpBonus;
      forwardBoost = physics.perfectSpeedBonus;
      showFeedback("Perfect", "perfect");
    }

    state.airborne = true;
    state.vy = -jumpImpulse;
    state.vx = Math.min(physics.maxSpeed, state.vx + forwardBoost);
    state.canFlip = true;
    state.pedaling = false;
    state.charge = 0;
    state.chargeRatio = 0;
    return;
  }

  state.pedaling = false;
  state.charge = 0;
  state.chargeRatio = 0;
}

function crash(reason) {
  showFeedback(reason, "crash", 1200);
  endRun(true, reason);
}

function updateGroundPhysics(dt) {
  const frontX = state.worldX + rider.wheelBase * 0.5;
  const slope = terrainSlope(frontX);
  const angle = Math.atan(slope);
  state.terrainAngle = angle;

  const gravityDrive = physics.slopeGravity * slope;
  state.vx += gravityDrive * dt;

  if (state.pedaling) {
    state.vx += physics.pedalAccel * dt;
    state.charge += dt;
  }

  const friction = physics.groundFriction * dt * Math.sign(state.vx);
  if (Math.abs(state.vx) > friction) {
    state.vx -= friction;
  } else {
    state.vx = 0;
  }

  state.vx = Math.max(physics.minRollingSpeed, Math.min(physics.maxSpeed, state.vx));
  state.worldX += state.vx * dt * 60;

  const targetY = terrainY(frontX) - rider.wheelRadius - rider.bodyHeight;
  state.riderY = targetY;

  const crouch = state.pedaling ? state.chargeRatio * 0.6 : 0;
  state.angle += (angle - state.angle) * Math.min(1, dt * 13) - crouch * 0.02;

  state.chargeRatio = Math.min(1, state.charge / physics.chargeCapSeconds);
}

function updateAirPhysics(dt) {
  state.vy += physics.gravity * dt;
  state.angularVelocity *= Math.max(0, 1 - physics.angularDamping * dt);
  state.angle += state.angularVelocity * dt;

  state.vx = Math.max(physics.minRollingSpeed, state.vx - physics.airDrag * dt);
  state.worldX += state.vx * dt * 60;
  state.riderY += state.vy * dt * 60;

  const frontX = state.worldX + rider.wheelBase * 0.5;
  const groundY = terrainY(frontX) - rider.wheelRadius - rider.bodyHeight;

  if (state.riderY >= groundY) {
    const landingAngle = terrainAngle(frontX);
    const angleDelta = Math.abs(normalizeAngle(state.angle - landingAngle));
    const angularSpeed = Math.abs(state.angularVelocity);

    if (angleDelta > physics.landingAngleTolerance || angularSpeed > physics.landingAngularTolerance) {
      crash(angleDelta > physics.landingAngleTolerance ? "Crash: bad angle" : "Crash: unstable landing");
      return;
    }

    state.airborne = false;
    state.riderY = groundY;
    state.vy = 0;
    state.charge = 0;
    state.chargeRatio = 0;
    state.pedaling = state.holdActive;
    state.angle = landingAngle;
    state.angularVelocity = 0;
    state.suspensionVel -= 1.9;
    showFeedback("Clean Landing", "normal", 520);
  }
}

function updateSuspension(dt) {
  const stiffness = 21;
  const damping = 8.8;
  state.suspensionVel += (-state.suspension * stiffness - state.suspensionVel * damping) * dt;
  state.suspension += state.suspensionVel * dt;
}

function updateHud() {
  state.displaySpeed += (state.vx - state.displaySpeed) * 0.2;
  speedValue.textContent = state.displaySpeed.toFixed(1);
  const pct = Math.round(state.chargeRatio * 100);
  chargeValue.textContent = `${pct}%`;
  chargeFill.style.width = `${pct}%`;
  chargeMarker.style.left = `${pct}%`;
}

function update(dt) {
  if (!state.running || state.orientationBlocked) return;

  state.clock += dt;

  if (!state.airborne) {
    updateGroundPhysics(dt);
  } else {
    updateAirPhysics(dt);
  }

  if (!state.running) return;

  updateSuspension(dt);
  state.score += state.vx * dt * (state.airborne ? 0.8 : 1.1);
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
    const y = height * 0.16 + i * 90 + Math.sin(state.clock * 0.4 + i * 0.8) * 8;
    ctx.fillRect(0, y, width, 2);
  }
}

function drawTrack() {
  const playerScreenX = width * 0.3;
  const startX = state.worldX - playerScreenX - 120;
  const endX = startX + width + 240;

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
  for (let world = startX; world <= endX; world += 4) {
    const x = world - startX - 120;
    const y = terrainY(world);
    if (world === startX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#8fe8ff";
  ctx.stroke();
}

function drawChargeHint(playerX, playerY) {
  if (state.airborne || state.chargeRatio <= 0) return;
  const widthBar = 80;
  const h = 7;
  const x = playerX - widthBar * 0.5;
  const y = playerY - 52;
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillRect(x, y, widthBar, h);
  ctx.fillStyle = "#7ee7ff";
  ctx.fillRect(x, y, widthBar * state.chargeRatio, h);
}

function drawRider() {
  const playerScreenX = width * 0.3;
  const compress = Math.max(-8, Math.min(8, state.suspension * 120));
  const riderY = state.riderY + compress;

  const pedalSpeed = state.pedaling ? 7.5 : 3.1;
  const pedalPhase = state.clock * pedalSpeed;
  const crouch = state.pedaling && !state.airborne ? state.chargeRatio * 5.5 : 0;
  const extend = state.airborne ? Math.max(-3, -state.vy * 0.12) : 0;

  const frontWheel = { x: 16, y: 16 };
  const rearWheel = { x: -16, y: 16 };
  const crank = { x: -2, y: 10 };
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
  ctx.translate(playerScreenX, riderY);
  ctx.rotate(state.angle);

  const hip = { x: -1, y: -crouch + extend };
  const shoulder = { x: 2, y: -11 - crouch * 0.65 + extend * 0.4 };
  const head = { x: 4, y: -22 - crouch * 0.4 + extend * 0.6 };
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

  drawChargeHint(playerScreenX, riderY);
}

function drawOverlayTelemetry() {
  ctx.fillStyle = "rgba(236,243,255,0.9)";
  ctx.font = "600 14px Inter, system-ui";
  ctx.textAlign = "left";
  const status = state.airborne ? "Air" : state.pedaling ? "Pedaling" : "Coasting";
  ctx.fillText(`State: ${status}`, 16, height - 18);
}

function frame(ts) {
  const dt = Math.min(0.033, (ts - lastTime) / 1000 || 0.016);
  lastTime = ts;

  handleOrientation();
  update(dt);

  drawBackground();
  if (!state.orientationBlocked) {
    drawTrack();
    drawRider();
    drawOverlayTelemetry();
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
