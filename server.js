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

/**
 * Quebra o texto em linhas com base no número máximo de caracteres.
 */
function wrapText(text, maxChars = 40) {
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

// ================= SVG CARD (SEM foreignObject) =================
function svgCard({ frase, autor, bg = "#0B0B0F", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;
  
  // Tamanho da fonte principal reduzido para ser mais elegante
  const fontSize = 48;
  const lines = wrapText(frase, 40);

  // Espaçamento entre linhas (1.5x o tamanho da fonte)
  const lineHeight = Math.round(fontSize * 1.5);
  const blockHeight = lines.length * lineHeight;
  
  // Ajuste fino da posição inicial para centralizar melhor o bloco todo
  // O y do <text> é a linha de base da primeira linha, então compensamos um pouco
  const startY = Math.round((height / 2) - (blockHeight / 2) + (fontSize / 2));

  const tspans = lines
    .map((ln, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`)
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bg}"/>

  <!-- Texto Principal: Menos agressivo, fonte menor e espaçada -->
  <text x="540" y="${startY}"
    text-anchor="middle"
    fill="${fg}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="500"
    letter-spacing="-0.5">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <!-- Autor: Posicionado na parte inferior com opacidade suave -->
  <text x="540" y="960"
    text-anchor="middle"
    fill="${fg}"
    opacity="0.6"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="26"
    font-weight="400">— ${escapeXml(autor)}</text>`
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
