import express from "express";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.status(200).send("ok"));
app.get("/health", (req, res) => res.json({ ok: true }));

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

const PALETTES = [
  { bg: "#F3E7D3", fg: "#2C2A27", accent: "#D97B4A" },
  { bg: "#E9E1CF", fg: "#2B2A26", accent: "#8C7B6A" },
  { bg: "#DDE7DD", fg: "#1F2A22", accent: "#6E8B6B" },
  { bg: "#F2D7C8", fg: "#2C1F1B", accent: "#C46A4A" },
  { bg: "#D8E6E4", fg: "#1C2A2A", accent: "#5F8F8B" },
  { bg: "#F2E6C8", fg: "#2A2418", accent: "#C9A24D" },
  { bg: "#E7D2D8", fg: "#2A2022", accent: "#9C6B66" },
  { bg: "#D7DCEB", fg: "#1D2130", accent: "#6B7AA6" },
  { bg: "#1B1D22", fg: "#F4F4F5", accent: "#7C8CFF" },
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

// ----------------- LAYOUT por formato -----------------
function getFormatDims(format, w, h) {
  if (w && h) return { width: w, height: h };
  if (format === "square") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1920 }; // story default
}

/**
 * Margens: menores (aproxima tudo), mas seguras p/ feed
 * - square: margens menores, autor sobe
 * - story: margens um pouco maiores, mas não exagero
 */
function getLayoutConfig(width, height) {
  const isSquare = height <= 1200;

  if (isSquare) {
    return {
      safeX: 120,
      safeY: 120,
      lineY: 170,          // linha mais baixa (antes ficava “lá em cima”)
      authorY: height - 140, // autor sobe (não cola na borda)
      blockMaxRatio: 0.64, // quanto do miolo o texto pode ocupar
      baseFont: 62,
      minFont: 30,
    };
  }

  // story
  return {
    safeX: 150,
    safeY: 200,
    lineY: 260,             // linha desce
    authorY: height - 220,  // autor sobe bem (pra não “sumir”)
    blockMaxRatio: 0.56,
    baseFont: 64,
    minFont: 30,
  };
}

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

function layoutText(frase, { width, height, safeX, safeY, blockMaxRatio, baseFont, minFont }) {
  const safeWidth = width - safeX * 2;
  const safeHeight = height - safeY * 2;

  let fontSize = baseFont;

  while (fontSize >= minFont) {
    const lineHeight = Math.round(fontSize * 1.22);
    const approxCharWidth = fontSize * 0.56;
    const maxChars = Math.max(18, Math.floor(safeWidth / approxCharWidth));

    let lines = wrapWordsToLines(frase, maxChars);
    if (lines.length > 12) lines = lines.slice(0, 12);

    const blockHeight = lines.length * lineHeight;
    if (blockHeight <= safeHeight * blockMaxRatio) {
      return { lines, fontSize, lineHeight };
    }
    fontSize -= 2;
  }

  const lineHeight = Math.round(minFont * 1.22);
  const lines = wrapWordsToLines(frase, 26).slice(0, 12);
  return { lines, fontSize: minFont, lineHeight };
}

function svgCard({
  frase,
  autor,
  bg,
  fg,
  accent,
  width,
  height,
  texture = true,
}) {
  const cfg = getLayoutConfig(width, height);

  const { lines, fontSize, lineHeight } = layoutText(frase, {
    width,
    height,
    safeX: cfg.safeX,
    safeY: cfg.safeY,
    blockMaxRatio: cfg.blockMaxRatio,
    baseFont: cfg.baseFont,
    minFont: cfg.minFont,
  });

  const blockHeight = lines.length * lineHeight;

  // Centraliza o bloco de texto, mas “puxa um pouco pra cima” no square
  const isSquare = height <= 1200;
  const safeTop = cfg.safeY;
  const safeBottom = height - cfg.safeY;
  const safeCenterY = (safeTop + safeBottom) / 2;

  const lift = isSquare ? 40 : 0; // puxa texto um pouco pra cima no feed
  const startY = Math.round(safeCenterY - blockHeight / 2 - lift);

  const tspans = lines
    .map(
      (ln, i) =>
        `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(
          ln
        )}</tspan>`
    )
    .join("");

  const authorSize = Math.max(24, Math.round(fontSize * 0.52));

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.18"/>
      </filter>

      <!-- textura bem sutil -->
      <filter id="paperNoise" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.03"/>
        </feComponentTransfer>
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="${bg}"/>
    ${texture ? `<rect width="100%" height="100%" filter="url(#paperNoise)" opacity="0.55"/>` : ""}

    <!-- Linha (mais baixa e mais próxima do conteúdo) -->
    <line x1="${cfg.safeX}" x2="${width - cfg.safeX}"
          y1="${cfg.lineY}" y2="${cfg.lineY}"
          stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.85"/>

    <text x="${width / 2}" y="${startY}"
      text-anchor="middle"
      fill="${fg}"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="600"
      filter="url(#textShadow)">
      ${tspans}
    </text>

    ${
      autor
        ? `
    <text x="${width / 2}" y="${cfg.authorY}"
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

async function renderPng({ frase, autor, bg, fg, accent, texture, width, height }) {
  const svg = svgCard({ frase, autor, bg, fg, accent, texture, width, height });
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

    const format = String(req.query.format || "story"); // story|square
    const w = req.query.w ? parseInt(req.query.w, 10) : null;
    const h = req.query.h ? parseInt(req.query.h, 10) : null;

    const { width, height } = getFormatDims(format, w, h);

    const p = choosePalette(frase, autor);

    const bg = normalizeHex(req.query.bg, p.bg);
    const autoFg = bestTextColor(bg);
    const fg = normalizeHex(req.query.fg, p.fg || autoFg);
    const accent = normalizeHex(req.query.accent, p.accent);

    const texture = String(req.query.texture ?? "1") !== "0";

    const png = await renderPng({
      frase,
      autor,
      bg,
      fg,
      accent,
      texture,
      width,
      height,
    });

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

    const format = String(req.body?.format || "story"); // story|square
    const w = req.body?.w ? parseInt(req.body.w, 10) : null;
    const h = req.body?.h ? parseInt(req.body.h, 10) : null;

    const { width, height } = getFormatDims(format, w, h);

    const p = choosePalette(f, a);

    const bg = normalizeHex(req.body?.bg, p.bg);
    const autoFg = bestTextColor(bg);
    const fg = normalizeHex(req.body?.fg, p.fg || autoFg);
    const accent = normalizeHex(req.body?.accent, p.accent);

    const texture = String(req.body?.texture ?? "1") !== "0";

    const png = await renderPng({
      frase: f,
      autor: a,
      bg,
      fg,
      accent,
      texture,
      width,
      height,
    });

    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
