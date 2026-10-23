import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Silvermist')
const filenames = ['Cover.jpg', 'DSC00565.jpg', 'DSC00650 (2).jpg', 'DSC00708.jpg']
const retainedKeys = ['84281b363a88', '9f578fa876b3']
const removedKey = '9e5081f354b3'
const apply = process.argv.includes('--apply')
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Silvermist/Pixie/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Silvermist Pixie photos; removing original photo 3`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-silvermist')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Silvermist') throw new Error('Silvermist gown not found')
const oldByKey = new Map((doc.pixiePicture ?? []).map((image) => [image._key, image]))
const retained = retainedKeys.map((key) => oldByKey.get(key))
if (retained.some((image) => !image)) throw new Error('Expected retained Silvermist photo is missing')
const beforeLong = JSON.stringify(doc.longGownPicture ?? [])
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
if (JSON.stringify(ids(doc.pixiePicture)) !== JSON.stringify(ids(gallery))) {
  await client.patch(doc._id).set({pixiePicture: gallery}).commit()
}
const updated = await client.getDocument(doc._id)
if (JSON.stringify(ids(updated.pixiePicture)) !== JSON.stringify(ids(gallery)) ||
    updated.pixiePicture.some((image) => image._key === removedKey) ||
    JSON.stringify(updated.longGownPicture ?? []) !== beforeLong ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Silvermist gallery verification failed')
}
console.log('Silvermist Pixie gallery has four new photos first, then original photos 1 and 2')
