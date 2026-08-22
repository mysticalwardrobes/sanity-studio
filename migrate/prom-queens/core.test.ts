import assert from 'node:assert/strict'
import {test} from 'node:test'

import {
  classifyFiles,
  collapseExactDuplicates,
  decideImportAction,
  hammingDistance,
  nextNumericClientName,
  normalizeFilename,
} from './core'

test('classifyFiles separates direct images, convertible images, videos, and unsupported files', () => {
  const result = classifyFiles([
    'queen.JPG',
    'portrait.png',
    'phone.HEIC',
    'camera.CR2',
    'raw.dng',
    'clip.MOV',
    '.DS_Store',
  ])

  assert.deepEqual(result.direct, ['portrait.png', 'queen.JPG'])
  assert.deepEqual(result.convert, ['camera.CR2', 'phone.HEIC', 'raw.dng'])
  assert.deepEqual(result.videos, ['clip.MOV'])
  assert.deepEqual(result.unsupported, ['.DS_Store'])
})

test('normalizeFilename matches punctuation and extension variants without merging distinct stems', () => {
  assert.equal(normalizeFilename('IMG_0108(1).HEIC'), 'img01081')
  assert.equal(normalizeFilename('IMG_0108_1_.png'), 'img01081')
  assert.notEqual(normalizeFilename('IMG_3883.JPG'), normalizeFilename('IMG_3884.jpeg'))
})

test('collapseExactDuplicates keeps one canonical file for each content hash', () => {
  const result = collapseExactDuplicates([
    {filename: 'L.JPG', sha1: 'same'},
    {filename: 'IMG_0834.JPG', sha1: 'same'},
    {filename: 'unique.jpg', sha1: 'different'},
  ])

  assert.deepEqual(result.unique, [
    {filename: 'IMG_0834.JPG', sha1: 'same'},
    {filename: 'unique.jpg', sha1: 'different'},
  ])
  assert.deepEqual(result.duplicates, [{filename: 'L.JPG', duplicateOf: 'IMG_0834.JPG'}])
})

test('hammingDistance counts differing perceptual-hash bits', () => {
  assert.equal(hammingDistance('0000000000000000', '000000000000000f'), 4)
  assert.equal(hammingDistance('ffffffffffffffff', 'ffffffffffffffff'), 0)
})

test('decideImportAction skips an image already represented by a Prom Queens document', () => {
  const result = decideImportAction(
    {filename: 'queen.jpg', sha1: 'local', perceptualHashes: ['0000000000000000']},
    [
      {
        assetId: 'image-existing',
        filename: 'renamed.png',
        sha1: 'remote',
        perceptualHashes: ['0000000000000003'],
        usedByPromQueen: true,
      },
    ],
  )

  assert.deepEqual(result, {
    action: 'skip-existing-prom-queen',
    assetId: 'image-existing',
    reason: 'perceptual-hash',
  })
})

test('decideImportAction reuses a matching asset that is not in Prom Queens', () => {
  const result = decideImportAction(
    {filename: 'queen.jpg', sha1: 'same', perceptualHashes: ['ffffffffffffffff']},
    [
      {
        assetId: 'image-existing',
        filename: 'queen.jpg',
        sha1: 'same',
        perceptualHashes: ['0000000000000000'],
        usedByPromQueen: false,
      },
    ],
  )

  assert.deepEqual(result, {
    action: 'reuse-existing-asset',
    assetId: 'image-existing',
    reason: 'sha1',
  })
})

test('decideImportAction prefers a Prom Queens reference when matching assets are equally strong', () => {
  const result = decideImportAction(
    {filename: 'queen.jpg', sha1: 'same', perceptualHashes: ['ffffffffffffffff']},
    [
      {
        assetId: 'image-unreferenced',
        filename: 'queen.jpg',
        sha1: 'same',
        perceptualHashes: [],
        usedByPromQueen: false,
      },
      {
        assetId: 'image-prom-queen',
        filename: 'queen-copy.jpg',
        sha1: 'same',
        perceptualHashes: [],
        usedByPromQueen: true,
      },
    ],
  )

  assert.deepEqual(result, {
    action: 'skip-existing-prom-queen',
    assetId: 'image-prom-queen',
    reason: 'sha1',
  })
})

test('decideImportAction does not suppress distinct images that share a filename stem', () => {
  const result = decideImportAction(
    {filename: 'IMG_3883.jpeg', sha1: 'local', perceptualHashes: ['0000000000000000']},
    [
      {
        assetId: 'image-existing',
        filename: 'IMG_3883.png',
        sha1: 'remote',
        perceptualHashes: ['ffffffffffffffff'],
        usedByPromQueen: true,
      },
    ],
  )

  assert.deepEqual(result, {action: 'upload-new-asset', reason: 'no-match'})
})

test('nextNumericClientName starts after the highest numeric placeholder', () => {
  assert.equal(nextNumericClientName(['2', '106', null, 'Client Name', '45']), '107')
})
