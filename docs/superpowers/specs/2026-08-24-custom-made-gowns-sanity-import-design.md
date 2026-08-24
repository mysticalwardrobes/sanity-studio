# Custom-Made Gowns Sanity Import Design

Date: 2026-08-24

## Goal

Import the 20 rows in `custom made gowns info - Sheet1.csv` as published
`customMadeGowns` documents in Sanity project `yz23zros`, dataset `production`. Upload the
matching local photos, generate a concise Portable Text description for each new gown, and
append two approved photo sets to existing custom-made gown documents.

The importer must support dry runs and safe reruns. It must not read or mutate `gown` or
`gown_temp` documents.

## Source Inventory

### Structured content

The CSV contains 20 rows and these columns:

- `Client - include 1st name only`
- `NEW GOWNS`
- `Description`
- `Long Gown`
- `Pixie `
- `Hood and Capelet`
- `Location`

The description column instructs the importer to generate descriptions. The CSV has no
`gownFor` or flowy-gown fields.

### Media

The main media source is `Website Update_PerGown - Custom Made Gowns`. The import also uses
the approved custom-made gown photos under `Additional Photos/Custom Made Order`.

The scoped import contains 95 images:

- 86 images for the 20 CSV records
- 7 images to append to Rhuby's existing `Pink Simple Hood` document
- 2 images to append to Lily's existing `Starry Fairytale` document

The source set contains 15 HEIC files, one PNG file, and 79 JPEG files. The importer ignores
`.DS_Store` files and the Kishi Abuhat MOV. It also ignores the six
`Nicola - Lilibeth inspired` photos because Lilibeth belongs to the regular gown catalogue.

### Existing destination content

The production dataset contained 26 published `customMadeGowns` documents during discovery.
None matched a CSV row by normalized title and client name. The apply phase must repeat this
query because editors can change the dataset between preparation and import.

## Approved Record Mapping

| CSV gown | Public client name | Long | Pixie | Hood | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| Victorian White Gown | Mira | 6 | 0 | 0 | Main folder |
| Celestial Starry Night | Kathleen | 3 | 3 | 0 | Photos classified by visible gown length |
| Simple Ethereal Debut Gown | Cheryl | 5 | 0 | 0 | Main folder |
| Laufey Pixie Dress | Kyle | 0 | 4 | 0 | Main folder |
| Red Velvet and Black Bridgerton Dress | L!Z | 2 | 0 | 0 | Convert HEIC files |
| Clara and Ariel Debut with Trail | Lou | 5 | 0 | 0 | Main folder |
| Pixie Moonbeam | Lucy | 0 | 3 | 8 | Folder structure overrides the CSV; hood price is PHP 8,990 |
| Pixie Shooting Star | Lucy | 0 | 4 | 0 | No hood price or hood photos |
| Pink Coquette Victorian Gown | mm | 4 | 0 | 0 | Main folder |
| Giselle Gown | Onnie | 2 | 0 | 0 | Main folder |
| Enchanted | Rache | 3 | 0 | 0 | Main folder |
| Bridgerton Blue Gown | Rhuby | 4 | 0 | 0 | Main folder |
| Odette Inspired Gown, record 1 | SOFT PLAY & BALL PIT HIRE | 5 | 0 | 0 | Preserve separate CSV record |
| Odette Inspired Gown, record 2 | SOFT PLAY & BALL PIT HIRE | 5 | 0 | 0 | Preserve separate CSV record |
| Purple Victorian Gown | yukiyahsway | 5 | 0 | 0 | Main folder |
| Elegant White and Gold Bridgerton Gown | Misa | 3 | 0 | 0 | Main folder |
| Red Flowy Dress | Raychelle | 3 | 0 | 0 | Store in the long-gown field because the CSV supplies a long-gown price |
| Courtney Debut Gown | Liz | 5 | 0 | 0 | Supplemental folder |
| Karina 1 | Liz | 0 | 0 | 0 | Publish without photos for now |
| Karina 2 | Liz | 4 | 0 | 0 | Supplemental Karina folder belongs only to this record |

The two Odette rows share a title and client. The importer must treat their source row numbers
as separate identities during preparation. Before apply, the review manifest must show that
the script plans two creates. On reruns, the result report must retain their created document
IDs so the script can update each record without relying on the non-unique title and client
pair.

## Field Mapping

| Source | Sanity field | Transform |
| --- | --- | --- |
| `NEW GOWNS` | `title` | Trim outer whitespace and preserve the CSV title, including Karina suffixes |
| Client column | `clientName` | Use the approved public first name or handle |
| `Location` | `location` | Trim outer and repeated whitespace |
| `Long Gown` | `preOrderPrice` | Remove currency symbols, commas, and decimals; store integer pesos |
| `Pixie ` | `pixiePreOrderPrice` | Apply the same price transform; omit empty values |
| `Hood and Capelet` | `hoodPreOrderPrice` | Apply the same price transform, with the Lucy override |
| Generated copy | `description` | One Portable Text block containing one factual paragraph |
| Long photo assignment | `longGownPicture` | Array of file asset references |
| Pixie photo assignment | `pixiePicture` | Array of file asset references |
| Hood photo assignment | `hoodPicture` | Array of file asset references |

The importer omits `gownFor`, `flowyPreOrderPrice`, and `flowyPictures`. It does not write
empty strings, `null` values, or empty image arrays.

The current Sanity schema defines the three relevant photo arrays as `file` arrays. This
migration preserves that contract and requires no schema or frontend query change.

## Description Rules

During implementation, inspect each assigned photo set and write one paragraph in a versioned
description mapping file. Each paragraph may describe color, silhouette, fabric appearance,
embellishments, sleeves, draping, layers, and matching hood or capelet pieces. This keeps reruns
deterministic and avoids a runtime dependency on a text-generation service.

The copy must not invent an event, client request, fabric composition, construction method,
character license, or design inspiration that the title or photos do not support. The
preparation report includes every mapped description for human review before publication.

The importer stores each description as a Portable Text array with one `block`, one `span`,
stable `_key` values, `style: "normal"`, and empty `marks` and `markDefs` arrays.

## Import Architecture

Add a `migrate/custom-made-gowns` module to `mysticalwardrobes-sanity`. Follow the existing
prom-queens prepare/apply command structure, while keeping custom-made gown parsing and mapping
in separate tested modules.

### Prepare command

The prepare command performs these operations without Sanity mutations:

1. Parse the CSV and require 20 data rows with the expected headers.
2. Normalize text and prices, then apply the approved Lucy and client-name overrides.
3. Inventory both photo roots and assign each file to a document field.
4. Render HEIC files through Quick Look, convert the rendered output to JPEG, and validate the
   result with Sharp.
5. Validate direct JPEG and PNG files, calculate SHA-1 hashes, and read image dimensions.
6. Load the curated description mapping and create Portable Text blocks with stable array keys.
7. Query published `customMadeGowns` documents to classify creates, rerun updates, and the two
   approved appends.
8. Write a manifest and a readable review report under
   `migrate/custom-made-gowns/generated`.

The repository must ignore the generated directory. The manifest records the project, dataset,
source paths, CSV file hash, generation time, source row number, normalized content, local image
hashes, field assignments, intended action, and any warning.

Preparation fails on an unexpected CSV header, row-count change, invalid price, missing required
title, unapproved media folder, unreadable image, blank conversion, duplicate local file, or
unresolved mapping. `Karina 1` has an approved zero-photo exception.

### Apply command

The apply command requires both `--apply` and a Sanity user token. It performs these checks
before the first mutation:

- The manifest targets `yz23zros/production`.
- The current CSV hash matches the manifest.
- Each local upload file matches its recorded hash.
- The manifest contains 20 CSV records and 95 scoped images.
- A fresh GROQ query does not reveal an unreviewed title/client collision.
- Existing append targets still match the recorded document ID, title, and client name.

The script uploads assets with low concurrency and records each returned asset ID. It creates
published documents with Sanity-generated IDs. The result file stores the source row to document
ID mapping, which disambiguates the two Odette records on reruns.

For a new document, the script uploads all assigned assets before it creates the document. For
an append, it compares existing asset references with the prepared hashes and appends missing
references in source order. Sanity may retain uploaded assets after a later document mutation
fails. A rerun reuses those assets and resumes from the result file.

The script stops after an error and writes the completed and failed actions to the result file.
It does not delete documents, replace an existing gallery, or remove assets.

## Existing Document Appends

The apply phase permits these two append targets:

| Source folder | Required destination match | Field | Added photos |
| --- | --- | --- | ---: |
| `Rhuby Pink` | `Pink Simple Hood` and client `Rhuby` | `longGownPicture` | 7 |
| `Lily` | `Starry Fairytale` and client `Lily` | `longGownPicture` | 2 |

The script skips an append if either the title or client no longer matches. It reports the
mismatch and makes no mutation to that document.

## Image Ordering and Conversion

Files named `Cover`, `LCover`, `PCover`, or `HCover` sort first within their assigned field.
Remaining files keep a stable natural filename order. The importer places the explicit cover at
index zero and preserves existing asset order during appends.

The script uploads JPEG and PNG sources without resizing. It converts HEIC sources to sRGB JPEG
at quality 92 after Quick Look renders the source. Validation requires readable dimensions and
non-trivial image entropy. The script ignores videos for this migration.

## Storefront Cache Handling

The storefront Sanity webhook does not accept `customMadeGowns` events. Add that document type
to the webhook contract. On a matching event, the route must:

- Delete `custom-made-gowns:*` and `custom-made-gown:*` Redis keys.
- Revalidate `/custom-made-gowns` and `/api/custom-made-gowns`.
- Revalidate `/custom-made-gowns/{id}` when the payload includes an ID.

Add a regression test for the supported-type and cache-pattern behavior. The webhook patch must
reach the deployed storefront before the import can guarantee a fresh public API response. If it
has not reached production, the final report must mark storefront cache verification as pending
while still verifying Sanity through uncached GROQ queries.

## Validation

The importer writes preparation and apply summaries with source counts, action counts, skips,
warnings, uploaded assets, and document IDs.

After apply, validation runs uncached GROQ queries and checks:

- The importer represented all 20 CSV source rows.
- The dataset contains the 20 recorded document IDs as published `customMadeGowns` documents.
- Each created document matches its normalized title, client, location, prices, and description.
- Image references resolve to assets and match the approved field counts in the mapping table.
- `Karina 1` has no photo fields.
- `Pink Simple Hood` gained seven unique references and `Starry Fairytale` gained two.
- No created document references a regular `gown` or `gown_temp` document.
- The importer introduced no unintended duplicate document IDs or repeated asset references.

Run focused unit tests before preparation and again before apply. After the webhook code change,
run the storefront test suite. The final report includes any build or lint commands the user
chooses to run; content verification does not depend on those commands.

## Cutover and Recovery

This import has no locales, redirects, rich-text conversion, or legacy URL cutover. The CSV and
local photo folders serve as the source snapshot. The user reviews the mapped descriptions,
field assignments, create list, and append list before authorizing apply.

The apply operation only creates documents and appends asset references. Recovery uses the result
file to identify created document IDs and appended references. The script does not automate
rollback because removing published content and references requires a separate destructive action
and explicit user approval.

## Out of Scope

- Regular `gown` and `gown_temp` documents
- Nicola/Lilibeth photos
- The Kishi Abuhat MOV or video fields
- Sanity schema redesign
- Changes to existing custom-made gown text or prices
- Deletion, replacement, or reordering of existing gallery assets
