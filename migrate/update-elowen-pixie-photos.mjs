import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Elowen')
const apply = process.argv.includes('--apply')
// Recovered from Sanity document history before the October 23 photo edit.
const retained = [
  {_type: 'image', _key: 'elowen-pixie-1', asset: {_type: 'reference', _ref: 'image-1d3daf9b16917f547688152406110e8f9e88634a-3930x5895-jpg'}},
  {_type: 'image', _key: 'elowen-pixie-5', asset: {_type: 'reference', _ref: 'image-33af1b5361d504826538a2946daea801e7d5a052-4000x6000-jpg'}},
]
const removedKeys = new Set(['elowen-pixie-2', 'elowen-pixie-3', 'elowen-pixie-4', 'elowen-pixie-6'])
const filenames = (await readdir(folder)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
filenames.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
const expected = ['Cover.jpg', 'DSC00544.jpg', 'DSC00554.jpg', 'DSC00650.jpg']
if (JSON.stringify(filenames) !== JSON.stringify(expected)) throw new Error(`Unexpected Elowen photo set: ${filenames.join(', ')}`)
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Elowen/Pixie/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Elowen Pixie photos; retaining originals 1 and 5; cover: ${filenames[0]}`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-elowen')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Elowen') throw new Error('Elowen gown_temp document not found')
const originalLong = JSON.stringify(doc.longGownPicture ?? [])
const originalFilipiniana = JSON.stringify(doc.filipinianaPicture ?? [])
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
const gallery = [pictures[0], ...retained, ...pictures.slice(1)]
await client.patch(doc._id).set({pixiePicture: gallery}).commit()
const updated = await client.getDocument(doc._id)
if (updated.pixiePicture?.length !== gallery.length ||
    updated.pixiePicture.some((image, index) => image.asset?._ref !== gallery[index].asset._ref) ||
    updated.pixiePicture.some((image) => removedKeys.has(image._key)) ||
    JSON.stringify(updated.longGownPicture ?? []) !== originalLong ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== originalFilipiniana) {
  throw new Error('Elowen gallery verification failed')
}
console.log(`Updated Elowen Pixie gallery with ${pictures.length} new photos plus originals 1 and 5; Long and Filipiniana unchanged`)
