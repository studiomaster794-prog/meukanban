export function drawBarChart(canvas, labels, values, colors) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const max = Math.max(1, ...values);
  const gap = 14;
  const barWidth = (rect.width - gap * (values.length + 1)) / values.length;
  ctx.font = "12px Inter, sans-serif";
  values.forEach((value, index) => {
    const height = (rect.height - 54) * (value / max);
    const x = gap + index * (barWidth + gap);
    const y = rect.height - height - 30;
    const gradient = ctx.createLinearGradient(0, y, 0, rect.height);
    gradient.addColorStop(0, colors[index % colors.length]);
    gradient.addColorStop(1, "rgba(255,255,255,0.12)");
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, barWidth, height, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.textAlign = "center";
    ctx.fillText(labels[index], x + barWidth / 2, rect.height - 10);
  });
}

export function drawDonutChart(canvas, items) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const total = Math.max(1, items.reduce((sum, item) => sum + item.value, 0));
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(rect.width, rect.height) / 3;
  let start = -Math.PI / 2;
  items.forEach((item) => {
    const angle = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 26;
    ctx.lineCap = "round";
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.stroke();
    start += angle;
  });
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = "700 22px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round((items[0]?.value || 0) / total * 100)}%`, centerX, centerY + 7);
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}
