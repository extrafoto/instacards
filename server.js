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
  let fontSize = Math.max(44, 64 - Math.floor(len / 30) * 4);

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
