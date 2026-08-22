import {execFile} from 'node:child_process'
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {promisify} from 'node:util'

import {convertToJpeg} from './images'

const execFileAsync = promisify(execFile)

type QuickLookRenderer = (source: string, outputDirectory: string) => Promise<unknown>

async function renderWithQuickLook(source: string, outputDirectory: string): Promise<void> {
  await execFileAsync('/usr/bin/qlmanage', [
    '-t',
    '-s',
    '2400',
    '-o',
    outputDirectory,
    source,
  ], {maxBuffer: 10 * 1024 * 1024})
}

export async function convertWithQuickLook(
  source: string,
  destination: string,
  renderer: QuickLookRenderer = renderWithQuickLook,
): Promise<void> {
  const workingDirectory = await mkdtemp(path.join(tmpdir(), 'prom-queen-render-'))
  try {
    await renderer(source, workingDirectory)
    const renderedPath = path.join(workingDirectory, `${path.basename(source)}.png`)
    await convertToJpeg(renderedPath, destination)
  } finally {
    await rm(workingDirectory, {recursive: true, force: true})
  }
}

export function sanityThumbnailUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl)
  url.searchParams.set('w', '256')
  url.searchParams.set('h', '256')
  url.searchParams.set('fit', 'max')
  url.searchParams.set('auto', 'format')
  return url.toString()
}

export async function downloadImage(sourceUrl: string): Promise<Buffer> {
  const url = sanityThumbnailUrl(sourceUrl)
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) {
      lastError = error
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 250))
    }
  }

  throw lastError
}
