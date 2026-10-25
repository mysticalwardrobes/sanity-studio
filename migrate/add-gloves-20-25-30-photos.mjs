import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..', 'Rush Website Update', 'ADD ONS', 'Photo and or details Updates')
const apply = process.argv.includes('--apply')
const items = [
  {id: '1FTLKHSFqfOcEG1Mv0cyKx', name: 'Gloves 20', files: ['Cover.jpg', 'DSC09890.jpg', 'DSC09894.jpg']},
  {id: '6iE3Ntktb8OLsYiilBdUB3', name: 'Gloves 25', files: ['Cover.jpg', 'DSC00947.jpg', 'DSC01063.jpg']},
  {id: '2D0hJwJcuK0ylc3Uw39BEu', name: 'Gloves 30', files: ['Cover.jpg', 'DSC01624.jpg']},
]
for (const item of items) {
  item.images = []
  for (const filename of item.files) {
    const file = path.join(root, item.name, filename)
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
    item.images.push({
      file, filename,
      sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
      key: createHash('sha1').update(`${item.name}/${filename}`).digest('hex').slice(0, 12),
    })
  }
  console.log(`${item.name}: ${item.images.length} new photos, cover first`)
}
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const hashes = [...new Set(items.flatMap((item) => item.images.map((image) => image.sha1)))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))
for (const item of items) {
  const doc = await client.getDocument(item.id)
  if (!doc || doc._type !== 'addOns' || doc.name !== item.name) throw new Error(`Add-on not found: ${item.name}`)
  const newPictures = []
  for (const image of item.images) {
    let assetId = byHash.get(image.sha1)
    if (!assetId) {
      const asset = await client.assets.upload('image', createReadStream(image.file), {filename: image.filename})
      assetId = asset._id
      byHash.set(image.sha1, assetId)
    }
    newPictures.push({_type: 'image', _key: image.key, asset: {_type: 'reference', _ref: assetId}})
  }
  const keys = new Set(newPictures.map((image) => image._key))
  const gallery = [...newPictures, ...(doc.pictures ?? []).filter((image) => !keys.has(image._key))]
  const identities = (pictures) => (pictures ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
  if (JSON.stringify(identities(gallery)) !== JSON.stringify(identities(doc.pictures))) {
    await client.patch(doc._id).set({pictures: gallery}).commit()
  }
  const updated = await client.getDocument(doc._id)
  if (JSON.stringify(identities(updated.pictures)) !== JSON.stringify(identities(gallery))) {
    throw new Error(`Photo verification failed: ${item.name}`)
  }
  console.log(`Verified ${item.name}: ${gallery.length} total photos, original photos retained`)
}
