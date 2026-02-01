const express = require("express");
const app = express();

app.use(express.json({ limit: "1mb" }));

// ================= HEALTHCHECK (ESSENCIAL PRO EASYPANEL) =================
app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.json({ ok: true }));

// ================= UTIL =================
function escapeXml(unsafe = "") {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function wrapText(text, maxChars = 28) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length <= maxChars) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 8);
}

// ================= SVG CARD =================
function svgCard({ frase, autor, bg = "#0B0B0F", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;
  const lines = wrapText(frase, 28);

  const lineHeight = 78;
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round((height / 2) - (blockHeight / 2));

  const tspans = lines.map((ln, i) =>
    `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`
  ).join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bg}"/>

  <text x="540" y="${startY}"
    text-anchor="middle"
    fill="${fg}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="64"
    font-weight="700">
    ${tspans}
  </text>

  ${autor ? `
  <text x="540" y="980"
    text-anchor="middle"
    fill="${fg}"
    opacity="0.85"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="34"
    font-weight="500">— ${escapeXml(autor)}</text>` : ""}
</svg>`;
}

// ================= ENDPOINT PRINCIPAL =================
app.post("/card", (req, res) => {
  try {
    const { frase, autor, bg, fg } = req.body || {};

    if (!frase) {
      return res.status(400).json({ error: "frase é obrigatória" });
    }

    const svg = svgCard({ frase, autor, bg, fg });

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Content-Disposition", 'inline; filename="card.svg"');
    res.setHeader("Cache-Control", "no-store");

    res.send(svg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "erro ao gerar card" });
  }
});

// ================= START =================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
