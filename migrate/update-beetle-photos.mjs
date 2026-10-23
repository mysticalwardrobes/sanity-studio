import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Beetle')
const apply = process.argv.includes('--apply')
const documentId = 'gown-temp-beetle'
const removedKeys = new Set(['beetle-long-3', 'beetle-long-5', 'beetle-long-6'])

const filenames = (await readdir(folder)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
filenames.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
const expected = ['Cover.jpg', 'DSC01467.jpg', 'DSC01573.jpg', 'DSC01591.jpg']
if (JSON.stringify(filenames) !== JSON.stringify(expected)) throw new Error(`Unexpected Beetle photo set: ${filenames.join(', ')}`)
const photos = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  photos.push({
    file,
    filename,
    key: createHash('sha1').update(`Beetle/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared Beetle: ${photos.length} new Long photos with ${filenames[0]} first`)
console.log(`Removing old Long keys: ${[...removedKeys].join(', ')}`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument(documentId)
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Beetle') throw new Error('Beetle gown_temp document not found')
const existingLong = doc.longGownPicture ?? []
const originalPixie = JSON.stringify(doc.pixiePicture ?? [])
const originalFilipiniana = JSON.stringify(doc.filipinianaPicture ?? [])
const hashes = [...new Set(photos.map((photo) => photo.sha1))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))

const added = []
for (const photo of photos) {
  let assetId = byHash.get(photo.sha1)
  if (!assetId) {
    const asset = await client.assets.upload('image', createReadStream(photo.file), {filename: photo.filename})
    assetId = asset._id
    byHash.set(photo.sha1, assetId)
  }
  added.push({_type: 'image', _key: photo.key, asset: {_type: 'reference', _ref: assetId}})
}
const newAssetIds = new Set(added.map((image) => image.asset._ref))
const kept = existingLong.filter((image) => !removedKeys.has(image._key) && !newAssetIds.has(image.asset?._ref))
const gallery = [added[0], ...kept, ...added.slice(1)]
await client.patch(documentId).set({longGownPicture: gallery}).commit()

const updated = await client.getDocument(documentId)
if (updated.longGownPicture?.length !== gallery.length ||
    updated.longGownPicture[0]?.asset?._ref !== added[0].asset._ref ||
    updated.longGownPicture.some((image) => removedKeys.has(image._key)) ||
    JSON.stringify(updated.pixiePicture ?? []) !== originalPixie ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== originalFilipiniana) {
  throw new Error('Beetle gallery verification failed')
}
console.log(`Updated Beetle: ${gallery.length} Long photos, new cover first; Pixie and Filipiniana unchanged`)
