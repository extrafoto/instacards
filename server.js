import express from "express";
import sharp from "sharp";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

/**
 * Gera um SVG com tipografia decente e quebra de linha automática.
 * - largura/altura fixas (1080x1080)
 * - frase centralizada
 * - autor pequeno no rodapé
 */
function escapeXml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function svgCard({ frase, autor, bg = "#0B0B0F", fg = "#FFFFFF" }) {
  const safeQuote = escapeXml(frase || "");
  const safeAuthor = escapeXml(autor || "");

  // Ajustes simples de layout
  const width = 1080;
  const height = 1080;

  // textLength/line-wrap no SVG puro é chato; então usamos foreignObject com HTML/CSS
  // Isso dá quebra de linha automaticamente e centralização perfeita.
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    <foreignObject x="120" y="140" width="${width - 240}" height="${height - 320}">
      <div xmlns="http://www.w3.org/1999/xhtml"
           style="
             height: 100%;
             display: flex;
             align-items: center;
             justify-content: center;
             text-align: center;
             color: ${fg};
             font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
             font-weight: 700;
             font-size: 64px;
             line-height: 1.15;
             letter-spacing: -0.5px;
             padding: 0;
             margin: 0;
           ">
        <div>
          <div style="white-space: normal; word-break: break-word;">
            ${safeQuote}
          </div>
        </div>
      </div>
    </foreignObject>

    ${safeAuthor ? `
    <text x="540" y="980"
          text-anchor="middle"
          fill="${fg}"
          opacity="0.85"
          font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
          font-size="34"
          font-weight="500">
      — ${safeAuthor}
    </text>` : ""}

  </svg>`;
}

app.get("/health", (req, res) => res.json({ ok: true }));

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
      fg: typeof fg === "string" ? fg : "#FFFFFF"
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
