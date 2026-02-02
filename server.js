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
 * AQUI É ONDE VOCÊ CONTROLA A MARGEM LATERAL:
 * O parâmetro 'maxChars' define quantos caracteres cabem em uma linha.
 * Diminuir este número (ex: de 32 para 25) afasta o texto das bordas.
 */
function wrapText(text, maxChars = 26) { // Ajustado para 26 para uma margem bem folgada
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

// ================= SVG CARD DESIGN PREMIUM (AUTO-SCALING) =================
function svgCard({ frase, autor, bg = "#0A0A0B", fg = "#FFFFFF" }) {
  const width = 1080, height = 1080;

  // ===== ÁREA ÚTIL / MARGENS =====
  // Ajuste aqui para “respiro” lateral e para reservar espaço do autor.
  const padX = 160;          // margem lateral real (aumente para mais respiro)
  const topReserve = 210;    // espaço para as aspas + respiro superior
  const bottomReserve = autor ? 260 : 180; // espaço para autor (e linha)

  const textAreaWidth = width - padX * 2;
  const textAreaHeight = height - topReserve - bottomReserve;

  // ===== TIPOGRAFIA =====
  const fontFamily = "serif";
  const fontWeight = 400;
  const lineHeightFactor = 1.45;   // mais elegante que 1.5 e ajuda a caber

  // ===== AUTO-SCALING =====
  // Começa em um tamanho bonito e vai reduzindo até caber.
  const maxFontSize = 40;
  const minFontSize = 26;

  // Aproximação: largura média de caractere em fontes serif ~ 0.60–0.70 do fontSize.
  // Quanto MAIOR esse fator, MENOS chars por linha -> quebra mais -> força reduzir fonte.
  const charWidthFactor = 0.66;

  // Limite de linhas pra não virar “paredão”
  const maxLines = 9;

  let fontSize = maxFontSize;
  let lines = [];
  let lineHeight = 0;

  for (; fontSize >= minFontSize; fontSize -= 1) {
    const maxChars = Math.max(16, Math.floor(textAreaWidth / (fontSize * charWidthFactor)));
    lines = wrapText(frase, maxChars);

    if (lines.length > maxLines) continue;

    lineHeight = Math.round(fontSize * lineHeightFactor);
    const blockHeight = lines.length * lineHeight;

    if (blockHeight <= textAreaHeight) break; // ✅ coube
  }

  // Se mesmo no mínimo não couber, corta linhas extras (último recurso elegante)
  if (lines.length > maxLines) lines = lines.slice(0, maxLines);

  const lineHeightFinal = Math.round(fontSize * lineHeightFactor);
  const blockHeightFinal = lines.length * lineHeightFinal;

  // Centraliza o bloco dentro da área útil
  const startY = Math.round(
    topReserve + (textAreaHeight / 2) - (blockHeightFinal / 2) + (fontSize / 3)
  );

  const tspans = lines
    .map((ln, i) => `<tspan x="540" dy="${i === 0 ? 0 : lineHeightFinal}">${escapeXml(ln)}</tspan>`)
    .join("");

  // Posição das aspas baseada na área útil (fica sempre harmoniosa)
  const quoteY = Math.max(130, startY - Math.round(fontSize * 2.2));

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${bg}"/>

  <!-- Aspas -->
  <text x="540" y="${quoteY}" 
    text-anchor="middle" 
    fill="${fg}" 
    opacity="0.18" 
    font-family="Times New Roman, serif" 
    font-size="160" 
    font-style="italic">“</text>

  <!-- Texto Principal -->
  <text x="540" y="${startY}"
    text-anchor="middle"
    fill="${fg}"
    font-family="${fontFamily}"
    font-size="${fontSize}"
    font-weight="${fontWeight}"
    letter-spacing="0.2">
    ${tspans}
  </text>

  ${
    autor
      ? `
  <rect x="515" y="${height - 170}" width="50" height="1" fill="${fg}" opacity="0.3" />
  <text x="540" y="${height - 120}"
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
// ================= ENDPOINT GET (para usar como Image URL no Instagram) =================
app.get("/card", async (req, res) => {
  try {
    const frase = typeof req.query.frase === "string" ? req.query.frase.trim() : "";
    const autor = typeof req.query.autor === "string" ? req.query.autor.trim() : "";
    const bg = typeof req.query.bg === "string" ? req.query.bg : "#0B0B0F";
    const fg = typeof req.query.fg === "string" ? req.query.fg : "#FFFFFF";

    if (!frase || frase.length < 2) {
      return res.status(400).json({ error: "Query param 'frase' é obrigatório." });
    }

    const svg = svgCard({ frase, autor, bg, fg });

    const png = await sharp(Buffer.from(svg))
      .png({ quality: 95 })
      .toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="card.png"');
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem (GET)." });
  }
});


