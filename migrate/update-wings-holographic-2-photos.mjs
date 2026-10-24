import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update 2', 'Wings 2')
const filenames = [
  'Cover (2).jpg',
  '44223432.jpg',
  '858009942_18118939268105719_4954273605348283954_n.jpg',
  '860335584_18118939157105719_9037633865774571226_n.jpg',
  '863014434_18118939421105719_7410703332173129110_n.jpg',
]
const documentId = 'e84768c5-2940-455d-9baa-aa6985fa6563'
const apply = process.argv.includes('--apply')
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Wings 2/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Wings Holographic 2 photos; cover: ${filenames[0]}`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument(documentId)
if (!doc || doc._type !== 'addOns' || doc.name !== 'Wings Holographic 2') throw new Error('Wings Holographic 2 not found')
const hashes = [...new Set(files.map((image) => image.sha1))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))
const pictures = []
for (const image of files) {
  let assetId = byHash.get(image.sha1)
  if (!assetId) {
    const asset = await client.assets.upload('image', createReadStream(image.file), {filename: image.filename})
    assetId = asset._id
    byHash.set(image.sha1, assetId)
  }
  pictures.push({_type: 'image', _key: image.key, asset: {_type: 'reference', _ref: assetId}})
}
const newKeys = new Set(pictures.map((image) => image._key))
const newAssets = new Set(pictures.map((image) => image.asset._ref))
const retained = (doc.pictures ?? []).filter((image) => !newKeys.has(image._key) && !newAssets.has(image.asset?._ref))
const gallery = [...pictures, ...retained]
const ids = (images) => (images ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
if (JSON.stringify(ids(doc.pictures)) !== JSON.stringify(ids(gallery))) {
  await client.patch(documentId).set({pictures: gallery}).commit()
}
const updated = await client.getDocument(documentId)
if (JSON.stringify(ids(updated.pictures)) !== JSON.stringify(ids(gallery))) {
  throw new Error('Wings Holographic 2 photo verification failed')
}
console.log(`Wings Holographic 2 has ${pictures.length} new photos first, then ${retained.length} existing photos`)
