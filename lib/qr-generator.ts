function getPolynomial(num: number): number[] {
  const logTable = new Array<number>(256);
  const expTable = new Array<number>(256);
  for (let i = 0, x = 1; i < 256; i++) {
    logTable[x] = i;
    expTable[i] = x;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }

  function gfMul(x: number, y: number): number {
    if (x === 0 || y === 0) return 0;
    return expTable[(logTable[x] + logTable[y]) % 255];
  }

  let poly = [1];
  for (let i = 0; i < num; i++) {
    const nextPoly: number[] = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= poly[j];
      nextPoly[j + 1] ^= gfMul(poly[j], expTable[i]);
    }
    poly = nextPoly;
  }
  return poly;
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;

  const size = 33;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  const addFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r;
        const mc = col + c;
        if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            matrix[mr][mc] = isBorder || isCenter;
          } else {
            matrix[mr][mc] = false;
          }
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  const addAlignment = (row: number, col: number) => {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2;
        const isCenter = r === 0 && c === 0;
        matrix[row + r][col + c] = isBorder || isCenter;
      }
    }
  };
  addAlignment(24, 24);

  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  matrix[size - 8][8] = true;

  const bits: number[] = [];
  const addBits = (val: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  addBits(0b0100, 4);
  addBits(len, 8);
  for (let i = 0; i < len; i++) {
    addBits(bytes[i], 8);
  }

  const maxBits = 80 * 8;
  if (bits.length + 4 <= maxBits) {
    addBits(0, 4);
  }
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }
  const padBytes = [236, 17];
  let padIdx = 0;
  while (bits.length < maxBits) {
    addBits(padBytes[padIdx], 8);
    padIdx = (padIdx + 1) % 2;
  }

  let bitIdx = 0;
  let dir = -1;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let row = dir < 0 ? size - 1 : 0; row >= 0 && row < size; row += dir) {
      for (let c = 0; c < 2; c++) {
        const mc = col - c;
        if (matrix[row][mc] === null) {
          const bit = bitIdx < bits.length ? bits[bitIdx++] === 1 : false;
          const mask = (row + mc) % 2 === 0;
          matrix[row][mc] = bit !== mask;
        }
      }
    }
    dir = -dir;
  }

  const formatBits = [true, false, true, false, true, false, false, true, true, false, true, true, true, true, false];
  let fIdx = 0;
  for (let i = 0; i < 8; i++) {
    if (i !== 6) matrix[8][i] = formatBits[fIdx++];
  }
  matrix[8][8] = formatBits[fIdx++];
  matrix[7][8] = formatBits[fIdx++];
  for (let i = 5; i >= 0; i--) {
    matrix[i][8] = formatBits[fIdx++];
  }

  fIdx = 0;
  for (let i = size - 1; i >= size - 7; i--) {
    matrix[8][i] = formatBits[fIdx++];
  }
  for (let i = size - 8; i < size; i++) {
    matrix[i][8] = formatBits[fIdx++];
  }

  return matrix.map((row) => row.map((cell) => cell === true));
}

export function generateQrSvgDataUri(url: string, includeLogo: boolean): string {
  const matrix = generateQrMatrix(url);
  const size = matrix.length;
  const viewBoxSize = 400;
  const quietZone = 2;
  const totalModules = size + quietZone * 2;
  const moduleSize = viewBoxSize / totalModules;

  let rects = "";
  const logoStart = Math.floor(size / 2) - 3;
  const logoEnd = Math.floor(size / 2) + 3;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (includeLogo && r >= logoStart && r <= logoEnd && c >= logoStart && c <= logoEnd) {
        continue;
      }
      if (matrix[r][c]) {
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
