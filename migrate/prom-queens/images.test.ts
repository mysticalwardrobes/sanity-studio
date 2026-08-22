import assert from 'node:assert/strict'
import {mkdtemp, readFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {test} from 'node:test'

import sharp from 'sharp'

import {
  conversionFilename,
  convertToJpeg,
  createPerceptualHashes,
  validateImage,
} from './images'
import {hammingDistance} from './core'

const patternedSvg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="160">
    <rect width="120" height="160" fill="#f8d4df"/>
    <rect x="10" y="20" width="45" height="120" fill="#31234f"/>
    <circle cx="88" cy="52" r="25" fill="#f2b632"/>
  </svg>
`)

test('conversionFilename preserves the source extension to avoid collisions', () => {
  assert.equal(conversionFilename('IMG_0045.HEIC'), 'IMG_0045.heic.jpg')
  assert.equal(conversionFilename('portrait.DNG'), 'portrait.dng.jpg')
})

test('createPerceptualHashes stays stable across PNG and JPEG encodings', async () => {
  const png = await sharp(patternedSvg).png().toBuffer()
  const jpeg = await sharp(patternedSvg).jpeg({quality: 88}).toBuffer()

  const pngHashes = await createPerceptualHashes(png)
  const jpegHashes = await createPerceptualHashes(jpeg)
  const minimumDistance = Math.min(
    ...pngHashes.flatMap((left) => jpegHashes.map((right) => hammingDistance(left, right))),
  )

  assert.equal(pngHashes.length, 2)
  assert.ok(minimumDistance <= 4, `expected distance <= 4, received ${minimumDistance}`)
})

test('validateImage rejects blank output and accepts a real image', async () => {
  const blank = await sharp({
    create: {width: 100, height: 100, channels: 3, background: '#000000'},
  })
    .jpeg()
    .toBuffer()
  const patterned = await sharp(patternedSvg).jpeg().toBuffer()

  await assert.rejects(() => validateImage(blank), /blank image/i)
  await assert.doesNotReject(() => validateImage(patterned))
})

test('convertToJpeg normalizes a rendered image into a valid JPEG', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'prom-queen-conversion-test-'))
  const destination = path.join(directory, 'converted.jpg')
  const rendered = await sharp(patternedSvg).png().toBuffer()

  await convertToJpeg(rendered, destination)

  const converted = await readFile(destination)
  const metadata = await sharp(converted).metadata()
  assert.equal(metadata.format, 'jpeg')
  assert.equal(metadata.space, 'srgb')
  await assert.doesNotReject(() => validateImage(converted))
})
