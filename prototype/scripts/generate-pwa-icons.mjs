import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outputDirectory = join(root, 'public', 'icons')
mkdirSync(outputDirectory, { recursive: true })

const palette = {
  background: [32, 38, 44, 255],
  mark: [212, 166, 90, 255],
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const result = Buffer.alloc(data.length + 12)
  result.writeUInt32BE(data.length, 0)
  name.copy(result, 4)
  data.copy(result, 8)
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8)
  return result
}

function createIcon(size) {
  const stride = 1 + size * 4
  const pixels = Buffer.alloc(stride * size)
  const center = size / 2
  const outerRadius = size * 0.31
  const innerRadius = size * 0.2

  for (let y = 0; y < size; y += 1) {
    const row = y * stride
    pixels[row] = 0
    for (let x = 0; x < size; x += 1) {
      const dx = x + 0.5 - center
      const dy = y + 0.5 - center
      const distance = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx)
      const inRing = distance <= outerRadius && distance >= innerRadius
      const rightGap = Math.abs(angle) < Math.PI * 0.3
      const color = inRing && !rightGap ? palette.mark : palette.background
      const offset = row + 1 + x * 4
      pixels.set(color, offset)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6

  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  writeFileSync(join(outputDirectory, `capproje-${size}.png`), createIcon(size))
}
