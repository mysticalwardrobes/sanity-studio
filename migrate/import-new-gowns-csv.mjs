import {createReadStream} from 'node:fs'
import {readFile, readdir, stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const sourceRoot = path.resolve(process.cwd(), '..')
const csvPath = path.join(sourceRoot, 'WEBSITE UPLOAD DATA - NEW GOWNS.csv')
const photoRoot = path.join(sourceRoot, 'Rush Website Update', 'GOWN RENTALS', 'New Uploads')
const apply = process.argv.includes('--apply')

const photoAssignments = new Map([
  ['Swann', [
    {folder: 'Swann', field: 'longGownPicture'},
    {folder: 'Swann/Additional Photos for Janine', field: 'longGownPicture'},
  ]],
  ['Snow White', [
    {folder: 'Snow White/Long', field: 'longGownPicture'},
    {folder: 'Snow White/Additional Photos for Janine', field: 'longGownPicture'},
    {folder: 'Snow White/Pixie', field: 'pixiePicture'},
    {folder: 'Snow White/Pixie/Additional Photos for Janine', field: 'pixiePicture'},
  ]],
  ['Nerissa', [
    {folder: 'Nerissa/Long Version', field: 'longGownPicture'},
    {folder: 'Nerissa/Pixie Version', field: 'pixiePicture'},
  ]],
])

const managedFields = [
  'upcomingDesign', 'gownStatus', 'gownFeatures', 'wardrobeFeatures', 'bestFor', 'tags', 'color',
  'corsetCount', 'ageGroup', 'petticoats', 'metroManilaRate', 'luzonRate', 'outsideLuzonRate',
  'metroManilaRateDiscount', 'luzonRateDiscount', 'outsideLuzonRateDiscount', 'pixieMetroManilaRate',
  'pixieLuzonRate', 'pixieOutsideLuzonRate', 'pixieMetroManilaRateDiscount', 'pixieLuzonRateDiscount',
  'pixieOutsideLuzonRateDiscount', 'forSaleRateLong', 'forSaleRatePixie', 'bustMin', 'bustMax',
  'waistMin', 'waistMax', 'length', 'petticoatFitCode', 'waistMaxPixie', 'lengthPixie',
]

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
    if (row.some((value) => value.trim())) rows.push(row)
  }
  const [header, ...data] = rows
  if (header.length !== 40 || header[0].trim() !== 'Name' || header[2].trim() !== 'Metro Manila Rate') {
    throw new Error(`Unexpected CSV columns: expected 40 columns, received ${header.length}`)
  }
  return data.map((values, index) => {
    if (values.length !== header.length) throw new Error(`CSV row ${index + 2} has ${values.length} columns`)
    return values.map((value) => value.trim())
  })
}

function parseRate(value, name, field) {
  if (!value || value.toUpperCase() === 'N/A') return undefined
  const normalized = value.replace(/[₱,\s]/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Invalid ${field} for ${name}: ${value}`)
  const number = Number(normalized)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid ${field} for ${name}: ${value}`)
  return number
}

function list(value) {
  return value ? value.split(',').map((part) => part.trim()).filter(Boolean) : undefined
}

function slugify(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function mapFields(row) {
  const name = row[0].trim()
  const fields = {name, slug: {_type: 'slug', current: slugify(name)}}
  const rates = [
    [2, 'metroManilaRate'], [3, 'luzonRate'], [4, 'outsideLuzonRate'],
    [5, 'metroManilaRateDiscount'], [6, 'luzonRateDiscount'], [7, 'outsideLuzonRateDiscount'],
    [9, 'pixieMetroManilaRate'], [10, 'pixieLuzonRate'], [11, 'pixieOutsideLuzonRate'],
    [12, 'pixieMetroManilaRateDiscount'], [13, 'pixieLuzonRateDiscount'], [14, 'pixieOutsideLuzonRateDiscount'],
    [16, 'forSaleRateLong'], [17, 'forSaleRatePixie'], [28, 'bustMin'], [30, 'waistMin'],
  ]
  for (const [index, field] of rates) {
    const value = parseRate(row[index], name, field)
    if (value !== undefined) fields[field] = value
  }
  const strings = [
    [19, 'gownFeatures'], [24, 'corsetCount'], [29, 'bustMax'],
    [31, 'waistMax'], [32, 'length'], [33, 'petticoatFitCode'], [34, 'waistMaxPixie'],
    [35, 'lengthPixie'], [38, 'gownStatus'], [39, 'upcomingDesign'],
  ]
  for (const [index, field] of strings) if (row[index]) fields[field] = row[index]
  for (const [index, field] of [[20, 'wardrobeFeatures'], [21, 'bestFor'], [22, 'tags'], [23, 'color'], [26, 'ageGroup'], [27, 'petticoats']]) {
    const value = list(row[index])
    if (value) fields[field] = value
  }
  // Column 1 is a blank spacer; Upcoming Design & Evolution is column 39.
  if (!row[39]) delete fields.upcomingDesign
  return fields
}

function defaultPhotoField(row) {
  const hasLongPrice = [2, 3, 4, 16].some((index) => Boolean(row[index]))
  const hasPixiePrice = [9, 10, 11, 17].some((index) => Boolean(row[index]))
  if (hasLongPrice && !hasPixiePrice) return 'longGownPicture'
  if (hasPixiePrice && !hasLongPrice) return 'pixiePicture'
  // A root-only set with both variants priced is treated as Long; Red Pierce
  // is explicitly in this case. Named variant folders override this default.
  return 'longGownPicture'
}

async function imagesIn(folder) {
  const fullPath = path.join(photoRoot, folder)
  const files = (await readdir(fullPath)).filter((file) => /\.(jpe?g|png|webp|heic)$/i.test(file))
  files.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
  if (!files.length) throw new Error(`No photos found in ${folder}`)
  const results = []
  for (const filename of files) {
    const file = path.join(fullPath, filename)
    if ((await stat(file)).size > 50 * 1024 * 1024) throw new Error(`Image exceeds 50 MiB: ${file}`)
    const buffer = await readFile(file)
    results.push({file, filename, relativePath: path.relative(photoRoot, file), sha1: createHash('sha1').update(buffer).digest('hex')})
  }
  return results
}

async function inventory() {
  const rows = parseCsv(await readFile(csvPath, 'utf8'))
  const seen = new Set()
  const items = []
  for (const row of rows) {
    const name = row[0].trim()
    if (!name || seen.has(name.toLowerCase())) throw new Error(`Empty or duplicate gown name: ${name}`)
    seen.add(name.toLowerCase())
    const fields = mapFields(row)
    const assignments = photoAssignments.get(name) ?? [{folder: name, field: defaultPhotoField(row)}]
    const galleries = {longGownPicture: [], pixiePicture: []}
    for (const assignment of assignments) galleries[assignment.field].push(...await imagesIn(assignment.folder))
    if (!galleries.longGownPicture.length && !galleries.pixiePicture.length) throw new Error(`No assigned photos for ${name}`)
    items.push({name, fields, galleries})
  }
  return items
}

const items = await inventory()
const photoCount = items.reduce((sum, item) => sum + item.galleries.longGownPicture.length + item.galleries.pixiePicture.length, 0)
console.log(`Prepared ${items.length} gowns with ${photoCount} photos`)
for (const item of items) console.log(`${item.name}: long ${item.galleries.longGownPicture.length}, pixie ${item.galleries.pixiePicture.length}`)
if (!apply) process.exit(0)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const names = items.map((item) => item.name)
const existing = await client.fetch('*[_type == "gown_temp"]{_id,name,"slug":slug.current}', {}, {perspective: 'published'})
const desiredSlugs = new Set(items.map((item) => slugify(item.name)))
const byName = new Map()
for (const doc of existing) {
  const normalized = doc.name.trim().toLowerCase()
  if (!names.some((name) => name.toLowerCase() === normalized) && !desiredSlugs.has(doc.slug)) continue
  if (byName.has(normalized)) throw new Error(`Duplicate existing gown_temp name: ${doc.name}`)
  byName.set(normalized, doc)
}

const hashes = [...new Set(items.flatMap((item) => [...item.galleries.longGownPicture, ...item.galleries.pixiePicture].map((image) => image.sha1)))]
const assets = await client.fetch('*[_type == "sanity.imageAsset" && sha1hash in $hashes]{_id,sha1hash}', {hashes})
const byHash = new Map(assets.map((asset) => [asset.sha1hash, asset._id]))

for (const item of items) {
  const patch = {...item.fields}
  for (const field of ['longGownPicture', 'pixiePicture']) {
    const references = []
    for (const image of item.galleries[field]) {
      let assetId = byHash.get(image.sha1)
      if (!assetId) {
        const asset = await client.assets.upload('image', createReadStream(image.file), {filename: image.filename})
        assetId = asset._id
        byHash.set(image.sha1, assetId)
      }
      references.push({
        _type: 'image',
        _key: createHash('sha1').update(image.relativePath).digest('hex').slice(0, 12),
        asset: {_type: 'reference', _ref: assetId},
      })
    }
    if (references.length) patch[field] = references
  }
  const unset = managedFields.filter((field) => !(field in item.fields))
  for (const field of ['longGownPicture', 'pixiePicture']) if (!patch[field]) unset.push(field)
  const current = byName.get(item.name.toLowerCase())
  if (current) {
    await client.patch(current._id).set(patch).unset(unset).commit()
    console.log(`Updated ${item.name}: ${current._id}`)
  } else {
    const created = await client.create({_type: 'gown_temp', ...patch})
    console.log(`Created ${item.name}: ${created._id}`)
  }
}

const imported = await client.fetch('*[_type == "gown_temp" && name in $names]{_id,name,"longPhotos":count(longGownPicture),"pixiePhotos":count(pixiePicture)}', {names}, {perspective: 'published'})
if (imported.length !== items.length) throw new Error(`Validation failed: found ${imported.length} of ${items.length} gown_temp documents`)
for (const doc of imported) {
  const item = items.find((candidate) => candidate.name === doc.name.trim())
  if (!item || (doc.longPhotos ?? 0) !== item.galleries.longGownPicture.length || (doc.pixiePhotos ?? 0) !== item.galleries.pixiePicture.length) {
    throw new Error(`Photo validation failed for ${doc.name}`)
  }
}
console.log(`Validated ${imported.length} gowns and all ${photoCount} photo assignments`)
