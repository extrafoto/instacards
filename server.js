const palettes = [
  ["#1C6E8C", "#F3DFA8", "#F3C59B", "#FA4711", "#D06E55"],
  ["#2D89B7", "#F0C8BE", "#F7B96E", "#D87938", "#E6E6E6"],
  ["#F6EBE4", "#F0BA5C", "#E4A84E", "#D1772E", "#F7C9E6"],
  ["#3375CC", "#286AAB", "#4791D1", "#CCCCCC", "#E7E7E4"],
  ["#A6A2C3", "#D2D1E0", "#E0DEEB", "#9FA6CF", "#A8B3D7"],
  ["#039E96", "#04C8CB", "#FAEA05", "#FDAA37", "#FDE498"],
];

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

// luminância relativa (W3C)
function relLuminance({ r, g, b }) {
  const srgb = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(hex1, hex2) {
  const L1 = relLuminance(hexToRgb(hex1));
  const L2 = relLuminance(hexToRgb(hex2));
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

// escolhe bg + text com contraste bom (>= 4.5 se der)
function pickColors() {
  const p = palettes[Math.floor(Math.random() * palettes.length)];

  // tenta achar a melhor combinação bg/text na própria paleta
  let best = { bg: p[0], fg: p[4], ratio: 0 };
  for (const bg of p) {
    for (const fg of p) {
      if (bg === fg) continue;
      const ratio = contrastRatio(bg, fg);
      if (ratio > best.ratio) best = { bg, fg, ratio };
    }
  }

  // escolhe um accent diferente (pra detalhe)
  const accent = p.find(c => c !== best.bg && c !== best.fg) || p[0];

  return { bg: best.bg, fg: best.fg, accent };
}
