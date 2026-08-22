import {createReadStream} from 'node:fs'
import {readFile, writeFile} from 'node:fs/promises'
import path from 'node:path'

import {getCliClient} from 'sanity/cli'

import {applyManifest, summarizeManifest, type ImportManifest} from './importer'
import {prepareImport} from './prepare'
import {convertWithQuickLook} from './runtime'

const PROJECT_ID = 'yz23zros'
const DATASET = 'production'
const API_VERSION = '2025-02-19'
const sourceDirectory = path.resolve(
  process.cwd(),
  '..',
  'Additional Photos',
  'Featured Clients',
  'Prom Queens',
)
const convertedDirectory = path.join(sourceDirectory, 'converted')
const manifestPath = path.join(convertedDirectory, 'import-manifest.json')
const resultPath = path.join(convertedDirectory, 'import-result.json')

const client = getCliClient({apiVersion: API_VERSION})

async function runPreparation() {
  const manifest = await prepareImport({
    sourceDirectory,
    convertedDirectory,
    manifestPath,
    dependencies: {
      convertFile: convertWithQuickLook,
      onProgress: (message) => console.log(message),
    },
  })

  console.log('\nPreparation complete. No Sanity mutations were made.')
  console.log(JSON.stringify(summarizeManifest(manifest), null, 2))
  console.log(`Manifest: ${manifestPath}`)
}

async function runApply() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as ImportManifest
  if (manifest.target.projectId !== PROJECT_ID || manifest.target.dataset !== DATASET) {
    throw new Error(
      `Manifest targets ${manifest.target.projectId}/${manifest.target.dataset}, expected ${PROJECT_ID}/${DATASET}`,
    )
  }

  const result = await applyManifest(manifest, {
    getClientNames: () =>
      client.fetch<Array<string | null>>(`*[_type == "promQueens"].clientName`),
    uploadAsset: async (filePath, filename) => {
      const asset = await client.assets.upload('image', createReadStream(filePath), {filename})
      console.log(`Asset ready: ${filename} -> ${asset._id}`)
      return asset._id
    },
    createPromQueen: async (assetId, clientName) => {
      const document = await client.create({
        _type: 'promQueens',
        clientName,
        picture: {
          _type: 'image',
          asset: {_type: 'reference', _ref: assetId},
        },
      })
      console.log(`Created Prom Queen ${clientName}: ${document._id}`)
      return document._id
    },
  })

  await writeFile(
    resultPath,
    `${JSON.stringify({completedAt: new Date().toISOString(), ...result}, null, 2)}\n`,
  )
  console.log('\nImport complete.')
  console.log(JSON.stringify(result, null, 2))
  console.log(`Result: ${resultPath}`)
}

async function main() {
  if (process.argv.includes('--prepare')) {
    await runPreparation()
  } else if (process.argv.includes('--apply')) {
    await runApply()
  } else {
    throw new Error('Choose --prepare or --apply. The script never writes to Sanity by default.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
