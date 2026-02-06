import express from "express";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// ================= HEALTHCHECK (ESSENCIAL PRO EASYPANEL) =================
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

<<<<<<< HEAD
// hash simples e estável (pra escolher paleta pela frase/autor)
function hashStr(s = "") {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// paletas (bg1/bg2 = gradiente; fg = texto; accent = detalhe)
const PALETTES = [
  { bg1: "#0B132B", bg2: "#1C2541", fg: "#F7F7FF", accent: "#5BC0BE" }, // navy/teal
  { bg1: "#111827", bg2: "#0B0F1A", fg: "#F9FAFB", accent: "#F59E0B" }, // graphite/amber
  { bg1: "#0F172A", bg2: "#1E293B", fg: "#E2E8F0", accent: "#22C55E" }, // slate/green
  { bg1: "#2B193D", bg2: "#3A1C71", fg: "#FFF7ED", accent: "#FB7185" }, // purple/pink
  { bg1: "#0B3D2E", bg2: "#073B4C", fg: "#F8FAFC", accent: "#FFD166" }, // deep teal/yellow
  { bg1: "#2D1B0F", bg2: "#1F2937", fg: "#FFF7ED", accent: "#60A5FA" }, // warm brown/blue
  { bg1: "#0A0A0A", bg2: "#1F1F1F", fg: "#FFFFFF", accent: "#A3E635" }, // dark/lime
  { bg1: "#123524", bg2: "#0F766E", fg: "#F0FDFA", accent: "#FB923C" }, // green/teal/orange
];

// normaliza hex tipo "%23FFFFFF" ou "FFFFFF" ou "#FFF"
function normalizeHex(hex, fallback) {
  if (!hex) return fallback;
  let v = String(hex).trim();
  v = v.replace("%23", "#");
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) {
    // #RGB -> #RRGGBB
    v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return v;
}

function choosePalette(frase, autor) {
  const h = hashStr(`${frase}||${autor}`);
  return PALETTES[h % PALETTES.length];
}

async function wrapTextByWidth(text, fontSize, maxWidth) {
=======
// hash simples e estável (pra escolher paleta pela frase/autor)
function hashStr(s = "") {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// paletas (bg1/bg2 = gradiente; fg = texto; accent = detalhe)
const PALETTES = [
  { bg1: "#0B132B", bg2: "#1C2541", fg: "#F7F7FF", accent: "#5BC0BE" }, // navy/teal
  { bg1: "#111827", bg2: "#0B0F1A", fg: "#F9FAFB", accent: "#F59E0B" }, // graphite/amber
  { bg1: "#0F172A", bg2: "#1E293B", fg: "#E2E8F0", accent: "#22C55E" }, // slate/green
  { bg1: "#2B193D", bg2: "#3A1C71", fg: "#FFF7ED", accent: "#FB7185" }, // purple/pink
  { bg1: "#0B3D2E", bg2: "#073B4C", fg: "#F8FAFC", accent: "#FFD166" }, // deep teal/yellow
  { bg1: "#2D1B0F", bg2: "#1F2937", fg: "#FFF7ED", accent: "#60A5FA" }, // warm brown/blue
  { bg1: "#0A0A0A", bg2: "#1F1F1F", fg: "#FFFFFF", accent: "#A3E635" }, // dark/lime
  { bg1: "#123524", bg2: "#0F766E", fg: "#F0FDFA", accent: "#FB923C" }, // green/teal/orange
];

// normaliza hex tipo "%23FFFFFF" ou "FFFFFF" ou "#FFF"
function normalizeHex(hex, fallback) {
  if (!hex) return fallback;
  let v = String(hex).trim();
  v = v.replace("%23", "#");
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) {
    // #RGB -> #RRGGBB
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
>>>>>>> 1d92bf4448b44601324c98e0b71250adc2c0548e
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;

    const svg = `
      <svg width="1080" height="200">
        <text x="0" y="100"
          font-family="DejaVu Sans, Arial, sans-serif"
          font-size="${fontSize}"
          font-weight="700">${escapeXml(test)}</text>
      </svg>`;

    const { info } = await sharp(Buffer.from(svg)).png().toBuffer({ resolveWithObject: true });

    if (info.width > maxWidth) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }

  if (line) lines.push(line);
<<<<<<< HEAD
  return lines;
=======
  return lines.slice(0, 10); // limite de linhas
>>>>>>> 1d92bf4448b44601324c98e0b71250adc2c0548e
}

// Ajuste “bonito”: tenta encaixar sem ficar gigante
function computeTypography(frase) {
  const len = (frase || "").length;

  // base
  let maxChars = 30;
  let fontSize = 64;

  // se muito longa, reduz um pouco e permite mais chars por linha
  if (len > 140) {
    fontSize = 54;
    maxChars = 34;
  }
  if (len > 220) {
    fontSize = 48;
    maxChars = 36;
  }
  if (len > 320) {
    fontSize = 42;
    maxChars = 38;
  }

  // lineHeight proporcional
  const lineHeight = Math.round(fontSize * 1.25);
  return { maxChars, fontSize, lineHeight };
}

async function svgCard({ frase, autor, bg1, bg2, fg, accent }) {
  const width = 1080;
  const height = 1080;

  // tamanho base mais elegante
  let fontSize = 66;

  // área segura lateral (margem)
  const safeWidth = 840;

  // quebra REAL por largura
  let lines = await wrapTextByWidth(frase, fontSize, safeWidth);

  // se ainda ficou muitas linhas, reduz fonte automaticamente
  while (lines.length > 7) {
    fontSize -= 4;
    lines = await wrapTextByWidth(frase, fontSize, safeWidth);
  }

  const lineHeight = Math.round(fontSize * 1.28);
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round(height / 2 - blockHeight / 2);

  const tspans = lines
    .map(
      (ln, i) =>
        `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`
    )
    .join("");

  const authorSize = Math.round(fontSize * 0.45);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>

    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3"/>
      <feColorMatrix type="matrix" values="
        1 0 0 0 0
        0 1 0 0 0
        0 0 1 0 0
        0 0 0 0.08 0"/>
    </filter>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.55"/>

  <rect x="140" y="120" width="800" height="6" rx="3" fill="${accent}" opacity="0.55"/>

  <text x="540" y="${startY}"
    text-anchor="middle"
    fill="${fg}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="700">
    ${tspans}
  </text>

  ${
    autor
      ? `<text x="540" y="980"
        text-anchor="middle"
        fill="${fg}"
        opacity="0.86"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="${authorSize}"
        font-weight="500">— ${escapeXml(autor)}</text>`
      : ""
  }
</svg>`;
}


async function renderPng({ frase, autor, bg1, bg2, fg, accent }) {
  const svg = svgCard({ frase, autor, bg1, bg2, fg, accent });
  const png = await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
  return png;
}

function sendPng(res, pngBuffer) {
  res.status(200);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", 'inline; filename="card.png"');
  res.setHeader("Cache-Control", "public, max-age=60"); // ajuda a Meta
  res.setHeader("Content-Length", String(pngBuffer.length));
  res.end(pngBuffer);
}

// HEAD ajuda o Instagram/Meta a “testar” a URL
app.head("/card.png", (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).end();
});

// ================= GET (O QUE O INSTAGRAM PRECISA) =================
// Use assim:
// /card.png?frase=...&autor=...
// (opcional) /card.png?frase=...&autor=...&bg1=%23...&bg2=%23...&fg=%23...&accent=%23...
app.get("/card.png", async (req, res) => {
  try {
    const frase = (req.query.frase || "").toString().trim();
    const autor = (req.query.autor || "").toString().trim();

    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    // escolhe paleta automaticamente (mas permite override por query)
    const p = choosePalette(frase, autor);

    const bg1 = normalizeHex(req.query.bg1, p.bg1);
    const bg2 = normalizeHex(req.query.bg2, p.bg2);
    const fg = normalizeHex(req.query.fg, p.fg);
    const accent = normalizeHex(req.query.accent, p.accent);

    const png = await renderPng({ frase, autor, bg1, bg2, fg, accent });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

// ================= POST (SEU USO NO N8N) =================
app.post("/card", async (req, res) => {
  try {
    const { frase, autor } = req.body || {};
    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const f = String(frase).trim();
    const a = typeof autor === "string" ? autor.trim() : "";

    const p = choosePalette(f, a);

    const bg1 = normalizeHex(req.body?.bg1, p.bg1);
    const bg2 = normalizeHex(req.body?.bg2, p.bg2);
    const fg = normalizeHex(req.body?.fg, p.fg);
    const accent = normalizeHex(req.body?.accent, p.accent);

    const png = await renderPng({ frase: f, autor: a, bg1, bg2, fg, accent });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
