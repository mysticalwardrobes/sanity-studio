import assert from 'node:assert/strict'
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {test} from 'node:test'

import sharp from 'sharp'

import {prepareImport} from './prepare'

const firstImage = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="160">
    <rect width="120" height="160" fill="#f5c8d8"/>
    <circle cx="38" cy="48" r="26" fill="#392a61"/>
  </svg>
`)
const secondImage = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="120">
    <rect width="160" height="120" fill="#203c56"/>
    <rect x="80" width="80" height="120" fill="#f0b845"/>
  </svg>
`)

test('prepareImport inventories files, converts special images, and uploads every still', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'prom-queen-prepare-test-'))
  const sourceDirectory = path.join(root, 'Prom Queens')
  const convertedDirectory = path.join(sourceDirectory, 'converted')
  const manifestPath = path.join(convertedDirectory, 'import-manifest.json')
  await mkdir(sourceDirectory)

  const direct = await sharp(firstImage).jpeg().toBuffer()
  const converted = await sharp(secondImage).jpeg().toBuffer()
  await writeFile(path.join(sourceDirectory, 'queen.jpg'), direct)
  await writeFile(path.join(sourceDirectory, 'queen-copy.jpg'), direct)
  await writeFile(path.join(sourceDirectory, 'raw.HEIC'), Buffer.from('raw source placeholder'))
  await writeFile(path.join(sourceDirectory, 'clip.MOV'), Buffer.alloc(0))
  await writeFile(path.join(sourceDirectory, '.DS_Store'), Buffer.alloc(0))

  const manifest = await prepareImport({
    sourceDirectory,
    convertedDirectory,
    manifestPath,
    now: () => new Date('2026-08-22T00:00:00.000Z'),
    dependencies: {
      convertFile: async (_source, destination) => writeFile(destination, converted),
      onProgress: () => undefined,
    },
  })

  assert.deepEqual(manifest.inventory, {
    totalFiles: 5,
    directImages: 2,
    convertedImages: 1,
    videos: 1,
    unsupported: 1,
  })
  assert.deepEqual(manifest.localDuplicates, [])
  assert.equal(manifest.entries.length, 3)
  assert.ok(manifest.entries.every((entry) => entry.action === 'upload-new-asset'))
  assert.deepEqual(
    manifest.entries.map((entry) => entry.sourceFilename),
    ['queen-copy.jpg', 'queen.jpg', 'raw.HEIC'],
  )
  assert.equal(path.basename(manifest.entries[2].uploadPath), 'raw.heic.jpg')

  const persisted = JSON.parse(await readFile(manifestPath, 'utf8'))
  assert.deepEqual(persisted, manifest)
})
