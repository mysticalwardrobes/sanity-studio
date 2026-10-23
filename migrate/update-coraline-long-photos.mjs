import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Coraline')
const filenames = [
  'Cover.jpg',
  '628027764_2784948401884504_781039062988153809_n.jpg',
  '629428917_2784948395217838_3637341552252392851_n.jpg',
  '631198026_2784948311884513_2232540010842294908_n.jpg',
  '631476412_2784948488551162_2176025902727567479_n.jpg',
  '631481513_2784948305217847_2640689567840519377_n.jpg',
]
const retainedKeys = ['dea28ea06d82', '9f57c0b0da3b'] // Original photos 3 and 4.
const apply = process.argv.includes('--apply')
const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Coraline/Long/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} new Coraline Long photos; retaining original photos 3 and 4`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-coraline')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Coraline') throw new Error('Coraline gown not found')
const oldByKey = new Map((doc.longGownPicture ?? []).map((image) => [image._key, image]))
const retained = retainedKeys.map((key) => oldByKey.get(key))
if (retained.some((image) => !image)) throw new Error('Expected retained Coraline photo is missing')
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
  throw new Error('Coraline gallery verification failed')
}
console.log('Coraline Long gallery has six new photos first, then original photos 3 and 4')
