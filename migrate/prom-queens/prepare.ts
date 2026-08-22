import {createHash} from 'node:crypto'
import {mkdir, readFile, readdir, rename, writeFile} from 'node:fs/promises'
import path from 'node:path'

import {classifyFiles} from './core'
import {conversionFilename, validateImage} from './images'
import type {ImportManifest, ManifestEntry} from './importer'

type PrepareDependencies = {
  convertFile: (source: string, destination: string) => Promise<unknown>
  onProgress: (message: string) => void
}

type PrepareOptions = {
  sourceDirectory: string
  convertedDirectory: string
  manifestPath: string
  dependencies: PrepareDependencies
  now?: () => Date
}

async function sha1File(filePath: string): Promise<string> {
  return createHash('sha1').update(await readFile(filePath)).digest('hex')
}

export async function prepareImport(options: PrepareOptions): Promise<ImportManifest> {
  const {sourceDirectory, convertedDirectory, manifestPath, dependencies} = options
  await mkdir(convertedDirectory, {recursive: true})

  const directoryEntries = await readdir(sourceDirectory, {withFileTypes: true})
  const filenames = directoryEntries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  const classified = classifyFiles(filenames)

  dependencies.onProgress(`Converting ${classified.convert.length} HEIC/raw images`)
  const convertedPaths = new Map<string, string>()
  for (const filename of classified.convert) {
    const source = path.join(sourceDirectory, filename)
    const destination = path.join(convertedDirectory, conversionFilename(filename))
    try {
      await validateImage(destination)
    } catch {
      await dependencies.convertFile(source, destination)
      await validateImage(destination)
    }
    convertedPaths.set(filename, destination)
  }

  const eligibleFiles = [
    ...classified.direct.map((filename) => ({
      filename,
      uploadPath: path.join(sourceDirectory, filename),
    })),
    ...classified.convert.map((filename) => ({
      filename,
      uploadPath: convertedPaths.get(filename)!,
    })),
  ].sort((left, right) => left.filename.localeCompare(right.filename))

  dependencies.onProgress(`Validating ${eligibleFiles.length} local images`)
  const entries: ManifestEntry[] = []
  for (const file of eligibleFiles) {
    await validateImage(file.uploadPath)
    entries.push({
      sourceFilename: file.filename,
      uploadPath: file.uploadPath,
      sha1: await sha1File(file.uploadPath),
      perceptualHashes: [],
      action: 'upload-new-asset',
      reason: 'no-match',
    })
  }

  const manifest: ImportManifest = {
    version: 1,
    target: {projectId: 'yz23zros', dataset: 'production'},
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    sourceDirectory,
    convertedDirectory,
    inventory: {
      totalFiles: filenames.length,
      directImages: classified.direct.length,
      convertedImages: classified.convert.length,
      videos: classified.videos.length,
      unsupported: classified.unsupported.length,
    },
    videos: classified.videos,
    unsupported: classified.unsupported,
    localDuplicates: [],
    entries,
  }

  const temporaryManifestPath = `${manifestPath}.tmp`
  await writeFile(temporaryManifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await rename(temporaryManifestPath, manifestPath)
  return manifest
}
