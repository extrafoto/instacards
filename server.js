import express from "express";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// ================= HEALTHCHECK (EASYPANEL) =================
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
  return h >>> 0;
}

// paletas (bg1/bg2 = gradiente; fg = texto; accent = detalhe)
const PALETTES = [
  { bg1: "#0B132B", bg2: "#1C2541", fg: "#F7F7FF", accent: "#5BC0BE" }, // navy/teal
  { bg1: "#111827", bg2: "#0B0F1A", fg: "#F9FAFB", accent: "#F59E0B" }, // graphite/amber
  { bg1: "#0F172A", bg2: "#1E293B", fg: "#E2E8F0", accent: "#22C55E" }, // slate/green
  { bg1: "#2B193D", bg2: "#3A1C71", fg: "#FFF7ED", accent: "#FB7185" }, // purple/pink
  { bg1: "#073B4C", bg2: "#0B3D2E", fg: "#F8FAFC", accent: "#FFD166" }, // teal/yellow
  { bg1: "#1F2937", bg2: "#2D1B0F", fg: "#FFF7ED", accent: "#60A5FA" }, // warm/blue
  { bg1: "#0A0A0A", bg2: "#1F1F1F", fg: "#FFFFFF", accent: "#A3E635" }, // dark/lime
  { bg1: "#0F766E", bg2: "#123524", fg: "#F0FDFA", accent: "#FB923C" }, // green/orange
];

function choosePalette(frase, autor) {
  const h = hashStr(`${frase}||${autor}`);
  return PALETTES[h % PALETTES.length];
}

// normaliza hex tipo "%23FFFFFF" ou "FFFFFF" ou "#FFF"
function normalizeHex(hex, fallback) {
  if (!hex) return fallback;
  let v = String(hex).trim();
  v = v.replace("%23", "#");
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return v;
}

// mede largura real do texto via sharp+SVG
async function measureTextWidth(text, fontSize, fontWeight = 700) {
  const svg = `
    <svg width="2000" height="200">
      <text x="0" y="120"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="${fontWeight}">${escapeXml(text)}</text>
    </svg>`;
  const { info } = await sharp(Buffer.from(svg)).png().toBuffer({ resolveWithObject: true });
  return info.width;
}

// quebra linha por largura real (não por chars)
async function wrapTextByWidth(text, fontSize, maxWidth) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    const width = await measureTextWidth(test, fontSize, 700);

    if (width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// escolhe tipografia pra caber bonito no 1080x1080 sem cortar
async function fitTypography(frase, textWidth, maxLines = 9) {
  const len = (frase || "").length;

  // chutes iniciais (ficam elegantes)
  let fontSize = 58;
  if (len > 140) fontSize = 54;
  if (len > 220) fontSize = 48;
  if (len > 320) fontSize = 44;
  if (len > 420) fontSize = 40;

  // ajusta até caber em linhas/altura
  for (let i = 0; i < 10; i++) {
    const lineHeight = Math.round(fontSize * 1.25);
    const lines = await wrapTextByWidth(frase, fontSize, textWidth);

    // se estourou linhas, reduz fonte
    if (lines.length > maxLines) {
      fontSize -= 4;
      continue;
    }
    return { fontSize, lineHeight, lines };
  }

  // fallback mínimo
  const fontSizeMin = Math.max(34, fontSize);
  const lineHeight = Math.round(fontSizeMin * 1.25);
  const lines = await wrapTextByWidth(frase, fontSizeMin, textWidth);
  return { fontSize: fontSizeMin, lineHeight, lines: lines.slice(0, maxLines) };
}

function svgCard({ frase, autor, bg1, bg2, fg, accent }) {
  const width = 1080;
  const height = 1080;

  // “safe area” maior pra não cortar em previews/feeds
  const padX = 170;
  const padYTop = 210;
  const padYBottom = 210;

  const topLineY = padYTop - 70;

  // layout é calculado depois (lines/font)
  // (vamos montar com placeholders e substituir no render)
  return {
    width,
    height,
    padX,
    padYTop,
    padYBottom,
    topLineY,
    svgShell: ({ tspans, startY, fontSize, lineHeight }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>

    <!-- textura suave -->
    <filter id="noise">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.05"/>
      </feComponentTransfer>
    </filter>

    <!-- vinheta leve -->
    <radialGradient id="vignette" cx="50%" cy="45%" r="80%">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.35"/>
    </radialGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" filter="url(#noise)" opacity="0.35"/>
  <rect width="100%" height="100%" fill="url(#vignette)"/>

  <!-- detalhe superior -->
  <line x1="${padX}" x2="${width - padX}"
        y1="${topLineY}" y2="${topLineY}"
        stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.85"/>

  <!-- texto principal -->
  <text x="540" y="${startY}"
        text-anchor="middle"
        fill="${fg}"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="800">
    ${tspans}
  </text>

  <!-- autor -->
  ${
    autor
      ? `<text x="540" y="${height - padYBottom + 20}"
          text-anchor="middle"
          fill="${fg}"
          opacity="0.85"
          font-family="DejaVu Sans, Arial, sans-serif"
          font-size="30"
          font-weight="600">— ${escapeXml(autor)}</text>`
      : ""
  }
</svg>`,
  };
}

async function renderPng({ frase, autor, bg1, bg2, fg, accent }) {
  const card = svgCard({ frase, autor, bg1, bg2, fg, accent });

  const textWidth = card.width - card.padX * 2;

  // calcula tipografia + linhas SEM cortar
  const { fontSize, lineHeight, lines } = await fitTypography(frase, textWidth, 9);

  // calcula posição vertical do bloco (entre as “safe areas”)
  const blockHeight = lines.length * lineHeight;
  const usableTop = card.padYTop;
  const usableBottom = card.height - card.padYBottom;
  const usableHeight = usableBottom - usableTop;

  let startY = Math.round(usableTop + (usableHeight - blockHeight) / 2);

  // evita subir demais (deixa respiro do topo)
  startY = Math.max(startY, usableTop + 10);

  const tspans = lines
    .slice(0, 9)
    .map(
      (ln, i) =>
        `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`
    )
    .join("");

  const svg = card.svgShell({ tspans, startY, fontSize, lineHeight });

  return sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
}

function sendPng(res, pngBuffer) {
  res.status(200);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", 'inline; filename="card.png"');
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Content-Length", String(pngBuffer.length));
  res.end(pngBuffer);
}

// HEAD ajuda Meta/Instagram a validar a URL antes de baixar
app.head("/card.png", (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).end();
});

// ================= GET (URL PÚBLICA PRA META) =================
// /card.png?frase=...&autor=...
// opcional overrides: &bg1=%23...&bg2=%23...&fg=%23...&accent=%23...
app.get("/card.png", async (req, res) => {
  try {
    const frase = (req.query.frase || "").toString().trim();
    const autor = (req.query.autor || "").toString().trim();
    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

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
