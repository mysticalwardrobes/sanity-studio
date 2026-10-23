import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Lucia')
const apply = process.argv.includes('--apply')
const documentId = 'gown-temp-lucia'
const removedKeys = new Set(['2872569ad6c0']) // sofamimir3.png, the marked fifth thumbnail

async function readGallery(folder) {
  const directory = path.join(root, folder)
  const names = (await readdir(directory)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
  names.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
  if (!names.length || !/^cover\./i.test(names[0])) throw new Error(`Missing cover in ${folder}`)
  const files = []
  for (const name of names) {
    const file = path.join(directory, name)
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
    files.push({
      file,
      name,
      key: createHash('sha1').update(`Lucia/${folder}/${name}`).digest('hex').slice(0, 12),
      sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
    })
  }
  return files
}

const longFiles = await readGallery('Long Version')
const pixieFiles = await readGallery('Pixie Version')
console.log(`Prepared Lucia: ${longFiles.length} new Long photos, ${pixieFiles.length} new Pixie photos`)
console.log('Remove existing Long gallery keys:', [...removedKeys].join(', '))
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument(documentId)
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Lucia') throw new Error('Lucia gown_temp document not found')
const existingLong = doc.longGownPicture ?? []

const hashes = [...new Set([...longFiles, ...pixieFiles].map((image) => image.sha1))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))

async function references(files) {
  const result = []
  for (const image of files) {
    let assetId = byHash.get(image.sha1)
    if (!assetId) {
      const asset = await client.assets.upload('image', createReadStream(image.file), {filename: image.name})
      assetId = asset._id
      byHash.set(image.sha1, assetId)
    }
    result.push({_type: 'image', _key: image.key, asset: {_type: 'reference', _ref: assetId}})
  }
  return result
}

const newLong = await references(longFiles)
const newPixie = await references(pixieFiles)
const newAssetIds = new Set(newLong.map((image) => image.asset._ref))
const keptLong = existingLong.filter((image) => !removedKeys.has(image._key) && !newAssetIds.has(image.asset?._ref))
const pixieAssetIds = new Set(newPixie.map((image) => image.asset._ref))
const keptPixie = (doc.pixiePicture ?? []).filter((image) => !pixieAssetIds.has(image.asset?._ref))
const longGallery = [...newLong, ...keptLong]
const pixieGallery = [...newPixie, ...keptPixie]
await client.patch(documentId).set({longGownPicture: longGallery, pixiePicture: pixieGallery}).commit()

const updated = await client.getDocument(documentId)
if (updated.longGownPicture?.length !== longGallery.length || updated.pixiePicture?.length !== pixieGallery.length ||
    updated.longGownPicture[0]?.asset?._ref !== newLong[0].asset._ref ||
    updated.pixiePicture[0]?.asset?._ref !== newPixie[0].asset._ref ||
    updated.longGownPicture.some((image) => removedKeys.has(image._key))) {
  throw new Error('Lucia gallery verification failed')
}
console.log(`Updated Lucia: ${longGallery.length} Long photos, ${pixieGallery.length} Pixie photos; both new covers first`)
