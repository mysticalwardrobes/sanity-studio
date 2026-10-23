import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Eclipse')
const apply = process.argv.includes('--apply')
const documentId = 'gown-temp-eclipse'
const removedKeys = new Set(['bebe2edfd5fd', '66bd562f4eb4', '88e5b1c4432a'])

const filenames = (await readdir(folder)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
filenames.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
const expected = ['Cover.jpg', 'DSC09585.jpg', 'DSC09625.jpg']
if (JSON.stringify(filenames) !== JSON.stringify(expected)) throw new Error(`Unexpected Eclipse photo set: ${filenames.join(', ')}`)
const photos = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  photos.push({
    file,
    filename,
    key: createHash('sha1').update(`Eclipse/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared Eclipse: ${photos.length} new Pixie photos with ${filenames[0]} first`)
console.log(`Removing old Pixie keys: ${[...removedKeys].join(', ')}`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument(documentId)
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Eclipse') throw new Error('Eclipse gown_temp document not found')
const existingPixie = doc.pixiePicture ?? []
const originalLong = JSON.stringify(doc.longGownPicture ?? [])
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
const kept = existingPixie.filter((image) => !removedKeys.has(image._key) && !newAssetIds.has(image.asset?._ref))
const gallery = [added[0], ...kept, ...added.slice(1)]
await client.patch(documentId).set({pixiePicture: gallery}).commit()

const updated = await client.getDocument(documentId)
if (updated.pixiePicture?.length !== gallery.length ||
    updated.pixiePicture[0]?.asset?._ref !== added[0].asset._ref ||
    updated.pixiePicture.some((image) => removedKeys.has(image._key)) ||
    JSON.stringify(updated.longGownPicture ?? []) !== originalLong ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== originalFilipiniana) {
  throw new Error('Eclipse gallery verification failed')
}
console.log(`Updated Eclipse: ${gallery.length} Pixie photos, new cover first; Long and Filipiniana unchanged`)
