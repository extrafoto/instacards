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

function wrapText(text, maxChars = 34) {
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

// ================= SVG CARD DESIGN PREMIUM =================
function svgCard({ frase, autor, bg = "#0A0A0B", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;
  
  // Tipografia Premium
  const fontSize = 46; 
  const fontWeight = 400; 
  const lines = wrapText(frase, 32);

  const lineHeight = Math.round(fontSize * 1.5);
  const blockHeight = lines.length * lineHeight;
  
  // Centralização refinada
  const startY = Math.round((height / 2) - (blockHeight / 2) + (fontSize / 3));

  const tspans = lines
    .map((ln, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`)
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <!-- Fundo Sólido Minimalista -->
  <rect width="100%" height="100%" fill="${bg}"/>

  <!-- Aspas Elegantes -->
  <text x="540" y="${startY - 100}" 
    text-anchor="middle" 
    fill="${fg}" 
    opacity="0.2" 
    font-family="Times New Roman, serif" 
    font-size="160" 
    font-style="italic">“</text>

  <!-- Texto Principal: Estilo Editorial -->
  <text x="540" y="${startY}"
    text-anchor="middle"
    fill="${fg}"
    font-family="serif"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    letter-spacing="0.2">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <!-- Linha Divisora Minimalista -->
  <rect x="515" y="910" width="50" height="1" fill="${fg}" opacity="0.3" />
  
  <!-- Autor: Sofisticado -->
  <text x="540" y="960"
    text-anchor="middle"
    fill="${fg}"
    opacity="0.6"
    font-family="sans-serif"
    font-size="24"
    font-weight="300"
    letter-spacing="4px"
    text-transform="uppercase">${escapeXml(autor).toUpperCase()}</text>`
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
      bg: typeof bg === "string" ? bg : "#0A0A0B",
      fg: typeof fg === "string" ? fg : "#FFFFFF",
    });

    const png = await sharp(Buffer.from(svg))
      .png({ quality: 100 })
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem." });
  }
});

app.listen(PORT, () => {
  console.log(`premium-card-service running on :${PORT}`);
});
