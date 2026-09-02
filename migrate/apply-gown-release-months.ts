import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {getCliClient} from 'sanity/cli'

const API_VERSION = '2026-09-02'
const EXPECTED_CSV_ROWS = 125
const EXPECTED_IMPORTED_GOWNS = 124

const monthNumbers = new Map([
  ['jan', '01'], ['january', '01'],
  ['feb', '02'], ['february', '02'],
  ['mar', '03'], ['march', '03'],
  ['apr', '04'], ['april', '04'],
  ['may', '05'],
  ['jun', '06'], ['june', '06'],
  ['jul', '07'], ['july', '07'],
  ['aug', '08'], ['august', '08'],
  ['sep', '09'], ['sept', '09'], ['september', '09'],
  ['oct', '10'], ['october', '10'],
  ['nov', '11'], ['november', '11'],
  ['dec', '12'], ['december', '12'],
])

const sanityNameAliases = new Map([
  ['lanyue (蓝月) - dark blue', 'Lanyue (蓝月)'],
  ['taohua (桃花) - pink and green', 'Taohua (桃花)'],
  ['zhulin (竹林) - bamboo green', 'Zhulin (竹林)'],
  ['xiahong (霞红) - pinkish red', 'Xiahong (霞红)'],
  ['qinglin (青林) - green', 'Qinglin (青林)'],
  ['fenghuang (凤凰) - phoenix', 'Fenghuang (凤凰)'],
  ['rapunzel v1', 'Rapunzel'],
  ['odette v1', 'Odette'],
])

const excludedCsvNames = new Map([
  ['merian', 'No matching Gown V2 document; excluded by user instruction'],
])

const normalizeName = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en')

type CsvRow = {
  row: number
  csvName: string
  sanityName: string
  releaseDate: string
}

type GownDocument = {
  _id: string
  name: string
  releaseDate?: string
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const csvPath = path.resolve(scriptDirectory, '../../GOWNS-RELEASE_DATES.csv')
const lines = fs
  .readFileSync(csvPath, 'utf8')
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .filter(Boolean)

if (lines.shift() !== 'Date Completed,Name') throw new Error('Unexpected CSV header')

const parsedRows = lines.map<CsvRow>((line, index) => {
  const comma = line.indexOf(',')
  if (comma < 0) throw new Error(`CSV row ${index + 2} has no comma`)

  const sourceDate = line.slice(0, comma).trim()
  const csvName = line.slice(comma + 1).trim()
  const dateMatch = /^([A-Za-z]+)\s+(\d{4})$/.exec(sourceDate)
  const month = dateMatch ? monthNumbers.get(dateMatch[1].toLowerCase()) : undefined
  if (!dateMatch || !month) throw new Error(`Invalid month on CSV row ${index + 2}: ${sourceDate}`)

  const normalizedCsvName = normalizeName(csvName)
  return {
    row: index + 2,
    csvName,
    sanityName: sanityNameAliases.get(normalizedCsvName) ?? csvName,
    releaseDate: `${dateMatch[2]}-${month}`,
  }
})

if (parsedRows.length !== EXPECTED_CSV_ROWS) {
  throw new Error(`Expected ${EXPECTED_CSV_ROWS} CSV rows, found ${parsedRows.length}`)
}

const duplicateCsvNames = parsedRows.filter(
  (row, index) =>
    parsedRows.findIndex((candidate) => normalizeName(candidate.csvName) === normalizeName(row.csvName)) !== index,
)
if (duplicateCsvNames.length) {
  throw new Error(`Duplicate CSV gown names: ${duplicateCsvNames.map((row) => row.csvName).join(', ')}`)
}

const excludedRows = parsedRows.filter((row) => excludedCsvNames.has(normalizeName(row.csvName)))
const importRows = parsedRows.filter((row) => !excludedCsvNames.has(normalizeName(row.csvName)))
if (importRows.length !== EXPECTED_IMPORTED_GOWNS) {
  throw new Error(`Expected ${EXPECTED_IMPORTED_GOWNS} imported gowns, found ${importRows.length}`)
}

const client = getCliClient({apiVersion: API_VERSION})

async function main() {
const documents = await client.fetch<GownDocument[]>(
  `*[_type == "gown_temp"]{_id,name,releaseDate}`,
  {},
  {perspective: 'raw'},
)

const documentsByName = new Map<string, GownDocument[]>()
for (const document of documents) {
  const key = normalizeName(document.name ?? '')
  documentsByName.set(key, [...(documentsByName.get(key) ?? []), document])
}

const targets: Array<{row: CsvRow; documents: GownDocument[]}> = []
const missing: CsvRow[] = []
const ambiguous: Array<{row: CsvRow; documentIds: string[]}> = []

for (const row of importRows) {
  const candidates = documentsByName.get(normalizeName(row.sanityName)) ?? []
  if (!candidates.length) {
    missing.push(row)
    continue
  }

  const logicalIds = new Set(candidates.map((document) => document._id.replace(/^drafts\./, '')))
  if (logicalIds.size !== 1) {
    ambiguous.push({row, documentIds: candidates.map((document) => document._id)})
    continue
  }

  targets.push({row, documents: candidates})
}

if (missing.length || ambiguous.length || targets.length !== EXPECTED_IMPORTED_GOWNS) {
  console.error(JSON.stringify({missing, ambiguous, matched: targets.length}, null, 2))
  throw new Error('Release month import validation failed; no documents were changed')
}

const patches = targets.flatMap(({row, documents: matchingDocuments}) =>
  matchingDocuments
    .filter((document) => document.releaseDate !== row.releaseDate)
    .map((document) => ({
      id: document._id,
      name: document.name,
      previousReleaseDate: document.releaseDate ?? null,
      releaseDate: row.releaseDate,
    })),
)

const report = {
  csvRows: parsedRows.length,
  matchedGowns: targets.length,
  documentsToPatch: patches.length,
  aliases: importRows
    .filter((row) => normalizeName(row.csvName) !== normalizeName(row.sanityName))
    .map(({csvName, sanityName}) => ({csvName, sanityName})),
  excluded: excludedRows.map((row) => ({
    csvName: row.csvName,
    reason: excludedCsvNames.get(normalizeName(row.csvName)),
  })),
}

if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({...report, mode: 'dry-run'}, null, 2))
  return
}

let transaction = client.transaction()
for (const patch of patches) transaction = transaction.patch(patch.id, {set: {releaseDate: patch.releaseDate}})
if (patches.length) await transaction.commit({visibility: 'sync'})

const verifiedDocuments = await client.fetch<GownDocument[]>(
  `*[_type == "gown_temp"]{_id,name,releaseDate}`,
  {},
  {perspective: 'raw'},
)
const verifiedById = new Map(verifiedDocuments.map((document) => [document._id, document]))
const verificationFailures = patches.filter(
  (patch) => verifiedById.get(patch.id)?.releaseDate !== patch.releaseDate,
)
if (verificationFailures.length) {
  console.error(JSON.stringify({verificationFailures}, null, 2))
  throw new Error('Post-import verification failed')
}

console.log(JSON.stringify({...report, mode: 'applied', verifiedPatches: patches.length}, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
