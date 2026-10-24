import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..')
const longFolder = path.join(root, 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Nimfa', 'Long')
const pixieFolder = path.join(root, 'Rush Website Update 2', 'Nimfa')
const longNames = ['Cover.jpg', 'DSC03501.jpg', 'DSC03504.jpg', 'DSC03505.jpg', 'IMG_7766.JPG', 'IMG_7768.JPG']
const pixieNames = [
  'Cover.jpg', '6367838.jpg',
  '858009942_18118939268105719_4954273605348283954_n.jpg',
  '858981956_18118939346105719_3564507570228575161_n.jpg',
  '860335584_18118939157105719_9037633865774571226_n.jpg',
  'DSC00446.jpg',
]
const longRetainedKeys = ['e380f90aa1d9', '99f4a0505413'] // Original Long photos 1 and 3.
const pixieRetainedKey = 'nimfa-pixie-2'
const apply = process.argv.includes('--apply')

async function prepare(folder, names, keyPrefix) {
  const files = []
  for (const filename of names) {
    const file = path.join(folder, filename)
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
    files.push({
      file,
      filename,
      key: createHash('sha1').update(`${keyPrefix}/${filename}`).digest('hex').slice(0, 12),
      sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
    })
  }
  return files
}
const longFiles = await prepare(longFolder, longNames, 'Nimfa/Long')
const pixieFiles = await prepare(pixieFolder, pixieNames, 'Nimfa/Pixie')
console.log(`Prepared Nimfa: ${longFiles.length} new Long photos from Rush Website Update, ${pixieFiles.length} new Pixie photos from Rush Website Update 2`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-nimfa')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Nimfa') throw new Error('Nimfa gown not found')
const oldLongByKey = new Map((doc.longGownPicture ?? []).map((image) => [image._key, image]))
const retainedLong = longRetainedKeys.map((key) => oldLongByKey.get(key))
const retainedPixie = (doc.pixiePicture ?? []).find((image) => image._key === pixieRetainedKey)
if (retainedLong.some((image) => !image) || !retainedPixie) throw new Error('Expected retained Nimfa photo is missing')
const beforeFilipiniana = JSON.stringify(doc.filipinianaPicture ?? [])
const hashes = [...new Set([...longFiles, ...pixieFiles].map((image) => image.sha1))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))
async function references(files) {
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
  return pictures
}
const newLong = await references(longFiles)
const newPixie = await references(pixieFiles)
const longGallery = [...newLong, ...retainedLong]
const pixieGallery = [...newPixie, retainedPixie]
const ids = (images) => (images ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
if (JSON.stringify(ids(doc.longGownPicture)) !== JSON.stringify(ids(longGallery)) ||
    JSON.stringify(ids(doc.pixiePicture)) !== JSON.stringify(ids(pixieGallery))) {
  await client.patch(doc._id).set({longGownPicture: longGallery, pixiePicture: pixieGallery}).commit()
}
const updated = await client.getDocument(doc._id)
if (JSON.stringify(ids(updated.longGownPicture)) !== JSON.stringify(ids(longGallery)) ||
    JSON.stringify(ids(updated.pixiePicture)) !== JSON.stringify(ids(pixieGallery)) ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Nimfa gallery verification failed')
}
console.log('Nimfa galleries updated: six new photos first in each; Long originals 1 and 3, Pixie original 2 retained')
