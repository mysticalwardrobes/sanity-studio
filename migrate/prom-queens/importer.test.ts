import assert from 'node:assert/strict'
import {test} from 'node:test'

import {applyManifest, summarizeManifest, type ImportManifest} from './importer'

function manifestFixture(): ImportManifest {
  return {
    version: 1,
    target: {projectId: 'yz23zros', dataset: 'production'},
    generatedAt: '2026-08-22T00:00:00.000Z',
    sourceDirectory: '/photos',
    convertedDirectory: '/photos/converted',
    inventory: {totalFiles: 4, directImages: 3, convertedImages: 0, videos: 1, unsupported: 0},
    videos: ['clip.mov'],
    unsupported: [],
    localDuplicates: [],
    entries: [
      {
        sourceFilename: 'already-prom.jpg',
        uploadPath: '/photos/already-prom.jpg',
        sha1: 'one',
        perceptualHashes: ['0000000000000000'],
        action: 'skip-existing-prom-queen',
        assetId: 'image-prom',
        reason: 'sha1',
      },
      {
        sourceFilename: 'reuse.jpg',
        uploadPath: '/photos/reuse.jpg',
        sha1: 'two',
        perceptualHashes: ['1111111111111111'],
        action: 'reuse-existing-asset',
        assetId: 'image-reuse',
        reason: 'sha1',
      },
      {
        sourceFilename: 'raw.HEIC',
        uploadPath: '/photos/converted/raw.heic.jpg',
        sha1: 'three',
        perceptualHashes: ['2222222222222222'],
        action: 'upload-new-asset',
        reason: 'no-match',
      },
    ],
  }
}

test('summarizeManifest counts every terminal action', () => {
  assert.deepEqual(summarizeManifest(manifestFixture()), {
    sourceFiles: 4,
    uniqueImages: 3,
    skippedVideos: 1,
    localDuplicates: 0,
    skippedExistingPromQueens: 1,
    reusedAssets: 1,
    newUploads: 1,
  })
})

test('applyManifest creates sequential documents for reused and uploaded assets', async () => {
  const uploaded: Array<{filePath: string; filename: string}> = []
  const created: Array<{assetId: string; clientName: string}> = []

  const result = await applyManifest(manifestFixture(), {
    getClientNames: async () => ['45', '106'],
    uploadAsset: async (filePath, filename) => {
      uploaded.push({filePath, filename})
      return 'image-new'
    },
    createPromQueen: async (assetId, clientName) => {
      created.push({assetId, clientName})
      return `document-${clientName}`
    },
  })

  assert.deepEqual(uploaded, [
    {filePath: '/photos/converted/raw.heic.jpg', filename: 'raw.heic.jpg'},
  ])
  assert.deepEqual(created, [
    {assetId: 'image-reuse', clientName: '107'},
    {assetId: 'image-new', clientName: '108'},
  ])
  assert.deepEqual(result, {
    createdDocuments: 2,
    uploadedAssets: 1,
    reusedAssets: 1,
    skippedExistingDocuments: 1,
  })
})

test('applyManifest creates one document per upload even when Sanity returns the same asset ID', async () => {
  const created: Array<{assetId: string; clientName: string}> = []
  const manifest = manifestFixture()
  manifest.entries = [
    manifest.entries[2],
    {
      ...manifest.entries[2],
      sourceFilename: 'raw-copy.HEIC',
      uploadPath: '/photos/converted/raw-copy.heic.jpg',
    },
  ]

  const result = await applyManifest(manifest, {
    getClientNames: async () => ['106'],
    uploadAsset: async () => 'image-new',
    createPromQueen: async (assetId, clientName) => {
      created.push({assetId, clientName})
      return `document-${clientName}`
    },
  })

  assert.deepEqual(created, [
    {assetId: 'image-new', clientName: '107'},
    {assetId: 'image-new', clientName: '108'},
  ])
  assert.deepEqual(result, {
    createdDocuments: 2,
    uploadedAssets: 2,
    reusedAssets: 0,
    skippedExistingDocuments: 0,
  })
})
