import assert from 'node:assert/strict'
import {mkdtemp, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {test} from 'node:test'

import sharp from 'sharp'

import {convertWithQuickLook, sanityThumbnailUrl} from './runtime'

test('sanityThumbnailUrl requests a small canonical source image', () => {
  assert.equal(
    sanityThumbnailUrl('https://cdn.sanity.io/images/project/production/hash-1000x1200.jpg'),
    'https://cdn.sanity.io/images/project/production/hash-1000x1200.jpg?w=256&h=256&fit=max&auto=format',
  )
})

test('convertWithQuickLook normalizes the renderer output and keeps the requested destination', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'prom-queen-runtime-test-'))
  const source = path.join(directory, 'queen.HEIC')
  const destination = path.join(directory, 'queen.heic.jpg')
  await writeFile(source, Buffer.from('source placeholder'))

  await convertWithQuickLook(source, destination, async (_source, outputDirectory) => {
    const renderedPath = path.join(outputDirectory, 'queen.HEIC.png')
    await sharp(
      Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="160">
          <rect width="120" height="160" fill="#c56a8b"/>
          <circle cx="60" cy="70" r="32" fill="#2d254d"/>
        </svg>
      `),
    )
      .png()
      .toFile(renderedPath)
  })

  const metadata = await sharp(destination).metadata()
  assert.equal(metadata.format, 'jpeg')
  assert.equal(metadata.width, 120)
  assert.equal(metadata.height, 160)
})
