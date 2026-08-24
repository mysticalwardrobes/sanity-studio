# Custom-Made Gowns Sanity Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely prepare, review, publish, and validate the 20 approved custom-made gowns and
95 scoped photos in Sanity production, including the Rhuby and Lily gallery appends.

**Architecture:** Add a deterministic TypeScript migration under
`migrate/custom-made-gowns` with separate parsing, curated mapping, media preparation, apply,
and validation layers. A generated manifest is the immutable boundary between the read-only
prepare phase and the explicitly authorized apply phase. Add a small pure storefront webhook
helper so `customMadeGowns` events clear the two Redis namespaces and revalidate the correct
routes.

**Tech Stack:** TypeScript, Node test runner through `tsx`, Sanity Client/CLI, Sharp, macOS Quick
Look for HEIC rendering, Next.js App Router, Redis, Vitest.

**Spec:**
`docs/superpowers/specs/2026-08-24-custom-made-gowns-sanity-import-design.md`

## Global Constraints

- [ ] Work only with Sanity `_type == "customMadeGowns"`; never query or mutate `gown` or
  `gown_temp` as migration targets.
- [ ] Target only project `yz23zros`, dataset `production`, and API version `2026-08-24`.
- [ ] Keep production mutation behind both `--apply` and a fresh user approval of the generated
  manifest and review report.
- [ ] Ignore `Nicola - Lilibeth inspired`, the Kishi Abuhat MOV, and `.DS_Store` files.
- [ ] Publish `Karina 1` without photos and assign all four supplemental Karina photos to
  `Karina 2`.
- [ ] Use Lucy's folder structure: move the PHP 8,990 hood price to `Pixie Moonbeam`, assign its
  three pixie and eight hood photos there, and leave `Pixie Shooting Star` without a hood price.
- [ ] Preserve both Odette rows as distinct source records even though title and client match.
- [ ] Do not run build or lint commands, per the user's instruction. Run focused and full test
  suites only.
- [ ] Do not deploy the storefront. Report webhook deployment as pending unless the user
  separately authorizes it.
- [ ] Commit only files belonging to the task. The storefront worktree already contains
  unrelated user changes that must remain untouched.

## File Structure

### Sanity project: `mysticalwardrobes-sanity`

- `migrate/custom-made-gowns/types.ts` — shared manifest, result, Portable Text, asset, and
  destination types.
- `migrate/custom-made-gowns/csv.ts` — strict CSV parsing, header checks, text normalization,
  and peso parsing.
- `migrate/custom-made-gowns/csv.test.ts` — quoted-field, Unicode, price, header, and row-count
  tests.
- `migrate/custom-made-gowns/mapping.ts` — all 20 source records, client overrides, photo routes,
  Lucy override, append routes, and ignored routes.
- `migrate/custom-made-gowns/mapping.test.ts` — complete mapping/count/exception tests.
- `migrate/custom-made-gowns/descriptions.ts` — 20 reviewed deterministic descriptions and
  Portable Text conversion.
- `migrate/custom-made-gowns/descriptions.test.ts` — coverage and stable-key tests.
- `migrate/custom-made-gowns/media.ts` — allowed-root inventory, ordering, hashing, conversion,
  validation, and route assignment.
- `migrate/custom-made-gowns/media.test.ts` — cover ordering, natural sorting, duplicate,
  ignored-file, and unapproved-file tests.
- `migrate/custom-made-gowns/prepare.ts` — read-only destination query, manifest construction,
  report rendering, and persistence.
- `migrate/custom-made-gowns/prepare.test.ts` — 20-document/95-image manifest and collision tests.
- `migrate/custom-made-gowns/importer.ts` — immutable preflight, resumable upload/create/update,
  append logic, and result persistence.
- `migrate/custom-made-gowns/importer.test.ts` — authorization, hash drift, Odette, resume,
  append, and stop-on-error tests.
- `migrate/custom-made-gowns/validate.ts` — post-apply GROQ validation and report generation.
- `migrate/custom-made-gowns/validate.test.ts` — created-document and append validation tests.
- `migrate/custom-made-gowns/run.ts` — Sanity CLI entry point for prepare/apply/validate.
- `migrate/custom-made-gowns/generated/` — ignored generated images, manifests, reviews, results,
  and validation reports.
- `.gitignore` — ignore the generated directory.
- `package.json` — add test, prepare, import, and validate scripts.

### Storefront project: `mysticalwardrobes`

- `lib/sanity-webhook.ts` — supported types and a pure custom-made-gown invalidation plan.
- `tests/sanity-webhook.test.ts` — regression coverage for the type, Redis patterns, list/API
  routes, and normalized detail route.
- `app/api/webhooks/sanity/route.ts` — execute the helper's patterns and paths.

---

## Task 1: Parse and Normalize the CSV

**Files:**

- Create: `migrate/custom-made-gowns/types.ts`
- Create: `migrate/custom-made-gowns/csv.ts`
- Create: `migrate/custom-made-gowns/csv.test.ts`

- [ ] **Step 1: Define the smallest shared domain types**

Use CSV line numbers as source identity, not title/client pairs:

```ts
export const PHOTO_FIELDS = [
  'longGownPicture',
  'pixiePicture',
  'hoodPicture',
] as const

export type PhotoField = (typeof PHOTO_FIELDS)[number]
export type SourceKey = `csv-row-${number}`

export type NormalizedCsvRecord = {
  sourceKey: SourceKey
  sourceRow: number
  rawClientName: string
  title: string
  location: string
  preOrderPrice?: number
  pixiePreOrderPrice?: number
  hoodPreOrderPrice?: number
}

export type PortableTextDescription = Array<{
  _type: 'block'
  _key: string
  style: 'normal'
  markDefs: []
  children: Array<{_type: 'span'; _key: string; text: string; marks: []}>
}>
```

- [ ] **Step 2: Write failing CSV tests**

Cover these exact behaviors with `node:test` and `node:assert/strict`:

```ts
test('parseCsv handles quoted peso values, CRLF, Unicode, and empty trailing cells', () => {
  const csv =
    'Client - include 1st name only,NEW GOWNS,Description,Long Gown,Pixie ,Hood and Capelet,Location\r\n' +
    'Mira ,Victorian White Gown,Generate description for all ,"₱58,990.00",,,Ontario Canada\r\n'

  assert.equal(parseCustomMadeGownsCsv(csv)[0].preOrderPrice, 58990)
})

test('parseCustomMadeGownsCsv rejects a changed header', () => {
  assert.throws(() => parseCustomMadeGownsCsv('Client,Title\nMira,Gown'), /CSV headers/)
})

test('parseCustomMadeGownsCsv requires exactly 20 data rows', () => {
  assert.throws(() => parseCustomMadeGownsCsv(validHeaderOnly), /20 data rows/)
})

test('parsePeso rejects partial and fractional peso values', () => {
  assert.throws(() => parsePeso('₱12,000 sale'), /Invalid peso value/)
  assert.throws(() => parsePeso('₱12,000.50'), /whole pesos/)
})
```

Also assert that the real CSV yields source keys `csv-row-2` through `csv-row-21`, retains both
Odette rows, and parses the seven price columns without writing `null` or `NaN`.

- [ ] **Step 3: Run the failing tests**

Run: `npx tsx --test migrate/custom-made-gowns/csv.test.ts`

Expected: FAIL because the parser does not exist yet.

- [ ] **Step 4: Implement a strict RFC-4180-style parser for this source**

Implement a state machine that supports commas, CRLF/LF, quoted cells, and doubled quote escapes.
Reject unterminated quotes and rows whose cell counts differ from the exact header:

```ts
export const EXPECTED_HEADERS = [
  'Client - include 1st name only',
  'NEW GOWNS',
  'Description',
  'Long Gown',
  'Pixie ',
  'Hood and Capelet',
  'Location',
] as const

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

export function parsePeso(value: string): number | undefined {
  const normalized = normalizeText(value)
  if (!normalized) return undefined
  const match = normalized.match(/^₱?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.00)?$/u)
  if (!match) throw new Error(`Invalid peso value: ${value}`)
  return Number(match[1].replaceAll(',', ''))
}
```

Require non-empty title, client source, and location. Preserve the original CSV line number in
every parsed record.

- [ ] **Step 5: Run the CSV tests**

Run: `npx tsx --test migrate/custom-made-gowns/csv.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the parser**

```bash
git add migrate/custom-made-gowns/types.ts migrate/custom-made-gowns/csv.ts migrate/custom-made-gowns/csv.test.ts
git commit -m "Add custom gown CSV parser"
```

---

## Task 2: Encode the Approved Record and Photo Mapping

**Files:**

- Create: `migrate/custom-made-gowns/mapping.ts`
- Create: `migrate/custom-made-gowns/mapping.test.ts`

- [ ] **Step 1: Write failing mapping completeness tests**

Assert all of these invariants in one table-driven test:

- exactly 20 CSV source records;
- exactly 86 new-document images, 9 append images, and 95 scoped images;
- field totals of 64 long, 14 pixie, and 8 hood images for the new documents;
- only `csv-row-20` (`Karina 1`) has zero photos;
- `csv-row-8` has pixie price 38,990 and hood price 8,990;
- `csv-row-9` has pixie price 45,990 and no hood price;
- both Odette records use `SOFT PLAY & BALL PIT HIRE` but have different source keys;
- Courtney uses `Additional Photos/Custom Made Order/Liz - Courtney`;
- Karina 2 uses `Additional Photos/Custom Made Order/Liz - Karina`;
- no route includes Lilibeth, Kishi, a MOV, `gown`, or `gown_temp`.

- [ ] **Step 2: Run the failing mapping tests**

Run: `npx tsx --test migrate/custom-made-gowns/mapping.test.ts`

Expected: FAIL because the approved mapping is not implemented.

- [ ] **Step 3: Implement the complete source mapping**

Use explicit file/folder routes. Do not infer client names or move photos at runtime. The mapping
must encode this complete contract:

| Source key | CSV line | Public title | Client | Long | Pixie | Hood | Photo source |
| --- | ---: | --- | --- | ---: | ---: | ---: | --- |
| `csv-row-2` | 2 | Victorian White Gown | Mira | 6 | 0 | 0 | `Mira` |
| `csv-row-3` | 3 | Celestial Starry Night | Kathleen | 3 | 3 | 0 | `Kathleen Inway` |
| `csv-row-4` | 4 | Simple Ethereal Debut Gown | Cheryl | 5 | 0 | 0 | `Cheryl Grace Cuenco-Cruz` |
| `csv-row-5` | 5 | Laufey Pixie Dress | Kyle | 0 | 4 | 0 | `Kyle Paulyn Tanjusay` |
| `csv-row-6` | 6 | Red Velvet and Black Bridgerton Dress | L!Z | 2 | 0 | 0 | `L!Z  vampjfy` |
| `csv-row-7` | 7 | Clara and Ariel Debut with Trail | Lou | 5 | 0 | 0 | `Lou` |
| `csv-row-8` | 8 | Pixie Moonbeam | Lucy | 0 | 3 | 8 | `Lucy 1/Pixie`, `Lucy 1/Hood`, `Celestial Hood` |
| `csv-row-9` | 9 | Pixie Shooting Star | Lucy | 0 | 4 | 0 | `Lucy 2` |
| `csv-row-10` | 10 | Pink Coquette Victorian Gown | mm | 4 | 0 | 0 | `mm  notmarisyl` |
| `csv-row-11` | 11 | Giselle Gown | Onnie | 2 | 0 | 0 | `Onnie Lonnie` |
| `csv-row-12` | 12 | Enchanted | Rache | 3 | 0 | 0 | `Rache` |
| `csv-row-13` | 13 | Bridgerton Blue Gown | Rhuby | 4 | 0 | 0 | `Rhuby Blue` |
| `csv-row-14` | 14 | Odette Inspired Gown | SOFT PLAY & BALL PIT HIRE | 5 | 0 | 0 | `SOFT PLAY & BALL PIT HIRE 1` |
| `csv-row-15` | 15 | Odette Inspired Gown | SOFT PLAY & BALL PIT HIRE | 5 | 0 | 0 | `SOFT PLAY & BALL PIT HIRE 2` |
| `csv-row-16` | 16 | Purple Victorian Gown | yukiyahsway | 5 | 0 | 0 | `yukiyahsway  🌺` |
| `csv-row-17` | 17 | Elegant White and Gold Bridgerton Gown | Misa | 3 | 0 | 0 | `• 𝓶𝓲𝓼𝓪 𝓻𝓪𝔂𝓮 •  sunrayemi` |
| `csv-row-18` | 18 | Red Flowy Dress | Raychelle | 3 | 0 | 0 | `Raychelle Obra` |
| `csv-row-19` | 19 | Courtney Debut Gown | Liz | 5 | 0 | 0 | supplemental Courtney folder |
| `csv-row-20` | 20 | Karina 1 | Liz | 0 | 0 | 0 | approved empty gallery |
| `csv-row-21` | 21 | Karina 2 | Liz | 4 | 0 | 0 | supplemental Karina folder |

Kathleen's explicit classification must be:

```ts
const KATHLEEN_FIELDS = {
  longGownPicture: ['IMG_1058.HEIC', 'IMG_1059.HEIC', 'IMG_1073.HEIC'],
  pixiePicture: ['IMG_1077.HEIC', 'IMG_1081.HEIC', 'IMG_1082 (2).HEIC'],
} as const
```

Encode these append and ignore records as data, not conditional filename guesses:

```ts
export const APPEND_MAPPINGS = [
  {
    sourceKey: 'append-rhuby-pink',
    folder: 'Rhuby Pink',
    expectedTitle: 'Pink Simple Hood',
    expectedClientName: 'Rhuby',
    field: 'longGownPicture',
    expectedCount: 7,
  },
  {
    sourceKey: 'append-lily-starry-fairytale',
    folder: 'Lily',
    expectedTitle: 'Starry Fairytale',
    expectedClientName: 'Lily',
    field: 'longGownPicture',
    expectedCount: 2,
  },
] as const

export const IGNORED_MEDIA = [
  {path: '.DS_Store', reason: 'filesystem metadata'},
  {path: 'Lucy 1/.DS_Store', reason: 'filesystem metadata'},
  {path: 'Kishi Abuhat/For Thumbnail dapat yung gown.mov', reason: 'video deferred'},
  {path: 'Nicola - Lilibeth inspired', reason: 'regular catalogue excluded'},
] as const
```

- [ ] **Step 4: Apply approved field overrides after parsing**

`materializeMappedRecords` must compare each source line's title against the mapped title, then
apply only the approved public client and Lucy price overrides. A changed CSV title or unexpected
price must fail preparation rather than silently accepting drift.

- [ ] **Step 5: Run the mapping tests**

Run: `npx tsx --test migrate/custom-made-gowns/mapping.test.ts`

Expected: PASS with 20 records and the exact 86/9/95 counts.

- [ ] **Step 6: Commit the mapping**

```bash
git add migrate/custom-made-gowns/mapping.ts migrate/custom-made-gowns/mapping.test.ts
git commit -m "Map custom gown source records"
```

---

## Task 3: Curate Descriptions and Portable Text

**Files:**

- Create: `migrate/custom-made-gowns/descriptions.ts`
- Create: `migrate/custom-made-gowns/descriptions.test.ts`

- [ ] **Step 1: Inspect one cover and the assigned gallery for every source record**

Use local previews only. For Kathleen, Lucy, Courtney, and Karina 2, check both silhouettes or
supplemental folders. For Karina 1, whose gallery is intentionally empty, write a conservative
description based only on its title and known long-gown price; do not claim a color, fabric, or
embellishment.

- [ ] **Step 2: Write failing description-contract tests**

The test must require exactly the 20 source keys, reject blank text and the CSV instruction
`Generate description for all`, and verify one deterministic block/span:

```ts
test('toPortableText uses stable keys and one factual paragraph', () => {
  assert.deepEqual(toPortableText('csv-row-8', 'A celestial pixie gown.'), [
    {
      _type: 'block',
      _key: 'description-8',
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: 'description-8-span',
          text: 'A celestial pixie gown.',
          marks: [],
        },
      ],
    },
  ])
})
```

- [ ] **Step 3: Run the failing description tests**

Run: `npx tsx --test migrate/custom-made-gowns/descriptions.test.ts`

Expected: FAIL because the description map is absent.

- [ ] **Step 4: Add all 20 reviewed descriptions as versioned source data**

Export `ApprovedSourceKey` from the mapping module as the union of its 20 literal source keys,
then implement `DESCRIPTION_BY_SOURCE_KEY: Record<ApprovedSourceKey, string>`. Each value must be
one concise paragraph grounded in the assigned photos. Mention only visible color, silhouette, fabric
appearance, embellishment, sleeves, draping, layers, and a matching hood/capelet when applicable.
Do not use runtime AI, template filler, invented occasions, fabric composition, construction
claims, or unsupported licensed-character language.

Do not leave `TODO`, placeholder copy, an empty string, or a description-generation instruction
in the mapping. The later review report must print the exact text for all 20 records.

- [ ] **Step 5: Implement stable Portable Text conversion and run tests**

Run: `npx tsx --test migrate/custom-made-gowns/descriptions.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the curated content mapping**

```bash
git add migrate/custom-made-gowns/descriptions.ts migrate/custom-made-gowns/descriptions.test.ts
git commit -m "Add custom gown descriptions"
```

---

## Task 4: Prepare and Validate Local Media

**Files:**

- Create: `migrate/custom-made-gowns/media.ts`
- Create: `migrate/custom-made-gowns/media.test.ts`
- Reuse: `migrate/prom-queens/images.ts`
- Reuse: `migrate/prom-queens/runtime.ts`

- [ ] **Step 1: Extend the shared types for prepared assets**

```ts
export type PreparedAsset = {
  sourcePath: string
  sourceRelativePath: string
  uploadPath: string
  sourceFilename: string
  sourceSha1: string
  uploadSha1: string
  width: number
  height: number
  field: PhotoField
  order: number
}
```

The source hash catches source drift. The upload hash identifies the exact bytes Sanity receives
and permits rerun reuse after HEIC-to-JPEG conversion.

- [ ] **Step 2: Write failing media tests**

Use temporary directories and small Sharp fixtures. Cover:

```ts
test('compareMediaNames puts explicit covers first and sorts remaining names naturally', () => {
  assert.deepEqual(
    ['IMG_10.jpg', 'IMG_2.jpg', 'LCover.jpg'].sort(compareMediaNames),
    ['LCover.jpg', 'IMG_2.jpg', 'IMG_10.jpg'],
  )
})

test('inventory rejects an unapproved still instead of silently skipping it', async () => {
  await assert.rejects(() => inventoryMedia(fixtureWithUnknownJpeg), /Unapproved media/)
})

test('inventory rejects duplicate local content hashes', async () => {
  await assert.rejects(() => inventoryMedia(fixtureWithDuplicateBytes), /duplicate local file/i)
})
```

Also test exact ignored paths, direct JPEG/PNG dimensions, injected HEIC conversion, blank output
rejection, field assignment, and cover-first order within each field.

- [ ] **Step 3: Run the failing media tests**

Run: `npx tsx --test migrate/custom-made-gowns/media.test.ts`

Expected: FAIL because the inventory does not exist.

- [ ] **Step 4: Implement strict inventory and ordering**

Walk both approved roots recursively. Match every discovered file to an explicit route or ignore
rule. Use a numeric-aware `Intl.Collator` and this cover precedence:

```ts
const collator = new Intl.Collator('en', {numeric: true, sensitivity: 'base'})
const COVER_NAMES = new Set(['cover', 'lcover', 'pcover', 'hcover'])

export function compareMediaNames(left: string, right: string): number {
  const leftStem = path.parse(left).name.toLowerCase()
  const rightStem = path.parse(right).name.toLowerCase()
  const coverDifference = Number(!COVER_NAMES.has(leftStem)) - Number(!COVER_NAMES.has(rightStem))
  return coverDifference || collator.compare(left, right)
}
```

Do not treat arbitrary names containing the word `cover` as explicit covers.

- [ ] **Step 5: Reuse the proven image pipeline**

For `.heic`, call `convertWithQuickLook` from `migrate/prom-queens/runtime.ts`, which normalizes
through Sharp. Adjust the shared `convertToJpeg` quality to 92 only if its current setting differs,
and update the existing Prom Queens test if that shared behavior changes. For `.jpg`, `.jpeg`, and
`.png`, preserve source bytes. In every case call `validateImage`, read Sharp metadata, and require
positive integer dimensions.

Compute SHA-1 with `node:crypto` for source and upload bytes. Keep generated conversions under
`migrate/custom-made-gowns/generated/converted` and never write into either source photo tree.

- [ ] **Step 6: Run media and shared image tests**

Run:

```bash
npx tsx --test migrate/custom-made-gowns/media.test.ts migrate/prom-queens/images.test.ts migrate/prom-queens/runtime.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the media pipeline**

```bash
git add migrate/custom-made-gowns/media.ts migrate/custom-made-gowns/media.test.ts migrate/prom-queens/images.ts migrate/prom-queens/images.test.ts
git commit -m "Prepare custom gown media"
```

Only stage the two Prom Queens files if their JPEG quality code or test actually changed.

---

## Task 5: Build the Read-Only Manifest and Review Report

**Files:**

- Modify: `migrate/custom-made-gowns/types.ts`
- Create: `migrate/custom-made-gowns/prepare.ts`
- Create: `migrate/custom-made-gowns/prepare.test.ts`

- [ ] **Step 1: Define the manifest boundary**

```ts
export type PreparedDocument = {
  sourceKey: SourceKey
  sourceRow: number
  action: 'create' | 'update-imported'
  existingDocumentId?: string
  title: string
  clientName: string
  location: string
  description: PortableTextDescription
  preOrderPrice?: number
  pixiePreOrderPrice?: number
  hoodPreOrderPrice?: number
  assets: PreparedAsset[]
}

export type PreparedAppend = {
  sourceKey: 'append-rhuby-pink' | 'append-lily-starry-fairytale'
  documentId: string
  expectedTitle: string
  expectedClientName: string
  field: 'longGownPicture'
  baselineAssetIds: string[]
  assets: PreparedAsset[]
}

export type CustomMadeGownsManifest = {
  version: 1
  target: {projectId: 'yz23zros'; dataset: 'production'}
  generatedAt: string
  csvPath: string
  csvSha1: string
  mediaRoots: string[]
  documents: PreparedDocument[]
  appends: PreparedAppend[]
  ignored: Array<{path: string; reason: string}>
  totals: {documents: 20; newDocumentImages: 86; appendImages: 9; scopedImages: 95}
}
```

For a rerun, load the prior result first and classify only its recorded IDs as
`update-imported`. Never use the ambiguous Odette title/client pair to select an update target.

- [ ] **Step 2: Write failing prepare tests with injected destination queries**

Test:

- successful construction of 20 documents, two appends, 86/9/95 assets, and `Karina 1` with no
  photo properties;
- two planned creates for the Odette rows on a first run;
- distinct update IDs for those rows when supplied by a prior result;
- failure on a title/client collision for any new source record;
- failure when an append query returns zero or multiple exact targets;
- failure when a prior result ID is missing, drafted, or no longer a `customMadeGowns` document;
- a report containing every source key, title, client, description, price, field count, intended
  action, append target ID, warning, and ignored path.

- [ ] **Step 3: Run the failing prepare tests**

Run: `npx tsx --test migrate/custom-made-gowns/prepare.test.ts`

Expected: FAIL because preparation is not implemented.

- [ ] **Step 4: Query only published custom-made gown destination records**

Inject the query in tests and use this projection in the CLI:

```groq
*[_type == "customMadeGowns" && !(_id in path("drafts.**"))]{
  _id,
  title,
  clientName,
  longGownPicture[]{_key, "assetId": asset._ref, "sha1": asset->sha1},
  pixiePicture[]{_key, "assetId": asset._ref, "sha1": asset->sha1},
  hoodPicture[]{_key, "assetId": asset._ref, "sha1": asset->sha1}
}
```

Normalize destination title/client only for comparison with `trim()`, repeated-whitespace
collapse, Unicode normalization, and lowercase. Do not change stored source text.

- [ ] **Step 5: Build and persist deterministic output**

Write:

- `generated/import-manifest.json` with two-space JSON formatting and a trailing newline;
- `generated/import-review.md` with all human-review fields;
- HEIC conversions under `generated/converted`.

Sort documents by `sourceRow`, appends by source key, and each gallery by explicit cover/natural
order. `generatedAt` is the only time-dependent field. Add an injected clock for stable tests.

- [ ] **Step 6: Run all prepare-layer tests**

Run:

```bash
npx tsx --test migrate/custom-made-gowns/csv.test.ts migrate/custom-made-gowns/mapping.test.ts migrate/custom-made-gowns/descriptions.test.ts migrate/custom-made-gowns/media.test.ts migrate/custom-made-gowns/prepare.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit preparation**

```bash
git add migrate/custom-made-gowns/types.ts migrate/custom-made-gowns/prepare.ts migrate/custom-made-gowns/prepare.test.ts
git commit -m "Generate custom gown import manifest"
```

---

## Task 6: Implement Resumable Apply with Immutable Preflight

**Files:**

- Modify: `migrate/custom-made-gowns/types.ts`
- Create: `migrate/custom-made-gowns/importer.ts`
- Create: `migrate/custom-made-gowns/importer.test.ts`

- [ ] **Step 1: Define a durable result file**

```ts
export type ImportedAssetResult = {
  sourceRelativePath: string
  uploadSha1: string
  assetId: string
}

export type ImportActionKey = SourceKey | PreparedAppend['sourceKey']

export type ImportedActionResult<Key extends ImportActionKey = ImportActionKey> = {
  sourceKey: Key
  documentId: string
  assets: ImportedAssetResult[]
  status: 'assets-uploaded' | 'published' | 'failed'
  error?: string
}

export type ImportResult = {
  version: 1
  target: {projectId: 'yz23zros'; dataset: 'production'}
  manifestSha1: string
  startedAt: string
  updatedAt: string
  documents: Partial<Record<SourceKey, ImportedActionResult<SourceKey>>>
  appends: Partial<
    Record<PreparedAppend['sourceKey'], ImportedActionResult<PreparedAppend['sourceKey']>>
  >
}
```

Persist `generated/import-result.json` atomically after each upload and document mutation by
writing a sibling temporary file and renaming it.

- [ ] **Step 2: Write failing authorization and preflight tests**

Test that apply refuses to call any mutation dependency when:

- `--apply` was not represented by `authorized: true`;
- the user token is absent;
- target project/dataset differ;
- manifest counts differ from 20/86/9/95;
- the raw manifest SHA-1 differs from the result file on resume;
- current CSV, source, or upload bytes differ from recorded hashes;
- a new unreviewed exact title/client collision appears;
- an append ID, title, or client no longer matches;
- a prior imported ID is not a published `customMadeGowns` document.

Use spies/counters to assert zero uploads, creates, or patches in every failure.

- [ ] **Step 3: Write failing resume and mutation tests**

Cover:

- sequential upload of every missing file asset with its basename;
- reuse of an asset ID saved in the result file when `uploadSha1` matches;
- creation only after all assets for that document have succeeded;
- published `_type: 'customMadeGowns'` payloads with omitted empty fields;
- Sanity-generated document IDs returned by `create`, not source-derived IDs;
- stable file item keys and `_type: 'file'` references;
- two separate created document IDs for the Odette source keys;
- preserving existing gallery order and appending only hashes not already present;
- a rerun patching scalar source fields and appending missing importer assets to a recorded
  document without replacing editor-added gallery items;
- stop-on-first-error with completed work and the failure saved to the result file.

- [ ] **Step 4: Run the failing importer tests**

Run: `npx tsx --test migrate/custom-made-gowns/importer.test.ts`

Expected: FAIL because apply is not implemented.

- [ ] **Step 5: Implement immutable preflight before the first mutation**

`preflightManifest` must read the persisted manifest bytes, calculate its SHA-1, re-read every
source/upload file, parse the current CSV, run a fresh destination query, and check all exact
targets. It returns a validated in-memory apply plan. Do not mix checks into the mutation loop.

- [ ] **Step 6: Implement sequential resumable uploads**

Upload Sanity file assets with low concurrency by processing them sequentially:

```ts
const asset = await client.assets.upload('file', createReadStream(prepared.uploadPath), {
  filename: path.basename(prepared.uploadPath),
})
```

Before upload, reuse a matching result entry. For appends, also reuse an already referenced
remote asset when its dereferenced `sha1` equals `uploadSha1`. Save the result immediately after
receiving a new asset ID.

- [ ] **Step 7: Build exact Sanity file arrays and documents**

```ts
function toFileItem(asset: ImportedAssetResult) {
  return {
    _type: 'file' as const,
    _key: `asset-${asset.uploadSha1.slice(0, 20)}`,
    asset: {_type: 'reference' as const, _ref: asset.assetId},
  }
}
```

Group prepared assets by field. Omit an empty group entirely. Create a published document using
`client.create(payload)`, then persist the returned `_id` against its source key. On a recorded
rerun, verify the ID and patch normalized scalar fields while appending only importer-owned asset
references absent from the current gallery. Never replace a gallery array.

For Rhuby and Lily, use `setIfMissing({longGownPicture: []})` plus an append of only the missing
stable-key items. Do not modify existing copy, prices, or gallery order.

- [ ] **Step 8: Run the importer tests**

Run: `npx tsx --test migrate/custom-made-gowns/importer.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit apply support**

```bash
git add migrate/custom-made-gowns/types.ts migrate/custom-made-gowns/importer.ts migrate/custom-made-gowns/importer.test.ts
git commit -m "Add resumable custom gown importer"
```

---

## Task 7: Add Uncached Post-Apply Validation

**Files:**

- Create: `migrate/custom-made-gowns/validate.ts`
- Create: `migrate/custom-made-gowns/validate.test.ts`

- [ ] **Step 1: Write failing validation tests**

Build a valid remote fixture from the manifest/result, then independently corrupt each of these
and require a useful failure naming the source key and field:

- missing document ID;
- wrong `_type`, title, client, location, or price;
- changed Portable Text description;
- missing/unresolved file asset reference;
- wrong long/pixie/hood field assignment;
- repeated asset reference in one gallery;
- photos on Karina 1;
- missing one of the seven Rhuby or two Lily imported hashes;
- both Odette source keys pointing to the same document ID;
- a non-file document reference in an imported document.

- [ ] **Step 2: Run the failing validation tests**

Run: `npx tsx --test migrate/custom-made-gowns/validate.test.ts`

Expected: FAIL because validation is not implemented.

- [ ] **Step 3: Implement result-ID-driven GROQ validation**

Fetch the 20 result IDs directly, not by title/client:

```groq
*[_id in $documentIds && !(_id in path("drafts.**"))]{
  _id,
  _type,
  title,
  clientName,
  location,
  description,
  preOrderPrice,
  pixiePreOrderPrice,
  hoodPreOrderPrice,
  longGownPicture[]{_key, _type, "assetId": asset._ref, "assetType": asset->_type, "sha1": asset->sha1},
  pixiePicture[]{_key, _type, "assetId": asset._ref, "assetType": asset->_type, "sha1": asset->sha1},
  hoodPicture[]{_key, _type, "assetId": asset._ref, "assetType": asset->_type, "sha1": asset->sha1}
}
```

Fetch each append target by recorded ID and verify every prepared `uploadSha1` is present exactly
once. Existing editor assets may remain before or after the imported set; validation must not
require the whole gallery to equal the preparation baseline.

- [ ] **Step 4: Render and persist a validation report**

Write `generated/import-validation.md` with target, manifest hash, result IDs, per-source scalar
checks, field counts, resolved file asset counts, append checks, warnings, and a final PASS/FAIL.
Throw after writing a failed report so the command exits non-zero.

- [ ] **Step 5: Run validation tests**

Run: `npx tsx --test migrate/custom-made-gowns/validate.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit validation**

```bash
git add migrate/custom-made-gowns/validate.ts migrate/custom-made-gowns/validate.test.ts
git commit -m "Validate custom gown import"
```

---

## Task 8: Wire the CLI, Scripts, and Generated-File Boundary

**Files:**

- Create: `migrate/custom-made-gowns/run.ts`
- Modify: `.gitignore`
- Modify: `package.json`

- [ ] **Step 1: Add one mutually exclusive CLI mode**

Use `getCliClient({apiVersion: '2026-08-24'})` and resolve all source paths from the Sanity
project directory:

```ts
const workspaceRoot = path.resolve(process.cwd(), '..')
const paths = {
  csv: path.join(workspaceRoot, 'custom made gowns info - Sheet1.csv'),
  primaryMedia: path.join(workspaceRoot, 'Website Update_PerGown - Custom Made Gowns'),
  additionalMedia: path.join(workspaceRoot, 'Additional Photos/Custom Made Order'),
  generated: path.join(process.cwd(), 'migrate/custom-made-gowns/generated'),
}
```

Accept exactly one of `--prepare`, `--apply`, or `--validate`. Apply must also require a non-empty
user token available to the Sanity CLI client and must pass `authorized: true` only after parsing
the literal `--apply` flag.

- [ ] **Step 2: Add npm scripts**

```json
"custom-made-gowns:test": "tsx --test migrate/custom-made-gowns/*.test.ts",
"custom-made-gowns:prepare": "sanity exec migrate/custom-made-gowns/run.ts -- --prepare",
"custom-made-gowns:import": "sanity exec migrate/custom-made-gowns/run.ts --with-user-token -- --apply",
"custom-made-gowns:validate": "sanity exec migrate/custom-made-gowns/run.ts -- --validate"
```

- [ ] **Step 3: Ignore generated artifacts**

Append exactly:

```gitignore
# Custom-made gown migration artifacts and converted media
/migrate/custom-made-gowns/generated/
```

- [ ] **Step 4: Run the complete Sanity migration tests**

Run:

```bash
npm run custom-made-gowns:test
npm run prom-queens:test
```

Expected: both PASS. Do not run build or lint.

- [ ] **Step 5: Check formatting and generated-file exclusion without a lint/build**

Run:

```bash
npx prettier --check "migrate/custom-made-gowns/**/*.ts" package.json
git check-ignore migrate/custom-made-gowns/generated/import-manifest.json
git status --short
```

Expected: Prettier passes, the generated manifest path is ignored, and only intentional source
files are present. If Prettier fails, run it only on the new migration files and package metadata,
then repeat the check.

- [ ] **Step 6: Commit CLI wiring**

```bash
git add migrate/custom-made-gowns/run.ts .gitignore package.json package-lock.json
git commit -m "Wire custom gown migration commands"
```

Do not stage `package-lock.json` unless it changed as a direct result of the script edit.

---

## Task 9: Add Storefront Cache Invalidation

**Files:**

- Create: `mysticalwardrobes/lib/sanity-webhook.ts`
- Create: `mysticalwardrobes/tests/sanity-webhook.test.ts`
- Modify: `mysticalwardrobes/app/api/webhooks/sanity/route.ts`

- [ ] **Step 1: Write the failing pure-helper regression test**

```ts
import {describe, expect, it} from 'vitest'

import {getCustomMadeGownInvalidation, isSupportedSanityType} from '@/lib/sanity-webhook'

describe('custom-made gown Sanity webhook', () => {
  it('supports customMadeGowns and returns every cache and route target', () => {
    expect(isSupportedSanityType('customMadeGowns')).toBe(true)
    expect(getCustomMadeGownInvalidation('drafts.gown-123')).toEqual({
      cachePatterns: ['custom-made-gowns:*', 'custom-made-gown:*'],
      paths: [
        '/custom-made-gowns',
        '/api/custom-made-gowns',
        '/custom-made-gowns/gown-123',
      ],
    })
  })
})
```

- [ ] **Step 2: Run the failing storefront test**

Run from `mysticalwardrobes`:

`npm test -- tests/sanity-webhook.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the pure helper**

Move the existing `SUPPORTED_TYPES` tuple into `lib/sanity-webhook.ts`, append
`'customMadeGowns'`, and export a type guard. Implement:

```ts
export function getCustomMadeGownInvalidation(id?: string) {
  const normalizedId = id?.replace(/^drafts\./, '')
  return {
    cachePatterns: ['custom-made-gowns:*', 'custom-made-gown:*'],
    paths: [
      '/custom-made-gowns',
      '/api/custom-made-gowns',
      ...(normalizedId ? [`/custom-made-gowns/${normalizedId}`] : []),
    ],
  }
}
```

- [ ] **Step 4: Integrate it into the route**

Use the type guard for payload validation. In the `customMadeGowns` branch, execute both
`deleteByPattern` calls with `Promise.all`, then call `revalidatePath` for every returned path.
Retain all existing common and document-specific revalidation behavior.

- [ ] **Step 5: Run focused and full storefront tests**

Run:

```bash
npm test -- tests/sanity-webhook.test.ts
npm test
```

Expected: PASS. Do not run build or lint.

- [ ] **Step 6: Commit only the webhook files**

```bash
git add lib/sanity-webhook.ts tests/sanity-webhook.test.ts app/api/webhooks/sanity/route.ts
git diff --cached --check
git commit -m "Invalidate custom gown Sanity cache"
```

Verify `git diff --cached --name-only` contains only those three files before committing. Leave
all existing unrelated storefront changes unstaged.

---

## Task 10: Generate and Review the Production Manifest

**Files:**

- Generate, ignored: `migrate/custom-made-gowns/generated/import-manifest.json`
- Generate, ignored: `migrate/custom-made-gowns/generated/import-review.md`
- Generate, ignored: `migrate/custom-made-gowns/generated/converted/*`

- [ ] **Step 1: Re-run migration tests immediately before preparation**

Run from `mysticalwardrobes-sanity`:

```bash
npm run custom-made-gowns:test
npm run prom-queens:test
```

Expected: PASS.

- [ ] **Step 2: Run the read-only prepare command**

Run: `npm run custom-made-gowns:prepare`

Expected: the command reads production, converts/validates local HEIC files, and writes the
manifest/review without Sanity mutations.

- [ ] **Step 3: Inspect the generated manifest mechanically**

Run:

```bash
jq '{target, totals, documentActions: (.documents | group_by(.action) | map({action: .[0].action, count: length})), appendCount: (.appends | length), ignored}' migrate/custom-made-gowns/generated/import-manifest.json
git status --short
```

Expected:

- target `yz23zros/production`;
- 20 documents, 86 new-document images, 9 append images, and 95 scoped images;
- two separate Odette entries;
- Karina 1 with zero assets and Karina 2 with four long assets;
- Lucy 1 with three pixie/eight hood assets and the hood price;
- exact Rhuby and Lily append IDs;
- only the approved ignored paths;
- no generated file in Git status.

- [ ] **Step 4: Review the human-readable report**

Read every title, public client name, location, price, description, photo count/field, action,
append target, and warning in `import-review.md`. Compare the report against the source folders
and the approved spec. Fix mapping or description source code and repeat prepare if anything is
wrong; never hand-edit the generated manifest.

- [ ] **Step 5: Stop for the required human approval gate**

Present the review report path and a concise totals/action summary to the user. Do not run the
import command until the user explicitly approves this generated manifest. A prior approval of
the design is not approval of the production mutations.

---

## Task 11: Apply and Validate After Manifest Approval

**Files:**

- Generate, ignored: `migrate/custom-made-gowns/generated/import-result.json`
- Generate, ignored: `migrate/custom-made-gowns/generated/import-validation.md`

- [ ] **Step 1: Confirm the approval applies to the current manifest hash**

Calculate and show:

```bash
shasum -a 1 migrate/custom-made-gowns/generated/import-manifest.json
```

If preparation is rerun or the hash changes after approval, stop and request approval again.

- [ ] **Step 2: Re-run focused tests immediately before mutation**

Run:

```bash
npm run custom-made-gowns:test
npm run prom-queens:test
```

Expected: PASS.

- [ ] **Step 3: Apply with the Sanity user token**

Run: `npm run custom-made-gowns:import`

Expected: immutable preflight passes, assets upload sequentially, 20 published documents are
created or safely resumed, two galleries receive only their missing images, and the result file
records every asset/document ID.

If any action fails, do not delete assets or documents and do not manually edit the result file.
Inspect the recorded failure, correct the cause, rerun prepare only if source or mapping changes,
obtain new approval if the manifest changes, and resume with the same apply command.

- [ ] **Step 4: Run uncached validation**

Run: `npm run custom-made-gowns:validate`

Expected: `import-validation.md` reports PASS for all 20 source IDs, 86 new-document asset
assignments, seven Rhuby additions, and two Lily additions.

- [ ] **Step 5: Run independent read-only spot queries**

Use `npx sanity documents query` or the CLI client to confirm:

- every result ID is a published `customMadeGowns` document;
- Karina 1 has no photo arrays;
- Karina 2 has four `longGownPicture` items;
- Lucy's prices and field counts match the approved mapping;
- both Odette result IDs exist and differ;
- the append target arrays contain all nine uploaded asset IDs.

- [ ] **Step 6: Report the outcome and cache status**

Provide created/updated counts, append counts, asset upload/reuse counts, result/report paths, and
validation status. If the webhook commit has not been deployed, state that Sanity is verified but
public storefront cache refresh remains pending deployment. Do not claim the public API is fresh
without verifying the deployed webhook or an uncached response.
