import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..')
const apply = process.argv.includes('--apply')
const updates = [
  {id: 'gown-temp-harlkeith', name: 'Harlkeith', field: 'pixiePicture', folder: 'GOWN RENTALS/Photo andor details Updates/Harlkeith'},
  {id: 'gown-temp-starry-night', name: 'Starry Night', field: 'pixiePicture', folder: 'GOWN RENTALS/Photo andor details Updates/Starry Night'},
  {id: '5x6DLB3nAylxdMwBlqFJTH', name: 'Tangled Midi', field: 'longGownPicture', folder: 'GOWN RENTALS/Photo andor details Updates/Tangled Midi'},
  {id: 'gown-temp-astra', name: 'Astra', field: 'pixiePicture', folder: 'Rush Website Update 3/Astra Pixie', prices: {pixieMetroManilaRate: 4990, pixieLuzonRate: 8990, pixieOutsideLuzonRate: 10990}},
  {id: '76WjQXb3Gkj2ZaCBmspiQA', name: 'Ella', field: 'pixiePicture', folder: 'Rush Website Update 3/Ella Pixie'},
  {id: 'SPXMjxKGMvtNqn35uPA6i1', name: 'Green Pierce', field: 'pixiePicture', folder: 'Rush Website Update 3/Green Pierce', prices: {pixieMetroManilaRate: 5990, pixieLuzonRate: 8990, pixieOutsideLuzonRate: 10990}},
  {id: 'SPXMjxKGMvtNqn35uPA36E', name: 'Red Pierce', field: 'pixiePicture', folder: 'Rush Website Update 3/Red Pierce Pixie'},
  {id: '3d91b304-012c-4725-92ff-8fd64056c5b5', name: 'Sleeping Beauty', prices: {pixieMetroManilaRate: 5990, pixieLuzonRate: 8990, pixieOutsideLuzonRate: 10990}},
]

function csvRows(source) {
  const rows = []
  let row = [], value = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {value += '"'; i++} else quoted = !quoted
    } else if (char === ',' && !quoted) {row.push(value); value = ''}
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(value); if (row.some((cell) => cell.trim())) rows.push(row)
      row = []; value = ''
    } else value += char
  }
  if (value || row.length) {row.push(value); rows.push(row)}
  return rows.slice(1).map((cells) => cells.map((cell) => cell.trim()))
}
const csv = csvRows(await readFile(path.join(root, 'WEBSITE UPLOAD DATA - GOWNS FOR UPDATE.csv'), 'utf8'))
for (const item of updates) {
  if (item.prices) {
    const row = csv.find((cells) => cells[0].toLowerCase() === item.name.toLowerCase())
    if (!row) throw new Error(`Missing CSV row for ${item.name}`)
    const values = [9, 10, 11].map((index) => Number(row[index].replace(/[₱,\s]/g, '')))
    if (JSON.stringify(values) !== JSON.stringify(Object.values(item.prices))) throw new Error(`CSV price mismatch for ${item.name}`)
  }
  if (!item.folder) continue
  const folder = path.join(root, item.folder)
  const filenames = (await readdir(folder)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
  filenames.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
  if (!filenames.length || !/^cover\./i.test(filenames[0])) throw new Error(`Missing cover for ${item.name}`)
  item.images = []
  for (const filename of filenames) {
    const file = path.join(folder, filename)
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
    item.images.push({
      file, filename,
      sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
      key: createHash('sha1').update(`${item.folder}/${filename}`).digest('hex').slice(0, 12),
    })
  }
  console.log(`${item.name}: ${item.images.length} new ${item.field} photos; cover first`)
}
console.log('Validated CSV pixie rates for Astra, Green Pierce, and Sleeping Beauty')
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const hashes = [...new Set(updates.flatMap((item) => (item.images ?? []).map((image) => image.sha1)))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))
for (const item of updates) {
  const doc = await client.getDocument(item.id)
  if (!doc || doc._type !== 'gown_temp' || doc.name !== item.name) throw new Error(`Gown not found: ${item.name}`)
  const set = {...item.prices}
  if (item.field) {
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
    const newKeys = new Set(newPictures.map((image) => image._key))
    set[item.field] = [...newPictures, ...(doc[item.field] ?? []).filter((image) => !newKeys.has(image._key))]
    if (item.field === 'pixiePicture' && !(doc.wardrobeFeatures ?? []).includes('Pixie - Short dresses')) {
      set.wardrobeFeatures = [...(doc.wardrobeFeatures ?? []), 'Pixie - Short dresses']
    }
  }
  const identities = (pictures) => (pictures ?? []).map((image) => `${image._key}:${image.asset?._ref}`)
  const matches = (current, field, value) => field.endsWith('Picture')
    ? JSON.stringify(identities(current[field])) === JSON.stringify(identities(value))
    : JSON.stringify(current[field] ?? null) === JSON.stringify(value)
  const same = Object.entries(set).every(([field, value]) => matches(doc, field, value))
  if (!same) await client.patch(doc._id).set(set).commit()
  const updated = await client.getDocument(doc._id)
  if (Object.entries(set).some(([field, value]) => !matches(updated, field, value))) {
    throw new Error(`Verification failed: ${item.name}`)
  }
  console.log(`Verified ${item.name}: ${item.field ? `${updated[item.field].length} ${item.field} photos` : 'pixie rates'}`)
}
