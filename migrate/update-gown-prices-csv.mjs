import {readFile} from 'node:fs/promises'
import path from 'node:path'

const csvPath = path.resolve(process.cwd(), '..', 'WEBSITE UPLOAD DATA - GOWNS FOR UPDATE.csv')
const apply = process.argv.includes('--apply')

const priceColumns = [
  [2, 'metroManilaRate'], [3, 'luzonRate'], [4, 'outsideLuzonRate'],
  [5, 'metroManilaRateDiscount'], [6, 'luzonRateDiscount'], [7, 'outsideLuzonRateDiscount'],
  [9, 'pixieMetroManilaRate'], [10, 'pixieLuzonRate'], [11, 'pixieOutsideLuzonRate'],
  [12, 'pixieMetroManilaRateDiscount'], [13, 'pixieLuzonRateDiscount'], [14, 'pixieOutsideLuzonRateDiscount'],
  [16, 'forSaleRateLong'], [17, 'forSaleRatePixie'],
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
  const [headers, ...data] = rows
  if (headers?.length !== 40 || headers[0] !== 'Name' || headers[2] !== 'Metro Manila Rate' ||
      headers[9] !== 'Pixie Metro Manila Rate' || headers[16] !== 'For Sale Rate Long' ||
      headers[17] !== 'For Sale Rate Pixie') throw new Error('Unexpected gown update CSV headers')
  return data.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2} has ${values.length} columns`)
    return values.map((value) => value.trim())
  })
}

function price(value, name, field) {
  if (!value || value.toUpperCase() === 'N/A') return undefined
  const normalized = value.replace(/[₱,\s]/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Invalid ${field} for ${name}: ${value}`)
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${field} for ${name}: ${value}`)
  return parsed
}

const rows = parseCsv(await readFile(csvPath, 'utf8'))
const updates = rows.map((row) => {
  const name = row[0]
  if (!name) throw new Error('CSV row has no gown name')
  const values = {}
  for (const [index, field] of priceColumns) values[field] = price(row[index], name, field)
  return {name, values}
})
if (new Set(updates.map((item) => item.name.toLowerCase())).size !== updates.length) throw new Error('Duplicate gown name in CSV')
console.log(`Prepared prices for ${updates.length} existing gowns`)
if (!apply) {
  for (const item of updates) console.log(`${item.name}: ${JSON.stringify(item.values)}`)
  process.exit(0)
}

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const names = updates.map((item) => item.name)
const current = await client.fetch('*[_type == "gown_temp" && name in $names]{_id,name,metroManilaRate,luzonRate,outsideLuzonRate,metroManilaRateDiscount,luzonRateDiscount,outsideLuzonRateDiscount,pixieMetroManilaRate,pixieLuzonRate,pixieOutsideLuzonRate,pixieMetroManilaRateDiscount,pixieLuzonRateDiscount,pixieOutsideLuzonRateDiscount,forSaleRateLong,forSaleRatePixie}', {names}, {perspective: 'published'})
if (current.length !== updates.length) throw new Error(`Found ${current.length} of ${updates.length} published gown_temp documents`)
const byName = new Map(current.map((doc) => [doc.name, doc]))
for (const item of updates) {
  const doc = byName.get(item.name)
  if (!doc) throw new Error(`Missing gown_temp document: ${item.name}`)
  const set = {}
  const unset = []
  for (const [, field] of priceColumns) {
    const desired = item.values[field]
    if (desired === undefined) {
      if (doc[field] !== null && doc[field] !== undefined) unset.push(field)
    } else if (doc[field] !== desired) {
      set[field] = desired
    }
  }
  if (!Object.keys(set).length && !unset.length) {
    console.log(`Unchanged ${item.name}`)
    continue
  }
  let patch = client.patch(doc._id)
  if (Object.keys(set).length) patch = patch.set(set)
  if (unset.length) patch = patch.unset(unset)
  await patch.commit()
  console.log(`Updated ${item.name}: ${JSON.stringify(set)}${unset.length ? `; cleared ${unset.join(', ')}` : ''}`)
}

const after = await client.fetch('*[_type == "gown_temp" && name in $names]{name,metroManilaRate,luzonRate,outsideLuzonRate,metroManilaRateDiscount,luzonRateDiscount,outsideLuzonRateDiscount,pixieMetroManilaRate,pixieLuzonRate,pixieOutsideLuzonRate,pixieMetroManilaRateDiscount,pixieLuzonRateDiscount,pixieOutsideLuzonRateDiscount,forSaleRateLong,forSaleRatePixie}', {names}, {perspective: 'published'})
if (after.length !== updates.length) throw new Error('Post-update gown count mismatch')
for (const item of updates) {
  const doc = after.find((candidate) => candidate.name === item.name)
  if (!doc || priceColumns.some(([, field]) => (doc[field] ?? undefined) !== item.values[field])) {
    throw new Error(`Price verification failed for ${item.name}`)
  }
}
console.log(`Validated all ${updates.length} gown price records`)
