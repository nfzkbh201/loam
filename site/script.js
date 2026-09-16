const canvas = document.querySelector("#authority-map");
const ctx = canvas.getContext("2d");

const labels = [
  "web",
  "agent context",
  "shell",
  "repo write",
  "deploy",
  "secrets",
  "MCP",
  "approval",
  "ABOM",
];

const nodes = labels.map((label, index) => ({
  label,
  angle: (Math.PI * 2 * index) / labels.length,
  orbit: 0.22 + (index % 3) * 0.09,
  speed: 0.00018 + (index % 4) * 0.000035,
  tone: index % 3,
}));

const links = [
  [0, 1],
  [1, 2],
  [3, 4],
  [6, 5],
  [1, 6],
  [7, 4],
  [8, 1],
  [0, 6],
  [2, 5],
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

function nodePosition(node, time) {
  const centerX = width * 0.68;
  const centerY = height * 0.48;
  const radius = Math.min(width, height) * node.orbit;
  const drift = Math.sin(time * node.speed * 1.7 + node.angle) * 22;
  const x = centerX + Math.cos(node.angle + time * node.speed) * (radius + drift);
  const y = centerY + Math.sin(node.angle + time * node.speed * 1.25) * (radius * 0.68 + drift);
  return { x, y };
}

function drawGrain() {
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 140; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = i % 2 ? "#fffdf5" : "#d8a23a";
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
}

function render(time) {
  ctx.clearRect(0, 0, width, height);

  const grd = ctx.createLinearGradient(0, 0, width, height);
  grd.addColorStop(0, "#11130f");
  grd.addColorStop(0.48, "#17251f");
  grd.addColorStop(1, "#143456");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

  const terrain = ctx.createLinearGradient(0, height * 0.64, width, height);
  terrain.addColorStop(0, "rgba(155, 79, 50, 0.56)");
  terrain.addColorStop(0.55, "rgba(216, 162, 58, 0.34)");
  terrain.addColorStop(1, "rgba(34, 73, 59, 0.42)");
  ctx.fillStyle = terrain;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 32) {
    const y =
      height * 0.76 +
      Math.sin(x * 0.012 + time * 0.0007) * 22 +
      Math.cos(x * 0.021) * 16;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  const positions = nodes.map((node) => nodePosition(node, time));

  links.forEach(([from, to], index) => {
    const a = positions[from];
    const b = positions[to];
    const pulse = 0.34 + Math.sin(time * 0.0016 + index) * 0.16;
    ctx.strokeStyle = `rgba(255, 253, 245, ${pulse})`;
    ctx.lineWidth = index % 3 === 0 ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  positions.forEach((pos, index) => {
    const node = nodes[index];
    const colors = ["#d8a23a", "#8bb7a1", "#9fb6e8"];
    const activeDistance = pointer.active
      ? Math.hypot(pointer.x - pos.x, pointer.y - pos.y)
      : 999;
    const scale = activeDistance < 130 ? 1.3 : 1;

    ctx.fillStyle = colors[node.tone];
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5.8 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 253, 245, 0.74)";
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.fillText(node.label, pos.x + 14, pos.y + 5);
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
