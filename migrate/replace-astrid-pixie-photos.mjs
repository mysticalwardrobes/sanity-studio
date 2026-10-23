import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const folder = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates', 'Astrid', 'Pixie Version')
const apply = process.argv.includes('--apply')
const filenames = (await readdir(folder)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
filenames.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
if (!filenames.length || !/^cover\./i.test(filenames[0])) throw new Error('Astrid Pixie cover is missing')
const expectedNames = new Set(['Cover.jpg', 'DSC03614.jpg', 'DSC03617.jpg', 'DSC03622.jpg', 'DSC03623.jpg'])
for (const filename of filenames) if (!expectedNames.has(filename)) throw new Error(`Unexpected Astrid Pixie photo: ${filename}`)
const missing = [...expectedNames].filter((name) => !filenames.includes(name))
if (missing.some((name) => name !== 'DSC03622.jpg')) throw new Error(`Missing expected photo: ${missing.join(', ')}`)

const files = []
for (const filename of filenames) {
  const file = path.join(folder, filename)
  if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
  files.push({
    file,
    filename,
    key: createHash('sha1').update(`Astrid/Pixie Version/${filename}`).digest('hex').slice(0, 12),
    sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
  })
}
console.log(`Prepared ${files.length} Astrid Pixie photos; cover: ${filenames[0]}`)
if (missing.length) console.log(`Still needed from the pictured set: ${missing.join(', ')}`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-astrid')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Astrid') throw new Error('Astrid gown_temp document not found')
const originalLong = (doc.longGownPicture ?? []).map((image) => image.asset?._ref)
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
await client.patch(doc._id).set({pixiePicture: pictures}).commit()
const updated = await client.getDocument(doc._id)
if (updated.pixiePicture?.length !== pictures.length ||
    updated.pixiePicture.some((image, index) => image.asset?._ref !== pictures[index].asset._ref) ||
    JSON.stringify((updated.longGownPicture ?? []).map((image) => image.asset?._ref)) !== JSON.stringify(originalLong)) {
  throw new Error('Astrid gallery verification failed')
}
console.log(`Replaced Astrid Pixie gallery with ${pictures.length} new photos; Long gallery unchanged`)
