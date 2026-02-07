import express from "express";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// ================= HEALTHCHECK =================
app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.json({ ok: true }));

// ================= UTIL =================
function escapeXml(unsafe = "") {
  return String(unsafe)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

// hash simples e estável (pra escolher paleta pela frase/autor)
function hashStr(s = "") {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// paletas vintage claras (bg1/bg2 = gradiente; fg = texto; accent = detalhe)
const PALETTES = [
  { bg1: "#F6E7D7", bg2: "#E8C7A6", fg: "#5A4636", accent: "#D97B4A" }, // creme / terracota
  { bg1: "#EADFC8", bg2: "#CBB89D", fg: "#4E4438", accent: "#A67C52" }, // bege antigo / marrom claro
  { bg1: "#DCE8D2", bg2: "#B7C9A8", fg: "#3E4A3F", accent: "#6E8B6B" }, // sálvia / oliva suave
  { bg1: "#F4D6C6", bg2: "#E7A98A", fg: "#5B3A2E", accent: "#C46A4A" }, // pêssego / queimado
  { bg1: "#D9E6E2", bg2: "#AFC8C2", fg: "#3B4B4B", accent: "#5F8F8B" }, // verde água vintage
  { bg1: "#F1E3C6", bg2: "#E2C799", fg: "#5A4A32", accent: "#C9A24D" }, // mostarda clara / areia
  { bg1: "#E6D3D1", bg2: "#C9A7A4", fg: "#4F3E3C", accent: "#9C6B66" }, // rosé antigo / argila
  { bg1: "#E4DCCF", bg2: "#BFAF9B", fg: "#4A4338", accent: "#8C7B6A" }, // papel envelhecido
];

// normaliza hex tipo "%23FFFFFF" ou "FFFFFF" ou "#FFF"
function normalizeHex(hex, fallback) {
  if (!hex) return fallback;
  let v = String(hex).trim();
  v = v.replace("%23", "#");
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) {
    v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return v;
}

function choosePalette(frase, autor) {
  const h = hashStr(`${frase}||${autor}`);
  return PALETTES[h % PALETTES.length];
}

function wrapText(text, maxChars = 30) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length <= maxChars) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 10); // limite de linhas para evitar overflow
}

// Ajuste de tipografia dinâmica baseado no comprimento da frase
function computeTypography(frase) {
  const len = (frase || "").length;

  // Valores base (reduzidos conforme solicitado pelo usuário)
  let fontSize = 48; // Era 64/56
  let maxChars = 24; // Era 30/22

  if (len > 140) {
    fontSize = 40;
    maxChars = 28;
  }
  if (len > 220) {
    fontSize = 34;
    maxChars = 32;
  }
  if (len > 320) {
    fontSize = 28;
    maxChars = 36;
  }

  const lineHeight = Math.round(fontSize * 1.35);
  return { maxChars, fontSize, lineHeight };
}

function svgCard({ frase, autor, bg, fg, accent }) {
  const width = 1080;
  const height = 1920;

  // ÁREA SEGURA
  const safePaddingX = 180;
  const safePaddingY = 220;

  // Obtém configurações de tipografia
  const { maxChars, fontSize, lineHeight } = computeTypography(frase);

  const lines = wrapText(frase, maxChars);
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round((height - blockHeight) / 2);

  const tspans = lines.map((ln, i) =>
    `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`
  ).join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <radialGradient id="g" cx="50%" cy="40%" r="80%">
        <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
        <stop offset="100%" stop-color="#111" stop-opacity="1"/>
      </radialGradient>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.03"/>
        </feComponentTransfer>
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" filter="url(#noise)"/>

    <line x1="${safePaddingX}" x2="${width - safePaddingX}"
          y1="${safePaddingY - 80}" y2="${safePaddingY - 80}"
          stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.8"/>

    <text x="540" y="${startY}"
      text-anchor="middle"
      fill="${fg}"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="700">
      ${tspans}
    </text>

    ${autor ? `
    <text x="540" y="${height - safePaddingY}"
      text-anchor="middle"
      fill="${fg}"
      opacity="0.85"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="28"
      font-weight="500">— ${escapeXml(autor)}</text>` : ""}
  </svg>`;
}

async function renderPng({ frase, autor, bg, fg, accent }) {
  const svg = svgCard({ frase, autor, bg, fg, accent });
  return await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
}

function sendPng(res, pngBuffer) {
  res.status(200);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", 'inline; filename="card.png"');
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Content-Length", String(pngBuffer.length));
  res.end(pngBuffer);
}

app.head("/card.png", (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).end();
});

app.get("/card.png", async (req, res) => {
  try {
    const frase = (req.query.frase || "").toString().trim();
    const autor = (req.query.autor || "").toString().trim();

    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const p = choosePalette(frase, autor);
    const bg = normalizeHex(req.query.bg || req.query.bg1, p.bg1);
    const fg = normalizeHex(req.query.fg, p.fg);
    const accent = normalizeHex(req.query.accent, p.accent);

    const png = await renderPng({ frase, autor, bg, fg, accent });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.post("/card", async (req, res) => {
  try {
    const { frase, autor } = req.body || {};
    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const f = String(frase).trim();
    const a = typeof autor === "string" ? autor.trim() : "";

    const p = choosePalette(f, a);
    const bg = normalizeHex(req.body?.bg || req.body?.bg1, p.bg1);
    const fg = normalizeHex(req.body?.fg, p.fg);
    const accent = normalizeHex(req.body?.accent, p.accent);

    const png = await renderPng({ frase: f, autor: a, bg, fg, accent });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
