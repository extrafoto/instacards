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
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Quebra o texto em linhas, adaptando-se ao número máximo de caracteres por linha.
 * Este maxChars é determinado dinamicamente pela função svgCard para auto-scaling.
 */
function wrapText(text, maxChars) {
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

// ================= SVG CARD ESTILO POLAROID PREMIUM (FINAL) =================
function svgCard({ frase, autor }) {
  const width = 1080, height = 1080;
  const textLen = frase.length;

  // --- Configurações da Moldura Polaroid ---
  const frameColor = "#F8F8F8"; // Branco off-white para a moldura
  const innerBgColor = "#0D0D0F"; // Preto profundo para o interior
  const textColor = "#FFFFFF"; // Branco puro para o texto principal
  const authorColor = "#222222"; // Cinza escuro para o autor na base

  // Margens da moldura (distância da borda do SVG para o conteúdo interno)
  const frameMarginX = 80; // Margem lateral
  const frameMarginYTop = 80; // Margem superior
  const frameMarginYBottom = 200; // Margem inferior (para a aba da Polaroid)

  const innerX = frameMarginX;
  const innerY = frameMarginYTop;
  const innerWidth = width - (2 * frameMarginX);
  const innerHeight = height - frameMarginYTop - frameMarginYBottom;

  // --- Lógica de Auto-Scaling de Fonte e Quebra de Linha ---
  let fontSize, maxCharsPerLine, quoteFontSize, quoteOpacity;

  if (textLen < 60) {
    fontSize = 50;
    maxCharsPerLine = 24;
    quoteFontSize = 140;
    quoteOpacity = 0.1;
  } else if (textLen < 150) {
    fontSize = 42;
    maxCharsPerLine = 30;
    quoteFontSize = 120;
    quoteOpacity = 0.1;
  } else if (textLen < 300) {
    fontSize = 32;
    maxCharsPerLine = 38;
    quoteFontSize = 100;
    quoteOpacity = 0.08;
  } else {
    fontSize = 26;
    maxCharsPerLine = 45;
    quoteFontSize = 80;
    quoteOpacity = 0.05;
  }

  const lines = wrapText(frase, maxCharsPerLine);
  const lineHeight = Math.round(fontSize * 1.5); // Espaçamento entre linhas
  const blockHeight = lines.length * lineHeight;
  
  // Centralização vertical do bloco de texto dentro da área interna da Polaroid
  const innerCenterY = innerY + (innerHeight / 2);
  const startY = Math.round(innerCenterY - (blockHeight / 2) + (fontSize / 2));

  const tspans = lines
    .map((ln, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`)
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <!-- Moldura Branca Off-White da Polaroid -->
  <rect width="100%" height="100%" fill="${frameColor}"/>
  
  <!-- Interior Preto Profundo da Polaroid -->
  <rect x="${innerX}" y="${innerY}" width="${innerWidth}" height="${innerHeight}" fill="${innerBgColor}"/>

  <!-- Aspas Estilizadas e Sutis (com auto-ajuste de tamanho e opacidade) -->
  <text x="540" y="${startY - (textLen > 200 ? 60 : 100)}" 
    text-anchor="middle" 
    fill="${textColor}" 
    opacity="${quoteOpacity}" 
    font-family="serif" 
    font-size="${quoteFontSize}" 
    font-style="italic">“</text>

  <!-- Texto Principal (Branco sobre Preto) com Tipografia Refinada -->
  <text x="540" y="${startY}"
    text-anchor="middle"
    fill="${textColor}"
    font-family="serif"
    font-size="${fontSize}"
    font-weight="400"
    letter-spacing="0.2">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <!-- Nome do Autor na Aba Branca da Polaroid (Estilo Moderno) -->
  <text x="540" y="990"
    text-anchor="middle"
    fill="${authorColor}"
    font-family="sans-serif"
    font-size="32"
    font-weight="300"
    font-style="italic"
    letter-spacing="1px">— ${escapeXml(autor)}</text>`
      : ""
  }
</svg>`;
}

// ================= ENDPOINT PRINCIPAL =================
app.post("/card", async (req, res) => {
  try {
    const { frase, autor } = req.body || {};

    if (!frase || typeof frase !== "string" || frase.trim().length < 2) {
      return res.status(400).json({ error: "Campo 'frase' é obrigatório." });
    }

    const svg = svgCard({
      frase: frase.trim(),
      autor: typeof autor === "string" ? autor.trim() : "",
    });

    const png = await sharp(Buffer.from(svg))
      .png({ quality: 100 }) // Qualidade máxima para o estilo premium
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem." });
  }
});

app.listen(PORT, () => {
  console.log(`polaroid-premium-card-service running on :${PORT}`);
});
