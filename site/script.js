const canvas = document.querySelector("#authority-map");
const ctx = canvas.getContext("2d");

const targets = [
  { label: "web", x: 0.2, y: 0.2, tone: "#d8a23a", weight: "high" },
  { label: "MCP", x: 0.78, y: 0.18, tone: "#8bb7a1", weight: "medium" },
  { label: "secrets", x: 0.88, y: 0.52, tone: "#9fb6e8", weight: "critical" },
  { label: "shell", x: 0.68, y: 0.84, tone: "#d8a23a", weight: "critical" },
  { label: "deploy", x: 0.18, y: 0.76, tone: "#9b4f32", weight: "high" },
  { label: "repo write", x: 0.1, y: 0.48, tone: "#8bb7a1", weight: "medium" },
];

let pointer = { x: 0, y: 0, active: false };
let width = 0;
let height = 0;
let ratio = 1;

function resize() {
  ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function targetPosition(target, index, time) {
  const driftX = Math.cos(time * 0.001 + index * 1.7) * 9;
  const driftY = Math.sin(time * 0.0012 + index * 1.1) * 7;
  return {
    x: target.x * width + driftX,
    y: target.y * height + driftY,
  };
}

function drawGrain() {
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 70; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = i % 2 ? "#fffdf5" : "#d8a23a";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function render(time) {
  ctx.clearRect(0, 0, width, height);

  const center = { x: width * 0.5, y: height * 0.5 };
  const radius = Math.min(width, height) * 0.24;
  const positions = targets.map((target, index) => targetPosition(target, index, time));

  const glow = ctx.createRadialGradient(center.x, center.y, 8, center.x, center.y, width * 0.62);
  glow.addColorStop(0, "rgba(216, 162, 58, 0.12)");
  glow.addColorStop(0.45, "rgba(34, 73, 59, 0.1)");
  glow.addColorStop(1, "rgba(255, 253, 245, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  for (let ring = 0; ring < 4; ring += 1) {
    const offset = ring * 16;
    ctx.strokeStyle = `rgba(255, 253, 245, ${0.12 - ring * 0.018})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 180; i += 1) {
      const angle = (Math.PI * 2 * i) / 180;
      const wave =
        Math.sin(angle * 3 + time * 0.0011 + ring) * 10 +
        Math.cos(angle * 5 - time * 0.0008) * 6;
      const r = radius + offset + wave;
      const x = center.x + Math.cos(angle) * r * 1.22;
      const y = center.y + Math.sin(angle) * r * 0.72;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  const lineColors = ["#22493b", "#d8a23a", "#9b4f32"];
  lineColors.forEach((color, index) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 72; i += 1) {
      const t = i / 72;
      const x = center.x - radius * 1.15 + t * radius * 2.3;
      const y =
        center.y -
        26 +
        index * 25 +
        Math.sin(t * Math.PI * 2 + time * 0.0013 + index) * 8;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  });

  positions.forEach((pos, index) => {
    const pulse = 0.24 + Math.sin(time * 0.002 + index) * 0.1;
    ctx.strokeStyle = `rgba(255, 253, 245, ${pulse})`;
    ctx.lineWidth = targets[index].weight === "critical" ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(center.x, center.y);
    ctx.stroke();
  });

  positions.forEach((pos, index) => {
    const target = targets[index];
    const activeDistance = pointer.active
      ? Math.hypot(pointer.x - pos.x, pointer.y - pos.y)
      : 999;
    const scale = activeDistance < 120 ? 1.26 : 1;
    const nodeRadius = target.weight === "critical" ? 7 : 5.6;

    ctx.fillStyle = target.tone;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, nodeRadius * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = target.weight === "critical"
      ? "rgba(255, 151, 122, 0.72)"
      : "rgba(255, 253, 245, 0.24)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, nodeRadius * 2.3 * scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 253, 245, 0.74)";
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.textAlign = pos.x > width * 0.72 ? "right" : "left";
    ctx.fillText(target.label, pos.x > width * 0.72 ? pos.x - 14 : pos.x + 14, pos.y + 5);
    ctx.textAlign = "left";
  });

  drawGrain();
  requestAnimationFrame(render);
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", (event) => {
  const bounds = canvas.getBoundingClientRect();
  pointer = {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
    active: true,
  };
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

resize();
requestAnimationFrame(render);
