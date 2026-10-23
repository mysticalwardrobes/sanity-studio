// Restore Elowen's Pixie gallery from the Sanity revision before our photo edits.
// The Long and Filipiniana galleries were not changed by those edits.
const apply = process.argv.includes('--apply')
const original = [
  ['elowen-pixie-1', 'image-1d3daf9b16917f547688152406110e8f9e88634a-3930x5895-jpg'],
  ['elowen-pixie-2', 'image-789b14a7155212b455d2a390111c61df0b4990c0-4000x6000-jpg'],
  ['elowen-pixie-3', 'image-b34511544e3ed97ff73e7e564dcad473816b9100-4000x6000-jpg'],
  ['elowen-pixie-4', 'image-b694f0844bb50bc6522e26564278f673530355b5-4000x6000-jpg'],
  ['elowen-pixie-5', 'image-33af1b5361d504826538a2946daea801e7d5a052-4000x6000-jpg'],
  ['elowen-pixie-6', 'image-8e04c0ac2ca86bdf8ffe1805c9de9c25fca47119-3891x5837-jpg'],
].map(([_key, _ref]) => ({_type: 'image', _key, asset: {_type: 'reference', _ref}}))
const galleryIds = (gallery) => (gallery ?? []).map((image) => `${image._key}:${image.asset?._ref}`)

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument('gown-temp-elowen')
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Elowen') throw new Error('Elowen gown not found')
const beforeLong = JSON.stringify(doc.longGownPicture ?? [])
const beforeFilipiniana = JSON.stringify(doc.filipinianaPicture ?? [])
const same = JSON.stringify(galleryIds(doc.pixiePicture)) === JSON.stringify(galleryIds(original))
console.log(`Elowen Pixie gallery: ${doc.pixiePicture?.length ?? 0} photos; original: ${original.length}; already restored: ${same}`)
if (!apply || same) process.exit(0)

await client.patch(doc._id).set({pixiePicture: original}).commit()
const updated = await client.getDocument(doc._id)
if (JSON.stringify(galleryIds(updated.pixiePicture)) !== JSON.stringify(galleryIds(original)) ||
    JSON.stringify(updated.longGownPicture ?? []) !== beforeLong ||
    JSON.stringify(updated.filipinianaPicture ?? []) !== beforeFilipiniana) {
  throw new Error('Elowen photo restoration verification failed')
}
console.log('Restored all 6 original Elowen Pixie photos in their original order; other galleries unchanged')
