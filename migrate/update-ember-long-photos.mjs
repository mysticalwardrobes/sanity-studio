import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Ember')
const filenames = ['Cover.jpg', 'DSC02637.jpg', 'DSC02641.jpg', 'DSC02661.jpg', 'DSC02672.jpg']
const apply = process.argv.includes('--apply')
const oldFirst = {_type: 'image', _key: 'ember-long-1', asset: {_type: 'reference', _ref: 'image-6925d03615e29f898f03f57cac9b77ec1c5d2866-4000x6000-jpg'}}
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Ember/Long/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Ember Long Gown photos; retaining only original 1`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-ember')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Ember') throw new Error('Ember gown not found')
if (!doc.longGownPicture?.some((image) => image._key === oldFirst._key && image.asset?._ref === oldFirst.asset._ref)) {
  throw new Error('Expected original Ember photo is missing')
}
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
const gallery = [...pictures, oldFirst]
const ids = (images) => (images ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
if (JSON.stringify(ids(doc.longGownPicture)) !== JSON.stringify(ids(gallery))) {
  await client.patch(doc._id).set({longGownPicture: gallery}).commit()
}
const updated = await client.getDocument(doc._id)
if (JSON.stringify(ids(updated.longGownPicture)) !== JSON.stringify(ids(gallery)) ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Ember gallery verification failed')
}
console.log('Ember Long Gown gallery now has five new photos followed by original photo 1; Filipiniana unchanged')
