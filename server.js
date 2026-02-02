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

function wrapText(text, maxChars) {
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

// ================= SVG CARD (AUTO-SCALING) =================
function svgCard({ frase, autor, bg = "#0A0A0B", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;

  // ✅ margens / área útil
  const padX = 170;                 // ↑ aumenta respiro lateral
  const padTop = 190;
  const padBottom = autor ? 240 : 170;

  const textAreaWidth = width - padX * 2;
  const textAreaHeight = height - padTop - padBottom;

  // ✅ auto-scaling
  const maxFontSize = 54;           // fonte “bonita” p/ textos médios
  const minFontSize = 26;           // mínimo aceitável
  const lineHeightFactor = 1.22;

  // Aproximação da largura média do caractere
  // (quanto maior, mais “engorda” e quebra antes)
  const charWidthFactor = 0.62;

  // Evita virar “paredão”
  const maxLines = 10;

  let fontSize = maxFontSize;
  let lines = [];
  let lineHeight = 0;

  for (; fontSize >= minFontSize; fontSize -= 1) {
    const maxChars = Math.max(
      14,
      Math.floor(textAreaWidth / (fontSize * charWidthFactor))
    );

    lines = wrapText(frase, maxChars);

    // se estourar linhas, força reduzir fonte
    if (lines.length > maxLines) continue;

    lineHeight = Math.round(fontSize * lineHeightFactor);
    const blockHeight = lines.length * lineHeight;

    if (blockHeight <= textAreaHeight) break; // ✅ coube
  }

  // último recurso: corta e põe reticências na última linha
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S+$/, "…");
  }

  // centralização vertical do bloco
  const blockHeightFinal = lines.length * lineHeight;
  const startY = Math.round(
    padTop + (textAreaHeight / 2) - (blockHeightFinal / 2)
  );

  const tspans = lines
    .map((ln, i) => `<tspan x="${width / 2}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`)
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bg}"/>

  <text x="${width / 2}" y="${startY}"
    text-anchor="middle"
    fill="${fg}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="800">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <text x="${width / 2}" y="${height - 110}"
    text-anchor="middle"
    fill="${fg}"
    opacity="0.75"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="28"
    font-weight="500">— ${escapeXml(autor)}</text>`
      : ""
  }
</svg>`;
}

// ================= GERAR PNG =================
async function renderPng({ frase, autor, bg, fg }) {
  const svg = svgCard({ frase, autor, bg, fg });
  return sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
}

// ================= POST /card (JSON -> PNG) =================
app.post("/card", async (req, res) => {
  try {
    const { frase, autor, bg, fg } = req.body || {};
    const fraseOk = typeof frase === "string" ? frase.trim() : "";
    const autorOk = typeof autor === "string" ? autor.trim() : "";

    if (fraseOk.length < 2) {
      return res.status(400).json({ error: "Campo 'frase' é obrigatório." });
    }

    const png = await renderPng({
      frase: fraseOk,
      autor: autorOk,
      bg: typeof bg === "string" ? bg : "#0A0A0B",
      fg: typeof fg === "string" ? fg : "#FFFFFF",
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="card.png"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem (POST)." });
  }
});

// ================= GET /card?frase=...&autor=... =================
app.get("/card", async (req, res) => {
  try {
    const frase = typeof req.query.frase === "string" ? req.query.frase.trim() : "";
    const autor = typeof req.query.autor === "string" ? req.query.autor.trim() : "";
    const bg = typeof req.query.bg === "string" ? req.query.bg : "#0A0A0B";
    const fg = typeof req.query.fg === "string" ? req.query.fg : "#FFFFFF";

    if (frase.length < 2) {
      return res.status(400).json({ error: "Query param 'frase' é obrigatório." });
    }

    const png = await renderPng({ frase, autor, bg, fg });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="card.png"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem (GET)." });
  }
});

// ✅ listen por último
app.listen(PORT, () => {
  console.log(`instacards running on :${PORT}`);
});
