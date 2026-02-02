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

// ================= SVG CARD (SEM foreignObject) =================
function svgCard({ frase, autor, bg = "#0B0B0F", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;

  // ================= TAMANHO DINÂMICO DA FONTE =================
  const len = frase.length;

  let fontSize;
  if (len < 90) fontSize = 72;
  else if (len < 140) fontSize = 40;
  else if (len < 200) fontSize = 52;
  else if (len < 260) fontSize = 46;
  else fontSize = 40;

  const lineHeight = Math.round(fontSize * 1.25);

  // ================= QUEBRA DE LINHA INTELIGENTE =================
function wrapByMaxChars(text, maxChars) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  // quebra palavras muito longas (evita "estouro" lateral)
  const safeWords = [];
  for (const w of words) {
    if (w.length > maxChars) {
      // fatia palavra grande
      for (let i = 0; i < w.length; i += maxChars) safeWords.push(w.slice(i, i + maxChars));
    } else {
      safeWords.push(w);
    }
  }

  for (const w of safeWords) {
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

function svgCard({ frase, autor, bg = "#0B0B0F", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;

  // ✅ margem real (aqui está o “conserto do apertado”)
  const padX = 140;                 // margem lateral
  const padTop = 140;               // margem superior do bloco
  const padBottom = 180;            // espaço pro autor
  const textAreaWidth = width - (padX * 2);
  const textAreaHeight = height - padTop - padBottom;

  // ===== fonte dinâmica por “tentativa e ajuste” =====
  // Começa grande e vai reduzindo até caber
  let fontSize = 72;                // começamos maior, mas vai diminuir se precisar
  let lines = [];
  let lineHeight = 0;

  // aproximação: largura média de caractere ≈ 0.56 do fontSize
  const charWidthFactor = 0.56;

  for (; fontSize >= 36; fontSize -= 2) {
    const maxChars = Math.max(18, Math.floor(textAreaWidth / (fontSize * charWidthFactor)));
    lines = wrapByMaxChars(frase, maxChars);

    // limita linhas pra não virar “paredão”
    const maxLines = 9;
    if (lines.length > maxLines) continue;

    lineHeight = Math.round(fontSize * 1.28);
    const blockHeight = lines.length * lineHeight;

    if (blockHeight <= textAreaHeight) break; // ✅ cabeu
  }

  // Centraliza verticalmente dentro da área útil
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
    font-weight="700">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <text x="${width / 2}" y="${height - 90}"
    text-anchor="middle"
    fill="${fg}"
    opacity="0.85"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="34"
    font-weight="500">— ${escapeXml(autor)}</text>`
      : ""
  }
</svg>`;
}



// ================= ENDPOINT PRINCIPAL =================
app.post("/card", async (req, res) => {
  try {
    const { frase, autor, bg, fg } = req.body || {};

    if (!frase || typeof frase !== "string" || frase.trim().length < 2) {
      return res.status(400).json({ error: "Campo 'frase' é obrigatório." });
    }

    const svg = svgCard({
      frase: frase.trim(),
      autor: typeof autor === "string" ? autor.trim() : "",
      bg: typeof bg === "string" ? bg : "#0B0B0F",
      fg: typeof fg === "string" ? fg : "#FFFFFF",
    });

    const png = await sharp(Buffer.from(svg))
      .png({ quality: 95 })
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="card.png"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem." });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
