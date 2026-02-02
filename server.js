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

/**
 * Quebra o texto garantindo que não ultrapasse a largura do card.
 * Para 1080px, com fonte 44px, ~35-38 caracteres é o limite seguro com margem.
 */
function wrapText(text, maxChars = 36) {
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
  return lines;
}

// ================= SVG CARD =================
function svgCard({ frase, autor, bg = "#0B0B0F", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;

  // Área útil (margens)
  const padX = 210;
  const padTop = 170;
  const padBottom = 190;

  const textAreaWidth = width - (padX * 2);
  const textAreaHeight = height - padTop - padBottom;

  // Configs
  const minFontSize = 28;
  const maxLines = 8;

  // Começa com um tamanho já “editorial” (não gigante)
  // (quanto maior a frase, menor o começo)
  const len = (frase || "").length;
  let fontSize = Math.max(40, 60 - Math.floor(len / 30) * 4);

  // aproximação: “largura média” do caractere em fonte bold
  const charWidthFactor = 0.72;

  let lines = [];
  let lineHeight = 0;

  for (; fontSize >= minFontSize; fontSize -= 2) {
    const maxChars = Math.max(16, Math.floor(textAreaWidth / (fontSize * charWidthFactor)));
    lines = wrapByMaxChars(frase, maxChars);

    // se passou de X linhas, reduz fonte
    if (lines.length > maxLines) continue;

    // “se ficou muitas linhas, força fonte menor”
    if (lines.length >= 7 && fontSize > 40) continue;

    lineHeight = Math.round(fontSize * 1.22);
    const blockHeight = lines.length * lineHeight;

    if (blockHeight <= textAreaHeight) break;
  }

  const blockHeight = lines.length * lineHeight;
  const startY = Math.round(padTop + (textAreaHeight / 2) - (blockHeight / 2));

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
    font-weight="600">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <text x="${width / 2}" y="${height - 92}"
    text-anchor="middle"
    fill="${fg}"
    opacity="0.85"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="30"
    font-weight="500">— ${escapeXml(autor)}</text>`
      : ""
  }
</svg>`;
}
