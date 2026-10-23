import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Drama')
const filenames = ['Cover.jpg', 'PBE_7503-EditBW.jpg', 'PBE_7588BW.jpg', 'PBE_7630-EditBW.jpg']
const firstOriginal = {_type: 'image', _key: 'c77c3fdd57d2', asset: {_type: 'reference', _ref: 'image-c77c3fdd57d271d5bc2bf4a8f37f0afeca7dd5e5-3691x5536-jpg'}}
const apply = process.argv.includes('--apply')
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Drama/Long/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Drama Long photos; retaining only original photo 1`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-drama')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Drama') throw new Error('Drama gown not found')
if (!doc.longGownPicture?.some((image) => image._key === firstOriginal._key && image.asset?._ref === firstOriginal.asset._ref)) {
  throw new Error('Expected original Drama photo 1 is missing')
}
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
const gallery = [...pictures, firstOriginal]
const ids = (images) => (images ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
if (JSON.stringify(ids(doc.longGownPicture)) !== JSON.stringify(ids(gallery))) {
  await client.patch(doc._id).set({longGownPicture: gallery}).commit()
}
const updated = await client.getDocument(doc._id)
if (JSON.stringify(ids(updated.longGownPicture)) !== JSON.stringify(ids(gallery)) ||
    JSON.stringify(updated.pixiePicture ?? []) !== beforePixie ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Drama gallery verification failed')
}
console.log('Drama Long gallery has four new photos first, then original photo 1')
