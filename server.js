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

function wrapByMaxChars(text, maxChars) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  // quebra palavras absurdamente longas
  const safeWords = [];
  for (const w of words) {
    if (w.length > maxChars) {
      for (let i = 0; i < w.length; i += maxChars) safeWords.push(w.slice(i, i + maxChars));
    } else safeWords.push(w);
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

  // ✅ MAIS RESPIRO (margens)
  const padX = 180;      // aumente para 200 se quiser ainda mais
  const padTop = 170;
  const padBottom = 190;

  const textAreaWidth = width - (padX * 2);
  const textAreaHeight = height - padTop - padBottom;

  // ✅ FONTE MAIS CONTROLADA
  const fontSizeStart = 64;  // antes estava 72 (muito grande)
  const minFontSize = 32;    // até onde pode diminuir
  const maxLines = 8;        // evita “paredão”

  // aproximação de largura média do caractere
  const charWidthFactor = 0.62;

  let fontSize = fontSizeStart;
  let lines = [];
  let lineHeight = 0;

  for (; fontSize >= minFontSize; fontSize -= 2) {
    const maxChars = Math.max(18, Math.floor(textAreaWidth / (fontSize * charWidthFactor)));
    lines = wrapByMaxChars(frase, maxChars);

    if (lines.length > maxLines) continue;

    lineHeight = Math.round(fontSize * 1.22);
    const blockHeight = lines.length * lineHeight;

    if (blockHeight <= textAreaHeight) break; // ✅ cabeu
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
    font-weight="700">
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
    font-size="32"
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
