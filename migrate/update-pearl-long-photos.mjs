import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Pearl')
const filenames = [
  'Cover.jpg',
  '835060655_1570485765122009_6257147477370908626_n.jpg',
  '839126331_1570486891788563_5258307649058852844_n.jpg',
  'Screenshot 2026-10-21 094525.png',
  'Screenshot 2026-10-21 094643.png',
  'Screenshot 2026-10-21 094705.png',
]
const retainedKeys = ['c5feb4179bfd', '11a7c7976325'] // Original photos 1 and 4.
const apply = process.argv.includes('--apply')
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Pearl/Long/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Pearl Long photos; retaining original photos 1 and 4`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-pearl')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Pearl') throw new Error('Pearl gown not found')
const oldByKey = new Map((doc.longGownPicture ?? []).map((image) => [image._key, image]))
const retained = retainedKeys.map((key) => oldByKey.get(key))
if (retained.some((image) => !image)) throw new Error('Expected retained Pearl photo is missing')
const beforePixie = JSON.stringify(doc.pixiePicture ?? [])
const beforeFilipiniana = JSON.stringify(doc.filipinianaPicture ?? [])
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
const gallery = [...pictures, ...retained]
const ids = (images) => (images ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
if (JSON.stringify(ids(doc.longGownPicture)) !== JSON.stringify(ids(gallery))) {
  await client.patch(doc._id).set({longGownPicture: gallery}).commit()
}
const updated = await client.getDocument(doc._id)
if (JSON.stringify(ids(updated.longGownPicture)) !== JSON.stringify(ids(gallery)) ||
    JSON.stringify(updated.pixiePicture ?? []) !== beforePixie ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Pearl gallery verification failed')
}
console.log('Pearl Long gallery has six new photos first, then original photos 1 and 4')
