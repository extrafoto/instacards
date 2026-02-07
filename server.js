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
  return h >>> 0;
}

// ===== Paletas sólidas (bg/fg/accent) =====
const PALETTES = [
  { bg: "#F3E7D3", fg: "#2C2A27", accent: "#D97B4A" }, // creme/terracota
  { bg: "#E9E1CF", fg: "#2B2A26", accent: "#8C7B6A" }, // papel antigo
  { bg: "#DDE7DD", fg: "#1F2A22", accent: "#6E8B6B" }, // sálvia
  { bg: "#F2D7C8", fg: "#2C1F1B", accent: "#C46A4A" }, // pêssego
  { bg: "#D8E6E4", fg: "#1C2A2A", accent: "#5F8F8B" }, // verde água
  { bg: "#F2E6C8", fg: "#2A2418", accent: "#C9A24D" }, // areia/mostarda
  { bg: "#E7D2D8", fg: "#2A2022", accent: "#9C6B66" }, // rosé antigo
  { bg: "#D7DCEB", fg: "#1D2130", accent: "#6B7AA6" }, // azul acinzentado
  { bg: "#1B1D22", fg: "#F4F4F5", accent: "#7C8CFF" }, // dark elegante
];

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

function choosePalette(frase, autor) {
  const h = hashStr(`${frase}||${autor}`);
  return PALETTES[h % PALETTES.length];
}

// ===== Contraste automático (se você quiser forçar fg) =====
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
function luminance({ r, g, b }) {
  const srgb = [r, g, b].map((v) => v / 255).map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function bestTextColor(bg) {
  const lum = luminance(hexToRgb(bg));
  return lum < 0.42 ? "#F5F5F5" : "#1F1F1F";
}

// ===== Wrap + tipografia que não corta =====
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

/**
 * Ajusta fonte e quebra considerando área segura:
 * - tenta um fontSize inicial e vai reduzindo até caber verticalmente
 * - maxChars é estimado pela largura útil e tamanho da fonte
 */
function layoutText(frase, { width, height, safeX, safeY }) {
  const safeWidth = width - safeX * 2;
  const safeHeight = height - safeY * 2;

  // começa confortável e vai ajustando
  let fontSize = 60; // mais suave (antes estava grande)
  const minFont = 28;

  while (fontSize >= minFont) {
    const lineHeight = Math.round(fontSize * 1.25);

    // estimativa de chars por linha
    // (0.56 é um fator médio visual pra sans)
    const approxCharWidth = fontSize * 0.56;
    const maxChars = Math.max(18, Math.floor(safeWidth / approxCharWidth));

    let lines = wrapWordsToLines(frase, maxChars);
    // limita linhas pra não virar “texto miúdo infinito”
    if (lines.length > 12) {
      lines = lines.slice(0, 12);
      // se estourou, reduz fonte mais rápido
    }

    const blockHeight = lines.length * lineHeight;
    if (blockHeight <= safeHeight * 0.78) {
      return { lines, fontSize, lineHeight };
    }

    fontSize -= 2;
  }

  // fallback
  const lineHeight = Math.round(minFont * 1.25);
  const maxChars = 28;
  const lines = wrapWordsToLines(frase, maxChars).slice(0, 12);
  return { lines, fontSize: minFont, lineHeight };
}

function svgCard({
  frase,
  autor,
  bg,
  fg,
  accent,
  width = 1080,
  height = 1920,
  texture = true, // pode desligar via query/body: texture=0
}) {
  // ÁREA SEGURA (aumentada pra afastar das bordas)
  const safeX = 170;
  const safeY = 240;

  const { lines, fontSize, lineHeight } = layoutText(frase, {
    width,
    height,
    safeX,
    safeY,
  });

  const blockHeight = lines.length * lineHeight;

  // centraliza dentro da área segura (não no canvas inteiro)
  const safeTop = safeY;
  const safeBottom = height - safeY;
  const safeCenterY = (safeTop + safeBottom) / 2;
  const startY = Math.round(safeCenterY - blockHeight / 2);

  const tspans = lines
    .map(
      (ln, i) =>
        `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(
          ln
        )}</tspan>`
    )
    .join("");

  // Autor mais discreto
  const authorSize = Math.max(26, Math.round(fontSize * 0.55));

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <!-- sombra bem sutil -->
      <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity="0.18"/>
      </filter>

      <!-- textura muito leve (sem vinheta/degradê) -->
      <filter id="paperNoise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.035"/>
        </feComponentTransfer>
      </filter>
    </defs>

    <!-- FUNDO SÓLIDO -->
    <rect width="100%" height="100%" fill="${bg}"/>

    ${texture ? `<rect width="100%" height="100%" filter="url(#paperNoise)" opacity="0.55"/>` : ""}

    <!-- detalhe superior (linha) -->
    <line x1="${safeX}" x2="${width - safeX}"
          y1="${safeY - 110}" y2="${safeY - 110}"
          stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.85"/>

    <!-- TEXTO -->
    <text x="${width / 2}" y="${startY}"
      text-anchor="middle"
      fill="${fg}"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="600"
      filter="url(#textShadow)">
      ${tspans}
    </text>

    <!-- AUTOR -->
    ${
      autor
        ? `
    <text x="${width / 2}" y="${height - safeY + 10}"
      text-anchor="middle"
      fill="${fg}"
      opacity="0.78"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${authorSize}"
      font-weight="500">— ${escapeXml(autor)}</text>`
        : ""
    }
  </svg>`;
}

async function renderPng({ frase, autor, bg, fg, accent, texture }) {
  const svg = svgCard({ frase, autor, bg, fg, accent, texture });
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

    const texture = String(req.query.texture ?? "1") !== "0";

    const png = await renderPng({ frase, autor, bg, fg, accent, texture });
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

    const texture = String(req.body?.texture ?? "1") !== "0";

    const png = await renderPng({ frase: f, autor: a, bg, fg, accent, texture });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
