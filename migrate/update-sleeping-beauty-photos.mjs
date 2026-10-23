import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Sleeping Beauty')
const longNames = ['325435.jpg', 'DSC00309.jpg', 'DSC00318.jpg', 'DSC00322 (2).jpg']
const pixieNames = ['Cover.jpg', 'DSC03589.jpg', 'DSC03591.jpg', 'DSC03592.jpg', 'DSC03593.jpg']
const retainedKeys = ['sleeping-beauty-long-1', 'sleeping-beauty-long-3', 'sleeping-beauty-long-4']
const removedKeys = new Set(['sleeping-beauty-long-2', 'sleeping-beauty-long-5', 'sleeping-beauty-long-6'])
const apply = process.argv.includes('--apply')

async function prepare(folder, names) {
  const files = []
  for (const filename of names) {
    const file = path.join(root, folder, filename)
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
    files.push({
      file,
      filename,
      key: createHash('sha1').update(`Sleeping Beauty/${folder}/${filename}`).digest('hex').slice(0, 12),
      sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
    })
  }
  return files
}
const longFiles = await prepare('Long Version', longNames)
const pixieFiles = await prepare('Pixie', pixieNames)
console.log(`Prepared ${longFiles.length} new Long and ${pixieFiles.length} new Pixie photos for Sleeping Beauty`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('3d91b304-012c-4725-92ff-8fd64056c5b5')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Sleeping Beauty') throw new Error('Sleeping Beauty gown not found')
const oldByKey = new Map((doc.longGownPicture ?? []).map((image) => [image._key, image]))
const retained = retainedKeys.map((key) => oldByKey.get(key))
if (retained.some((image) => !image)) throw new Error('Expected retained Sleeping Beauty Long photo is missing')
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
// No new Long cover was supplied; preserve the existing cover, then group all new photos.
const longGallery = [retained[0], ...newLong, ...retained.slice(1)]
const pixieGallery = newPixie
const ids = (images) => (images ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
if (JSON.stringify(ids(doc.longGownPicture)) !== JSON.stringify(ids(longGallery)) ||
    JSON.stringify(ids(doc.pixiePicture)) !== JSON.stringify(ids(pixieGallery))) {
  await client.patch(doc._id).set({longGownPicture: longGallery, pixiePicture: pixieGallery}).commit()
}
const updated = await client.getDocument(doc._id)
if (JSON.stringify(ids(updated.longGownPicture)) !== JSON.stringify(ids(longGallery)) ||
    JSON.stringify(ids(updated.pixiePicture)) !== JSON.stringify(ids(pixieGallery)) ||
    updated.longGownPicture.some((image) => removedKeys.has(image._key)) ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Sleeping Beauty gallery verification failed')
}
console.log('Sleeping Beauty Long: original cover, four new photos, originals 3 and 4; Pixie: five new photos with Cover first')
