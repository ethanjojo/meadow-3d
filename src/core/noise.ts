export function hashLattice(x: number, y: number) {
  let state = Math.imul(x, 374761393) + Math.imul(y, 668265263)
  state = Math.imul(state ^ (state >>> 13), 1274126177)
  return ((state ^ (state >>> 16)) >>> 0) / 4_294_967_296
}

export function valueNoise(u: number, v: number, cells = 1) {
  const scaledU = u * cells
  const scaledV = v * cells
  const cellX = Math.floor(scaledU)
  const cellY = Math.floor(scaledV)
  const fractionU = scaledU - cellX
  const fractionV = scaledV - cellY
  const smoothU = fractionU * fractionU * (3 - 2 * fractionU)
  const smoothV = fractionV * fractionV * (3 - 2 * fractionV)
  const cornerA = hashLattice(cellX, cellY)
  const cornerB = hashLattice(cellX + 1, cellY)
  const cornerC = hashLattice(cellX, cellY + 1)
  const cornerD = hashLattice(cellX + 1, cellY + 1)
  const top = cornerA + (cornerB - cornerA) * smoothU
  const bottom = cornerC + (cornerD - cornerC) * smoothU
  return top + (bottom - top) * smoothV
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}
