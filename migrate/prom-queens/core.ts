import path from 'node:path'

export type SourceFile = {
  filename: string
  sha1: string
  perceptualHashes?: string[]
}

export type RemoteAsset = {
  assetId: string
  filename: string | null
  sha1: string | null
  perceptualHashes: string[]
  usedByPromQueen: boolean
}

export type ImportAction =
  | {
      action: 'skip-existing-prom-queen' | 'reuse-existing-asset'
      assetId: string
      reason: 'sha1' | 'perceptual-hash' | 'filename-and-perceptual-hash'
    }
  | {action: 'upload-new-asset'; reason: 'no-match'}

const DIRECT_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])
const CONVERT_IMAGE_EXTENSIONS = new Set(['.heic', '.cr2', '.dng'])
const VIDEO_EXTENSIONS = new Set(['.mov'])

export function normalizeFilename(filename: string): string {
  return path
    .parse(filename)
    .name.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
}

export function classifyFiles(filenames: string[]) {
  const result = {
    direct: [] as string[],
    convert: [] as string[],
    videos: [] as string[],
    unsupported: [] as string[],
  }

  for (const filename of filenames) {
    const extension = path.extname(filename).toLowerCase()
    if (DIRECT_IMAGE_EXTENSIONS.has(extension)) result.direct.push(filename)
    else if (CONVERT_IMAGE_EXTENSIONS.has(extension)) result.convert.push(filename)
    else if (VIDEO_EXTENSIONS.has(extension)) result.videos.push(filename)
    else result.unsupported.push(filename)
  }

  for (const files of Object.values(result)) files.sort((a, b) => a.localeCompare(b))
  return result
}

export function collapseExactDuplicates<T extends Pick<SourceFile, 'filename' | 'sha1'>>(
  files: T[],
) {
  const groups = new Map<string, T[]>()
  for (const file of files) {
    const group = groups.get(file.sha1) ?? []
    group.push(file)
    groups.set(file.sha1, group)
  }

  const unique: T[] = []
  const duplicates: Array<{filename: string; duplicateOf: string}> = []

  for (const group of groups.values()) {
    group.sort((a, b) => a.filename.localeCompare(b.filename))
    const [canonical, ...copies] = group
    unique.push(canonical)
    for (const copy of copies) {
      duplicates.push({filename: copy.filename, duplicateOf: canonical.filename})
    }
  }

  unique.sort((a, b) => a.filename.localeCompare(b.filename))
  duplicates.sort((a, b) => a.filename.localeCompare(b.filename))
  return {unique, duplicates}
}

export function hammingDistance(left: string, right: string): number {
  let difference = BigInt(`0x${left}`) ^ BigInt(`0x${right}`)
  let count = 0
  while (difference > BigInt(0)) {
    count += Number(difference & BigInt(1))
    difference >>= BigInt(1)
  }
  return count
}

function minimumPerceptualDistance(localHashes: string[], remoteHashes: string[]): number {
  let minimum = Number.POSITIVE_INFINITY
  for (const localHash of localHashes) {
    for (const remoteHash of remoteHashes) {
      minimum = Math.min(minimum, hammingDistance(localHash, remoteHash))
    }
  }
  return minimum
}

export function decideImportAction(local: SourceFile, remoteAssets: RemoteAsset[]): ImportAction {
  let bestMatch:
    | {asset: RemoteAsset; reason: Exclude<ImportAction['reason'], 'no-match'>; rank: number}
    | undefined

  for (const asset of remoteAssets) {
    let reason: Exclude<ImportAction['reason'], 'no-match'> | undefined
    let rank = Number.POSITIVE_INFINITY

    if (asset.sha1 && asset.sha1 === local.sha1) {
      reason = 'sha1'
      rank = 0
    } else if (local.perceptualHashes?.length && asset.perceptualHashes.length) {
      const distance = minimumPerceptualDistance(local.perceptualHashes, asset.perceptualHashes)
      const filenamesMatch = asset.filename
        ? normalizeFilename(asset.filename) === normalizeFilename(local.filename)
        : false

      if (distance <= 4) {
        reason = 'perceptual-hash'
        rank = 10 + distance
      } else if (filenamesMatch && distance <= 10) {
        reason = 'filename-and-perceptual-hash'
        rank = 20 + distance
      }
    }

    const isBetterRank = rank < (bestMatch?.rank ?? Number.POSITIVE_INFINITY)
    const winsPromQueenTie =
      rank === bestMatch?.rank && asset.usedByPromQueen && !bestMatch.asset.usedByPromQueen
    if (reason && (isBetterRank || winsPromQueenTie)) {
      bestMatch = {asset, reason, rank}
    }
  }

  if (!bestMatch) return {action: 'upload-new-asset', reason: 'no-match'}

  return {
    action: bestMatch.asset.usedByPromQueen
      ? 'skip-existing-prom-queen'
      : 'reuse-existing-asset',
    assetId: bestMatch.asset.assetId,
    reason: bestMatch.reason,
  }
}

export function nextNumericClientName(values: Array<string | null | undefined>): string {
  const numericValues = values
    .filter((value): value is string => typeof value === 'string' && /^\d+$/.test(value))
    .map(Number)
  return String((numericValues.length ? Math.max(...numericValues) : -1) + 1)
}
