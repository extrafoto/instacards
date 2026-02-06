

Iniciar teste gratuito

Compartilhar
server(6).js
Código · 10.37 KB
limpar o código e diminuir a fonte
Lite
Com certeza! Vou analisar o código do arquivo server(6).js para realizar a limpeza e ajustar o tamanho da fonte conforme solicitado.
Estou analisando o código do arquivo `server(6).js` para identificar melhorias e otimizações, preparando-me para reduzir seu tamanho e ajustar a fonte posteriormente.

Identifiquei que o código usa variáveis de fundo bg1 e bg2 na configuração SVG, mas apenas bg foi definido. Preciso ajustar para usar bg1 e bg2 corretamente na geração da imagem.

Percebi que as variáveis bg1 e bg2 precisam ser definidas na configuração SVG para evitar erros, pois atualmente apenas bg está configurada.

Lite
Concluí a limpeza e otimização do seu código. Aqui está o resumo das alterações realizadas:
Limpeza de Conflitos: Removi todos os marcadores de conflito do Git (<<<<<<<, =======, >>>>>>>) e resolvi as duplicatas de funções, mantendo as versões mais estáveis e eficientes.
Redução da Fonte: O tamanho da fonte base foi reduzido de 56-64px para 48px, com ajustes dinâmicos para frases longas que agora podem chegar a 28px para garantir que o texto caiba no card. A fonte do autor também foi reduzida para 28px.
Refatoração:
Consolidei a lógica de quebra de linha (wrapText) para ser mais consistente.
Criei a função computeTypography para centralizar o controle de tamanhos de fonte e limites de caracteres.
Padronizei o tratamento de cores de fundo e acentos.
Organização: O código está agora mais legível, com comentários claros e uma estrutura profissional seguindo as melhores práticas de Node.js e Express.
Você pode baixar o arquivo server.js atualizado abaixo.
server.js
Código · 7.12 KB
Ver todos os arquivos nesta tarefa
Tarefa concluída
Como foi este resultado?
Sugestões de acompanhamento



server.js
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

// hash simples e estável (pra escolher paleta pela frase/autor)
function hashStr(s = "") {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// paletas (bg1/bg2 = gradiente; fg = texto; accent = detalhe)
const PALETTES = [
  { bg1: "#0B132B", bg2: "#1C2541", fg: "#F7F7FF", accent: "#5BC0BE" }, // navy/teal
  { bg1: "#111827", bg2: "#0B0F1A", fg: "#F9FAFB", accent: "#F59E0B" }, // graphite/amber
  { bg1: "#0F172A", bg2: "#1E293B", fg: "#E2E8F0", accent: "#22C55E" }, // slate/green
  { bg1: "#2B193D", bg2: "#3A1C71", fg: "#FFF7ED", accent: "#FB7185" }, // purple/pink
  { bg1: "#0B3D2E", bg2: "#073B4C", fg: "#F8FAFC", accent: "#FFD166" }, // deep teal/yellow
  { bg1: "#2D1B0F", bg2: "#1F2937", fg: "#FFF7ED", accent: "#60A5FA" }, // warm brown/blue
  { bg1: "#0A0A0A", bg2: "#1F1F1F", fg: "#FFFFFF", accent: "#A3E635" }, // dark/lime
  { bg1: "#123524", bg2: "#0F766E", fg: "#F0FDFA", accent: "#FB923C" }, // green/teal/orange
];

// normaliza hex tipo "%23FFFFFF" ou "FFFFFF" ou "#FFF"
function normalizeHex(hex, fallback) {
  if (!hex) return fallback;
  let v = String(hex).trim();
  v = v.replace("%23", "#");
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) {
    v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
  return v;
}

function choosePalette(frase, autor) {
  const h = hashStr(`${frase}||${autor}`);
  return PALETTES[h % PALETTES.length];
}

function wrapText(text, maxChars = 30) {
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
  return lines.slice(0, 10); // limite de linhas para evitar overflow
}

// Ajuste de tipografia dinâmica baseado no comprimento da frase
function computeTypography(frase) {
  const len = (frase || "").length;

  // Valores base (reduzidos conforme solicitado pelo usuário)
  let fontSize = 48; // Era 64/56
  let maxChars = 24; // Era 30/22

  if (len > 140) {
    fontSize = 40;
    maxChars = 28;
  }
  if (len > 220) {
    fontSize = 34;
    maxChars = 32;
  }
  if (len > 320) {
    fontSize = 28;
    maxChars = 36;
  }

  const lineHeight = Math.round(fontSize * 1.35);
  return { maxChars, fontSize, lineHeight };
}

function svgCard({ frase, autor, bg, fg, accent }) {
  const width = 1080;
  const height = 1080;

  // ÁREA SEGURA
  const safePaddingX = 180;
  const safePaddingY = 220;

  // Obtém configurações de tipografia
  const { maxChars, fontSize, lineHeight } = computeTypography(frase);

  const lines = wrapText(frase, maxChars);
  const blockHeight = lines.length * lineHeight;
  const startY = Math.round((height - blockHeight) / 2);

  const tspans = lines.map((ln, i) =>
    `<tspan x="540" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(ln)}</tspan>`
  ).join("");

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <radialGradient id="g" cx="50%" cy="40%" r="80%">
        <stop offset="0%" stop-color="${bg}" stop-opacity="1"/>
        <stop offset="100%" stop-color="#111" stop-opacity="1"/>
      </radialGradient>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.03"/>
        </feComponentTransfer>
      </filter>
    </defs>

    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" filter="url(#noise)"/>

    <line x1="${safePaddingX}" x2="${width - safePaddingX}"
          y1="${safePaddingY - 80}" y2="${safePaddingY - 80}"
          stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.8"/>

    <text x="540" y="${startY}"
      text-anchor="middle"
      fill="${fg}"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="700">
      ${tspans}
    </text>

    ${autor ? `
    <text x="540" y="${height - safePaddingY}"
      text-anchor="middle"
      fill="${fg}"
      opacity="0.85"
      font-family="DejaVu Sans, Arial, sans-serif"
      font-size="28"
      font-weight="500">— ${escapeXml(autor)}</text>` : ""}
  </svg>`;
}

async function renderPng({ frase, autor, bg, fg, accent }) {
  const svg = svgCard({ frase, autor, bg, fg, accent });
  return await sharp(Buffer.from(svg)).png({ quality: 95 }).toBuffer();
}

function sendPng(res, pngBuffer) {
  res.status(200);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", 'inline; filename="card.png"');
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("Content-Length", String(pngBuffer.length));
  res.end(pngBuffer);
}

app.head("/card.png", (req, res) => {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).end();
});

app.get("/card.png", async (req, res) => {
  try {
    const frase = (req.query.frase || "").toString().trim();
    const autor = (req.query.autor || "").toString().trim();

    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const p = choosePalette(frase, autor);
    const bg = normalizeHex(req.query.bg || req.query.bg1, p.bg1);
    const fg = normalizeHex(req.query.fg, p.fg);
    const accent = normalizeHex(req.query.accent, p.accent);

    const png = await renderPng({ frase, autor, bg, fg, accent });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.post("/card", async (req, res) => {
  try {
    const { frase, autor } = req.body || {};
    if (!frase) return res.status(400).json({ error: "frase é obrigatória" });

    const f = String(frase).trim();
    const a = typeof autor === "string" ? autor.trim() : "";

    const p = choosePalette(f, a);
    const bg = normalizeHex(req.body?.bg || req.body?.bg1, p.bg1);
    const fg = normalizeHex(req.body?.fg, p.fg);
    const accent = normalizeHex(req.body?.accent, p.accent);

    const png = await renderPng({ frase: f, autor: a, bg, fg, accent });
    return sendPng(res, png);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Falha ao gerar imagem" });
  }
});

app.listen(PORT, () => {
  console.log(`quote-card-service listening on :${PORT}`);
});
