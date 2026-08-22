import path from 'node:path'

import sharp from 'sharp'

type ImageInput = Buffer | string

export function conversionFilename(filename: string): string {
  const parsed = path.parse(filename)
  return `${parsed.name}${parsed.ext.toLowerCase()}.jpg`
}

async function differenceHash(input: ImageInput, fit: 'contain' | 'cover'): Promise<string> {
  const pixels = await sharp(input, {failOn: 'error'})
    .rotate()
    .flatten({background: '#000000'})
    .resize(9, 8, {fit, position: 'centre', background: '#000000'})
    .greyscale()
    .raw()
    .toBuffer()

  let hash = BigInt(0)
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      hash <<= BigInt(1)
      const offset = row * 9 + column
      if (pixels[offset] > pixels[offset + 1]) hash |= BigInt(1)
    }
  }
  return hash.toString(16).padStart(16, '0')
}

export async function createPerceptualHashes(input: ImageInput): Promise<string[]> {
  return Promise.all([differenceHash(input, 'contain'), differenceHash(input, 'cover')])
}

export async function validateImage(input: ImageInput): Promise<{
  width: number
  height: number
  entropy: number
}> {
  const image = sharp(input, {failOn: 'error'}).rotate()
  const metadata = await image.metadata()
  if (!metadata.width || !metadata.height) throw new Error('Image has invalid dimensions')

  const stats = await image.stats()
  if (!Number.isFinite(stats.entropy) || stats.entropy < 0.01) {
    throw new Error('Conversion produced a blank image')
  }

  return {width: metadata.width, height: metadata.height, entropy: stats.entropy}
}

export async function convertToJpeg(input: ImageInput, destination: string): Promise<void> {
  await sharp(input, {failOn: 'error'})
    .rotate()
    .flatten({background: '#ffffff'})
    .toColourspace('srgb')
    .jpeg({quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true})
    .toFile(destination)

  await validateImage(destination)
}
