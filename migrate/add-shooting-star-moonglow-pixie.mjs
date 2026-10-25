import {createReadStream} from 'node:fs'
import {readFile, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates')
const apply = process.argv.includes('--apply')
const gowns = [
  {id: 'gown-temp-shooting-star', name: 'Shooting star', folder: 'Shooting Star', files: [
    'Cover.jpg', 'DSC03549.jpg', 'DSC03550.jpg', 'DSC03552.jpg',
  ]},
  {id: 'gown-temp-moonglow', name: 'Moonglow', folder: 'Moonglow', files: [
    'Cover.jpg', 'DSC03518.jpg', 'DSC03524.jpg', 'DSC03527.jpg', 'DSC03532.jpg', 'DSC03534.jpg',
    'Additional Photos/DSC03523.jpg', 'Additional Photos/DSC03525.jpg',
  ]},
]

for (const gown of gowns) {
  gown.images = []
  for (const filename of gown.files) {
    const file = path.join(root, gown.folder, filename)
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
    const bytes = await readFile(file)
    gown.images.push({
      file, filename,
      sha1: createHash('sha1').update(bytes).digest('hex'),
      key: createHash('sha1').update(`${gown.folder}/Pixie/${filename}`).digest('hex').slice(0, 12),
    })
  }
  console.log(`${gown.name}: ${gown.images.length} pixie photos, cover first`)
}
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const hashes = [...new Set(gowns.flatMap((gown) => gown.images.map((image) => image.sha1)))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))

for (const gown of gowns) {
  const doc = await client.getDocument(gown.id)
  if (!doc || doc._type !== 'gown_temp' || doc.name !== gown.name) throw new Error(`Gown not found: ${gown.name}`)
  if ((doc.pixiePicture ?? []).length) throw new Error(`Pixie gallery already exists for ${gown.name}; inspect before changing it`)
  const gallery = []
  for (const image of gown.images) {
    let assetId = byHash.get(image.sha1)
    if (!assetId) {
      const asset = await client.assets.upload('image', createReadStream(image.file), {filename: path.basename(image.filename)})
      assetId = asset._id
      byHash.set(image.sha1, assetId)
    }
    gallery.push({_type: 'image', _key: image.key, asset: {_type: 'reference', _ref: assetId}})
  }
  await client.patch(doc._id).set({pixiePicture: gallery}).commit()
  const updated = await client.getDocument(doc._id)
  if (updated.pixiePicture?.length !== gallery.length ||
      updated.pixiePicture.some((image, index) => image.asset?._ref !== gallery[index].asset._ref) ||
      JSON.stringify(updated.longGownPicture ?? []) !== JSON.stringify(doc.longGownPicture ?? [])) {
    throw new Error(`Photo verification failed: ${gown.name}`)
  }
  console.log(`Updated ${gown.name}: ${gallery.length} pixie photos`)
}
