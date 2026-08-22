import path from 'node:path'

import {nextNumericClientName, type ImportAction} from './core'

export type ManifestEntry = {
  sourceFilename: string
  uploadPath: string
  sha1: string
  perceptualHashes: string[]
  action: ImportAction['action']
  assetId?: string
  reason: ImportAction['reason']
}

export type ImportManifest = {
  version: 1
  target: {projectId: string; dataset: string}
  generatedAt: string
  sourceDirectory: string
  convertedDirectory: string
  inventory: {
    totalFiles: number
    directImages: number
    convertedImages: number
    videos: number
    unsupported: number
  }
  videos: string[]
  unsupported: string[]
  localDuplicates: Array<{filename: string; duplicateOf: string}>
  entries: ManifestEntry[]
}

export function summarizeManifest(manifest: ImportManifest) {
  return {
    sourceFiles: manifest.inventory.totalFiles,
    uniqueImages: manifest.entries.length,
    skippedVideos: manifest.videos.length,
    localDuplicates: manifest.localDuplicates.length,
    skippedExistingPromQueens: manifest.entries.filter(
      (entry) => entry.action === 'skip-existing-prom-queen',
    ).length,
    reusedAssets: manifest.entries.filter((entry) => entry.action === 'reuse-existing-asset')
      .length,
    newUploads: manifest.entries.filter((entry) => entry.action === 'upload-new-asset').length,
  }
}

type ApplyDependencies = {
  getClientNames: () => Promise<Array<string | null>>
  uploadAsset: (filePath: string, filename: string) => Promise<string>
  createPromQueen: (assetId: string, clientName: string) => Promise<string>
}

export async function applyManifest(manifest: ImportManifest, dependencies: ApplyDependencies) {
  const existingClientNames = await dependencies.getClientNames()
  let nextClientName = Number(nextNumericClientName(existingClientNames))
  const result = {
    createdDocuments: 0,
    uploadedAssets: 0,
    reusedAssets: 0,
    skippedExistingDocuments: 0,
  }

  for (const entry of manifest.entries) {
    if (entry.action === 'skip-existing-prom-queen') {
      result.skippedExistingDocuments += 1
      continue
    }

    let assetId: string
    if (entry.action === 'reuse-existing-asset') {
      if (!entry.assetId) throw new Error(`Missing reusable asset ID for ${entry.sourceFilename}`)
      assetId = entry.assetId
      result.reusedAssets += 1
    } else {
      assetId = await dependencies.uploadAsset(entry.uploadPath, path.basename(entry.uploadPath))
      result.uploadedAssets += 1
    }

    await dependencies.createPromQueen(assetId, String(nextClientName))
    nextClientName += 1
    result.createdDocuments += 1
  }

  return result
}
