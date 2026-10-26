import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..')
const apply = process.argv.includes('--apply')
const targets = [
  {csvName: 'Inner set 1 (Inner top, inner skirt and White ruffled wrist cuffs)', liveName: 'Inner set 1 (Inner top, inner skirt and White ruffled wrist cuffs)', type: 'inner garment', create: true, folder: 'STYLE EXTENSION/New Uploads/Inner set 1 (Inner top, inner skirt and White ruffled wrist cuffs)'},
  {csvName: 'Dalmatian Fur Coat', liveName: 'Dalmatian Fur Coat', type: 'outerwear', create: true, folder: 'STYLE EXTENSION/New Uploads/Dalmatian Fur Coat'},
  {csvName: 'Wings 1', liveName: 'Wings Holographic 1', type: 'wings', folder: 'ADD ONS AND STYLE EXTNSIONS/Wings 1', preserveExistingPrices: true},
  {csvName: 'Wings 2', liveName: 'Wings Holographic 2', type: 'wings', folder: 'STYLE EXTENSION/Photo andor details Updates/Wings 2', preserveExistingPrices: true},
]

function parseCsv(source) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {field += '"'; i++} else quoted = !quoted
    } else if (char === ',' && !quoted) {row.push(field); field = ''}
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(field); if (row.some((value) => value.trim())) rows.push(row)
      row = []; field = ''
    } else field += char
  }
  if (field || row.length) {row.push(field); rows.push(row)}
  return rows.map((cells) => cells.map((value) => value.trim()))
}

function price(value) {
  if (!value || value.toUpperCase() === 'N/A') return undefined
  const number = Number(value.replace(/[₱,\s]/g, ''))
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid CSV price: ${value}`)
  return number
}
const [header, ...rows] = parseCsv(await readFile(path.join(root, 'WEBSITE UPLOAD DATA - ADD ONS ALL.csv'), 'utf8'))
if (header.join('|') !== 'Name|Type|Metro Manila Rate|Luzon Rate|Outside Luzon Rate|For Sale|Description|Pictures') throw new Error('Unexpected CSV columns')
for (const item of targets) {
  const row = rows.find((cells) => cells[0] === item.csvName)
  if (!row) throw new Error(`Missing CSV row: ${item.csvName}`)
  item.values = {
    metroManilaRate: price(row[2]),
    luzonRate: price(row[3]),
    outsideLuzonRate: price(row[4]),
    forSaleRate: price(row[5]),
  }
  if (item.folder) {
    const folder = path.join(root, item.folder)
    const names = (await readdir(folder)).filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
    names.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
    if (!names.length || !/^cover\./i.test(names[0])) throw new Error(`Missing cover: ${item.liveName}`)
    item.images = []
    for (const filename of names) {
      const file = path.join(folder, filename)
      if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
      item.images.push({file, filename,
        sha1: createHash('sha1').update(await readFile(file)).digest('hex'),
        key: createHash('sha1').update(`${item.folder}/${filename}`).digest('hex').slice(0, 12)})
    }
  }
  console.log(`${item.csvName} → ${item.liveName}: ${item.preserveExistingPrices ? 'preserve existing prices' : JSON.stringify(item.values)}, ${item.images?.length ?? 0} new photos`)
}
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const hashes = [...new Set(targets.flatMap((item) => (item.images ?? []).map((image) => image.sha1)))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))
for (const item of targets) {
  const matches = await client.fetch('*[_type == "addOns" && name == $name]{_id,name,type,pictures,description,metroManilaRate,luzonRate,outsideLuzonRate,forSaleRate}', {name: item.liveName}, {perspective: 'published'})
  if (matches.length > 1) throw new Error(`Duplicate add-on name: ${item.liveName}`)
  const doc = matches[0]
  if (item.create) {
    if (doc) {
      if (doc.type !== item.type) throw new Error(`Unexpected type for ${item.liveName}`)
    } else {
      const created = await client.create({_type: 'addOns', name: item.liveName, type: item.type, pictures: [],
        ...Object.fromEntries(Object.entries(item.values).filter(([, value]) => value !== undefined))})
      console.log(`Created ${item.liveName}: ${created._id}`)
    }
  } else if (!doc || doc.type !== item.type || !(doc.pictures ?? []).length) {
    throw new Error(`Expected existing holographic wings with photos: ${item.liveName}`)
  }
  const current = doc ?? await client.fetch('*[_type == "addOns" && name == $name][0]{_id,name,type,pictures,description,metroManilaRate,luzonRate,outsideLuzonRate,forSaleRate}', {name: item.liveName}, {perspective: 'published'})
  const set = {}, unset = []
  for (const [field, value] of Object.entries(item.preserveExistingPrices ? {} : item.values)) {
    if (value === undefined) {
      if (current[field] !== undefined && current[field] !== null) unset.push(field)
    } else if (current[field] !== value) set[field] = value
  }
  let gallery = current.pictures ?? []
  if (item.images) {
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
    const keys = new Set(newPictures.map((picture) => picture._key))
    const ids = new Set(newPictures.map((picture) => picture.asset._ref))
    gallery = [...newPictures, ...gallery.filter((picture) => !keys.has(picture._key) && !ids.has(picture.asset?._ref))]
    const identity = (pictures) => pictures.map((picture) => `${picture._key}:${picture.asset?._ref}`)
    if (JSON.stringify(identity(gallery)) !== JSON.stringify(identity(current.pictures ?? []))) set.pictures = gallery
  }
  if (Object.keys(set).length || unset.length) {
    let patch = client.patch(current._id)
    if (Object.keys(set).length) patch = patch.set(set)
    if (unset.length) patch = patch.unset(unset)
    await patch.commit()
    const changes = Object.keys(set).map((field) => field === 'pictures' ? `pictures (${gallery.length})` : `${field}=${set[field]}`)
    console.log(`Updated ${item.liveName}: ${changes.join(', ')}${unset.length ? `; cleared ${unset.join(', ')}` : ''}`)
  }
  const updated = await client.getDocument(current._id)
  const identity = (pictures) => (pictures ?? []).map((picture) => `${picture._key}:${picture.asset?._ref}`)
  if (updated.name !== item.liveName || updated.type !== item.type ||
      Object.entries(item.preserveExistingPrices ? {} : item.values).some(([field, value]) => (updated[field] ?? undefined) !== value) ||
      JSON.stringify(identity(updated.pictures)) !== JSON.stringify(identity(gallery)) ||
      (!item.create && JSON.stringify(updated.description ?? []) !== JSON.stringify(current.description ?? []))) {
    throw new Error(`Verification failed: ${item.liveName}`)
  }
  console.log(`Verified ${item.liveName}: ${updated.pictures?.length ?? 0} photos`)
}
