import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Scarlet Nova')
const filenames = ['Cover.jpg', 'DSC00040.jpg', 'DSC00104.jpg', 'DSC00113.jpg', 'DSC00147.jpg', 'DSC00167.jpg']
const apply = process.argv.includes('--apply')
const firstOriginal = {_type: 'image', _key: 'scarlet-nova-pixie-1', asset: {_type: 'reference', _ref: 'image-50c391c34735c730692b97751441575a101e9fe2-3889x5834-jpg'}}
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Scarlet Nova/Pixie/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Scarlet Nova Pixie photos; retaining only original photo 1`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-scarlet-nova')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Scarlet Nova') throw new Error('Scarlet Nova gown not found')
if (!doc.pixiePicture?.some((image) => image._key === firstOriginal._key && image.asset?._ref === firstOriginal.asset._ref)) {
  throw new Error('Expected original Scarlet Nova photo 1 is missing')
}
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
const gallery = [...pictures, firstOriginal]
const ids = (images) => (images ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
if (JSON.stringify(ids(doc.pixiePicture)) !== JSON.stringify(ids(gallery))) {
  await client.patch(doc._id).set({pixiePicture: gallery}).commit()
}
const updated = await client.getDocument(doc._id)
if (JSON.stringify(ids(updated.pixiePicture)) !== JSON.stringify(ids(gallery)) ||
    JSON.stringify(updated.longGownPicture ?? []) !== beforeLong ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Scarlet Nova gallery verification failed')
}
console.log('Scarlet Nova Pixie gallery has six new photos followed by original photo 1; Long and Filipiniana unchanged')
