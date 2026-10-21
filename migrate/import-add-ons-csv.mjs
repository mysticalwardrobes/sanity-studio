import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const sourceRoot = path.resolve(process.cwd(), '..')
const csvPath = path.join(sourceRoot, 'WEBSITE UPLOAD DATA - ADD ONS.csv')
const photoRoot = path.join(sourceRoot, 'Rush Website Update', 'ADD ONS', 'New Uploads')
const apply = process.argv.includes('--apply')

const folderOverrides = new Map([
  ['PH 1 w/ scarfs (Pirate Hat)', 'PH 1 w scarfs (Pirate Hat)'],
  ['PH 2 w/ scarfs (Pirate Hat)', 'PH 2 w scarfs (Pirate Hat)'],
  ['Ruffled Collar 1', 'Ruffled Collar'],
  ['3pcs Silver Grey Hair Clip', '3pcs Silver Grey Hair'],
])

function parseCsv(source) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i++
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field')
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...data] = rows
  if (header.join('|') !== 'Name|Type|Metro Manila Rate|Luzon Rate|Outside Luzon Rate|For Sale|Description') {
    throw new Error('Unexpected CSV columns')
  }
  return data.map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV row ${index + 2} has ${values.length} columns`)
    return Object.fromEntries(header.map((key, column) => [key, values[column].trim()]))
  })
}

function category(row) {
  switch (row.Type) {
    case 'Crowns & Headpieces': return 'crown'
    case 'Handmade Headpieces': return 'headpiece'
    case 'Wigs': return 'wig'
    case 'Props': return 'prop'
    case 'Neck Accessories':
      if (row.Name === 'Rose Choker') return 'necklace'
      if (row.Name === 'Ruffled Collar 1') return 'neck collar'
  }
  throw new Error(`Unmapped category for ${row.Name}: ${row.Type}`)
}

function rate(value, name, field) {
  if (!value || value.toUpperCase() === 'N/A') return undefined
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid ${field} for ${name}: ${value}`)
  return number
}

function portableText(text) {
  if (!text) return undefined
  return [{
    _type: 'block', _key: 'csv-description', style: 'normal', markDefs: [],
    children: [{_type: 'span', _key: 'csv-description-text', marks: [], text}],
  }]
}

async function inventory() {
  const rows = parseCsv(await readFile(csvPath, 'utf8'))
  const seen = new Set()
  const items = []
  for (const row of rows) {
    if (seen.has(row.Name.toLowerCase())) throw new Error(`Duplicate CSV name: ${row.Name}`)
    seen.add(row.Name.toLowerCase())
    const type = category(row)
    const group = type === 'wig' ? 'Wigs For Sale' : type === 'prop' ? 'Props' : 'Crowns & Headpieces'
    const folder = path.join(photoRoot, group, folderOverrides.get(row.Name) ?? row.Name)
    const files = (await readdir(folder)).filter((file) => /\.(jpe?g|png|webp)$/i.test(file))
    files.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
    if (!files.length || !/^cover\./i.test(files[0])) throw new Error(`Missing cover photo: ${row.Name}`)
    const images = []
    for (const filename of files) {
      const file = path.join(folder, filename)
      const size = (await stat(file)).size
      if (size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
      const sha1 = createHash('sha1').update(await readFile(file)).digest('hex')
      images.push({file, filename, sha1})
    }
    const fields = {
      name: row.Name,
      type,
      ...(rate(row['Metro Manila Rate'], row.Name, 'Metro Manila Rate') !== undefined && {metroManilaRate: rate(row['Metro Manila Rate'], row.Name, 'Metro Manila Rate')}),
      ...(rate(row['Luzon Rate'], row.Name, 'Luzon Rate') !== undefined && {luzonRate: rate(row['Luzon Rate'], row.Name, 'Luzon Rate')}),
      ...(rate(row['Outside Luzon Rate'], row.Name, 'Outside Luzon Rate') !== undefined && {outsideLuzonRate: rate(row['Outside Luzon Rate'], row.Name, 'Outside Luzon Rate')}),
      ...(rate(row['For Sale'], row.Name, 'For Sale') !== undefined && {forSaleRate: rate(row['For Sale'], row.Name, 'For Sale')}),
      ...(portableText(row.Description) && {description: portableText(row.Description)}),
    }
    items.push({fields, images})
  }
  return items
}

const items = await inventory()
console.log(`Prepared ${items.length} add-ons with ${items.reduce((sum, item) => sum + item.images.length, 0)} photos`)
for (const item of items) console.log(`${item.fields.name}: ${item.fields.type}, ${item.images.length} photos`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const names = items.map((item) => item.fields.name)
const existing = await client.fetch('*[_type == "addOns" && name in $names]{_id,name}', {names}, {perspective: 'raw'})
const byName = new Map()
for (const doc of existing) {
  if (byName.has(doc.name)) throw new Error(`Duplicate Sanity name: ${doc.name}`)
  byName.set(doc.name, doc)
}
const hashes = [...new Set(items.flatMap((item) => item.images.map((image) => image.sha1)))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))

for (const item of items) {
  const pictures = []
  for (const image of item.images) {
    let id = byHash.get(image.sha1)
    if (!id) {
      const asset = await client.assets.upload('image', createReadStream(image.file), {filename: image.filename})
      id = asset._id
      byHash.set(image.sha1, id)
    }
    pictures.push({
      _type: 'image',
      _key: createHash('sha1').update(image.filename).digest('hex').slice(0, 12),
      asset: {_type: 'reference', _ref: id},
    })
  }
  const doc = byName.get(item.fields.name)
  if (doc) {
    await client.patch(doc._id).set({...item.fields, pictures}).commit()
    console.log(`Updated ${item.fields.name}`)
  } else {
    const created = await client.create({_type: 'addOns', ...item.fields, pictures})
    console.log(`Created ${item.fields.name}: ${created._id}`)
  }
}

const imported = await client.fetch('*[_type == "addOns" && name in $names]{name,type,"pictureCount":count(pictures)}', {names})
if (imported.length !== items.length || imported.some((doc) => doc.pictureCount !== items.find((item) => item.fields.name === doc.name)?.images.length)) {
  throw new Error(`Import validation failed: found ${imported.length} of ${items.length} documents`)
}
console.log(`Validated ${imported.length} add-ons and their photo counts`)
