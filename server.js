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

function svgCard({ frase, autor, bg = "#0B0B0F", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;
  const lines = wrapText(frase, 28);

  const lineHeight = 78;
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round(height / 2 - blockHeight / 2);

  const tspans = lines
    .map(
      (ln, i) =>
        `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`
    )
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bg}"/>

  <text x="540" y="${startY}"
    text-anchor="middle"
    fill="${fg}"
    font-family="DejaVu Sans, Arial, sans-serif"
    font-size="64"
    font-weight="700">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <text x="540" y="980"
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

async function renderPng({ frase, autor, bg, fg }) {
  const svg = svgCard({ frase, autor, bg, fg });
  // "resolveWithObject: true" nos dá info de buffer e size, mas aqui basta buffer
  const png = await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
  return png;
}

function sendPng(res, pngBuffer) {
  res.status(200);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", 'inline; filename="card.png"');
  res.setHeader("Cache-Control", "public, max-age=60"); // ajuda a Meta
  res.setHeader("Content-Length", String(pngBuffer.length));
  res.end(pngBuffer);
}

// ================= GET (O QUE O INSTAGRAM PRECISA) =================
// Use assim:
// /card.png?frase=...&autor=...&bg=%230B0B0F&fg=%23FFFFFF
app.get("/card.png", async (req, res) => {
  try {
    const frase = (req.query.frase || "").toString().trim();
    const autor = (req.query.autor || "").toString().trim();
    const bg = (req.query.bg || "#0B0B0F").toString();
    const fg = (req.query.fg || "#FFFFFF").toString();

    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const png = await renderPng({ frase, autor, bg, fg });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

// ================= POST (SEU USO NO N8N, CONTINUA FUNCIONANDO) =================
app.post("/card", async (req, res) => {
  try {
    const { frase, autor, bg, fg } = req.body || {};
    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const png = await renderPng({
      frase: String(frase).trim(),
      autor: typeof autor === "string" ? autor.trim() : "",
      bg: typeof bg === "string" ? bg : "#0B0B0F",
      fg: typeof fg === "string" ? fg : "#FFFFFF",
    });

    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});
app.get("/card.png", async (req, res) => {
  try {
    const frase = (req.query.frase || "").toString().trim();
    const autor = (req.query.autor || "").toString().trim();
    const bg = (req.query.bg || "#0B0B0F").toString();
    const fg = (req.query.fg || "#FFFFFF").toString();

    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const svg = svgCard({ frase, autor, bg, fg });
    const png = await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();

    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="card.png"');
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("Content-Length", String(png.length));
    return res.end(png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
