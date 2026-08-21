import QRCode from "qrcode";

export function generateQrSvgDataUri(url: string, includeLogo: boolean): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const modules = qr.modules;
  const size = modules.size;
  const viewBoxSize = 400;
  const quietZone = 2;
  const totalModules = size + quietZone * 2;
  const moduleSize = viewBoxSize / totalModules;

  let rects = "";
  const logoRadius = Math.floor(size * 0.14);
  const logoCenter = Math.floor(size / 2);
  const logoStart = logoCenter - logoRadius;
  const logoEnd = logoCenter + logoRadius;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (includeLogo && r >= logoStart && r <= logoEnd && c >= logoStart && c <= logoEnd) {
        continue;
      }
      if (modules.get(r, c)) {
        const x = (c + quietZone) * moduleSize;
        const y = (r + quietZone) * moduleSize;
        rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(moduleSize + 0.1).toFixed(2)}" height="${(moduleSize + 0.1).toFixed(2)}" fill="#0A192F" />`;
      }
    }
  }

  let logoSvg = "";
  if (includeLogo) {
    const logoX = (logoStart + quietZone - 0.5) * moduleSize;
    const logoY = (logoStart + quietZone - 0.5) * moduleSize;
    const logoW = (logoEnd - logoStart + 2) * moduleSize;

    logoSvg = `
      <rect x="${logoX.toFixed(2)}" y="${logoY.toFixed(2)}" width="${logoW.toFixed(2)}" height="${logoW.toFixed(2)}" fill="#FFFFFF" rx="12" stroke="#0A192F" stroke-width="4" />
      <rect x="${(logoX + 4).toFixed(2)}" y="${(logoY + 4).toFixed(2)}" width="${(logoW - 8).toFixed(2)}" height="${(logoW - 8).toFixed(2)}" fill="#0A192F" rx="8" />
      <text x="${(logoX + logoW / 2).toFixed(2)}" y="${(logoY + logoW / 2 + 10).toFixed(2)}" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="${(logoW * 0.35).toFixed(2)}" text-anchor="middle">GO</text>
    `;
  }

  const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${viewBoxSize}" height="${viewBoxSize}"><rect width="${viewBoxSize}" height="${viewBoxSize}" fill="#FFFFFF"/>${rects}${logoSvg}</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg)}`;
}
