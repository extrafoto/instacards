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

function hashStr(s = "") {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ===== Paletas sólidas elegantes (bg / fg / accent / accentAlt) =====
const PALETTES = [
  // Tons quentes
  { bg: "#FAF5EF", fg: "#1A1714", accent: "#C8553D", accentAlt: "#E8D5C4" }, // marfim & terracota
  { bg: "#F7F0E6", fg: "#2D2926", accent: "#B08968", accentAlt: "#DDD0C0" }, // linho & caramelo
  { bg: "#FDF2E9", fg: "#2C1810", accent: "#D4763C", accentAlt: "#F5DCC8" }, // pêssego & cobre
  { bg: "#F5EEDC", fg: "#33312E", accent: "#A67C52", accentAlt: "#E0D4BE" }, // pergaminho & bronze

  // Tons frios
  { bg: "#EFF2F5", fg: "#1C2127", accent: "#4A6FA5", accentAlt: "#C8D5E2" }, // névoa & azul cobalto
  { bg: "#EDF1EE", fg: "#1B2721", accent: "#4A7C6F", accentAlt: "#C2D5CE" }, // menta & esmeralda
  { bg: "#F0EDF5", fg: "#21192B", accent: "#7B5EA7", accentAlt: "#D4CCE0" }, // lavanda & ametista
  { bg: "#EBF0F0", fg: "#1A2525", accent: "#3D7A7A", accentAlt: "#BDD4D4" }, // gelo & petróleo

  // Neutros sofisticados
  { bg: "#F4F3F1", fg: "#1D1D1B", accent: "#8C7A6B", accentAlt: "#DDD7D0" }, // cinza quente & taupe
  { bg: "#EDECE8", fg: "#1F1E1C", accent: "#6B6356", accentAlt: "#D1CEC7" }, // pedra & grafite quente

  // Escuros elegantes
  { bg: "#1A1D23", fg: "#F0EDE8", accent: "#C8A97E", accentAlt: "#2D3039" }, // noite & ouro
  { bg: "#191C20", fg: "#E8ECF0", accent: "#6B9AC4", accentAlt: "#252A32" }, // carvão & azul gelo
  { bg: "#1C1F1E", fg: "#E6EBE8", accent: "#7BAF8E", accentAlt: "#272D2A" }, // ébano & jade
  { bg: "#201B1E", fg: "#F0E8EC", accent: "#C07C8C", accentAlt: "#302830" }, // obsidiana & rosé
];

function normalizeHex(hex, fallback) {
  if (!hex) return fallback;
  let v = String(hex).trim();
  v = v.replace("%23", "#");
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return v;
}

function choosePalette(frase, autor) {
  const h = hashStr(`${frase}||${autor}`);
  return PALETTES[h % PALETTES.length];
}

// ===== Contraste =====
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function luminance({ r, g, b }) {
  const srgb = [r, g, b]
    .map((v) => v / 255)
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function bestTextColor(bg) {
  const lum = luminance(hexToRgb(bg));
  return lum < 0.42 ? "#F0EDE8" : "#1A1714";
}

// ===== Wrap + tipografia =====
function wrapWordsToLines(text, maxChars) {
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
  return lines;
}

function layoutText(frase, { width, height, safeX, safeY }) {
  const safeWidth = width - safeX * 2;
  const safeHeight = height - safeY * 2;
  let fontSize = 58;
  const minFont = 26;

  while (fontSize >= minFont) {
    const lineHeight = Math.round(fontSize * 1.3);
    const approxCharWidth = fontSize * 0.54;
    const maxChars = Math.max(18, Math.floor(safeWidth / approxCharWidth));
    let lines = wrapWordsToLines(frase, maxChars);
    if (lines.length > 12) lines = lines.slice(0, 12);
    const blockHeight = lines.length * lineHeight;
    if (blockHeight <= safeHeight * 0.75) {
      return { lines, fontSize, lineHeight };
    }
    fontSize -= 2;
  }

  const lineHeight = Math.round(minFont * 1.3);
  const lines = wrapWordsToLines(frase, 28).slice(0, 12);
  return { lines, fontSize: minFont, lineHeight };
}

// ===== SVG Card =====
function svgCard({
  frase,
  autor,
  bg,
  fg,
  accent,
  accentAlt,
  width = 1080,
  height = 1920,
  texture = true,
}) {
  const safeX = 140;
  const safeY = 260;

  const { lines, fontSize, lineHeight } = layoutText(frase, {
    width,
    height,
    safeX,
    safeY,
  });

  const blockHeight = lines.length * lineHeight;
  const safeTop = safeY;
  const safeBottom = height - safeY;
  const safeCenterY = (safeTop + safeBottom) / 2;
  const startY = Math.round(safeCenterY - blockHeight / 2);

  const tspans = lines
    .map(
      (ln, i) =>
        `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`
    )
    .join("");

  const authorSize = Math.max(24, Math.round(fontSize * 0.48));
  const lineW = 80;
  const dotR = 5;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.12"/>
      </filter>
      <filter id="paperNoise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.028"/>
        </feComponentTransfer>
      </filter>
    </defs>

    <!-- FUNDO SÓLIDO -->
    <rect width="100%" height="100%" fill="${bg}"/>

    ${texture ? `<rect width="100%" height="100%" filter="url(#paperNoise)" opacity="0.45"/>` : ""}

    <!-- Detalhe superior: ponto + linha fina -->
    <circle cx="${width / 2}" cy="${safeY - 140}" r="${dotR}" fill="${accent}" opacity="0.7"/>
    <line x1="${width / 2 - lineW}" x2="${width / 2 + lineW}"
          y1="${safeY - 100}" y2="${safeY - 100}"
          stroke="${accent}" stroke-width="2.5" stroke-linecap="round" opacity="0.5"/>

    <!-- FRASE -->
    <text x="${width / 2}" y="${startY}"
      text-anchor="middle"
      fill="${fg}"
      font-family="'Georgia', 'DejaVu Serif', 'Times New Roman', serif"
      font-size="${fontSize}"
      font-weight="400"
      letter-spacing="0.5"
      filter="url(#textShadow)">
      ${tspans}
    </text>

    <!-- Separador antes do autor -->
    ${autor ? `
    <line x1="${width / 2 - 40}" x2="${width / 2 + 40}"
          y1="${height - safeY - 30}" y2="${height - safeY - 30}"
          stroke="${accent}" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
    ` : ""}

    <!-- AUTOR -->
    ${autor ? `
    <text x="${width / 2}" y="${height - safeY + 15}"
      text-anchor="middle"
      fill="${fg}"
      opacity="0.65"
      font-family="'DejaVu Sans', 'Helvetica Neue', Arial, sans-serif"
      font-size="${authorSize}"
      font-weight="400"
      letter-spacing="2"
      text-transform="uppercase">— ${escapeXml(autor)}</text>` : ""}

    <!-- Detalhe inferior: linha fina -->
    <line x1="${width / 2 - lineW}" x2="${width / 2 + lineW}"
          y1="${height - safeY + 80}" y2="${height - safeY + 80}"
          stroke="${accentAlt || accent}" stroke-width="2" stroke-linecap="round" opacity="0.35"/>
  </svg>`;
}

async function renderPng({ frase, autor, bg, fg, accent, accentAlt, texture }) {
  const svg = svgCard({ frase, autor, bg, fg, accent, accentAlt, texture });
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

// ================= ENDPOINTS =================
app.head("/card.png", (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).end();
});

/**
 * GET /card.png?frase=...&autor=...&bg=#...&fg=#...&accent=#...&texture=0
 */
app.get("/card.png", async (req, res) => {
  try {
    const frase = (req.query.frase || "").toString().trim();
    const autor = (req.query.autor || "").toString().trim();
    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const p = choosePalette(frase, autor);
    const bg = normalizeHex(req.query.bg, p.bg);
    const autoFg = bestTextColor(bg);
    const fg = normalizeHex(req.query.fg, p.fg || autoFg);
    const accent = normalizeHex(req.query.accent, p.accent);
    const accentAlt = p.accentAlt;
    const texture = String(req.query.texture ?? "1") !== "0";

    const png = await renderPng({ frase, autor, bg, fg, accent, accentAlt, texture });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

/**
 * POST /card
 * body: { frase, autor, bg, fg, accent, texture }
 */
app.post("/card", async (req, res) => {
  try {
    const { frase, autor } = req.body || {};
    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const f = String(frase).trim();
    const a = typeof autor === "string" ? autor.trim() : "";

    const p = choosePalette(f, a);
    const bg = normalizeHex(req.body?.bg, p.bg);
    const autoFg = bestTextColor(bg);
    const fg = normalizeHex(req.body?.fg, p.fg || autoFg);
    const accent = normalizeHex(req.body?.accent, p.accent);
    const accentAlt = p.accentAlt;
    const texture = String(req.body?.texture ?? "1") !== "0";

    const png = await renderPng({ frase: f, autor: a, bg, fg, accent, accentAlt, texture });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
