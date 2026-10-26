const {getCliClient} = await import('sanity/cli')

const client = getCliClient({apiVersion: '2026-01-01'})
const documentId = 'gown-temp-eleanor'
const restoredPhoto = {
  _type: 'image',
  _key: 'eleanor-pixie-5',
  asset: {
    _type: 'reference',
    _ref: 'image-901361744c1bf43c52c1f6075b7bdd14b6c74295-4000x6000-jpg',
  },
}

const doc = await client.getDocument(documentId)
if (!doc || doc._type !== 'gown_temp' || doc.name !== 'Eleanor') throw new Error('Eleanor document not found')
const pictures = doc.pixiePicture ?? []
const existing = pictures.find((picture) => picture._key === restoredPhoto._key || picture.asset?._ref === restoredPhoto.asset._ref)
if (existing) {
  if (existing._key !== restoredPhoto._key || existing.asset?._ref !== restoredPhoto.asset._ref) throw new Error('Original fifth photo conflicts with an existing gallery entry')
  console.log('Eleanor original fifth Pixie photo is already restored')
  process.exit(0)
}
if (pictures.length < 6 || pictures[0]._key !== '09fd86c91568' || pictures[5]._key !== 'eleanor-pixie-1') {
  throw new Error('Eleanor gallery has changed unexpectedly; review before restoring')
}
const asset = await client.getDocument(restoredPhoto.asset._ref)
if (!asset || asset.originalFilename !== 'DSC09713.jpg') throw new Error('Original fifth photo asset is missing')

const updatedPictures = [...pictures.slice(0, 5), restoredPhoto, ...pictures.slice(5)]
await client.patch(documentId).ifRevisionId(doc._rev).set({pixiePicture: updatedPictures}).commit()
const updated = await client.getDocument(documentId)
if (updated.pixiePicture?.length !== pictures.length + 1 ||
    JSON.stringify(updated.pixiePicture?.filter((picture) => picture._key !== restoredPhoto._key)) !== JSON.stringify(pictures) ||
    updated.pixiePicture[5]?.asset?._ref !== restoredPhoto.asset._ref ||
    JSON.stringify(updated.longGownPicture ?? []) !== JSON.stringify(doc.longGownPicture ?? [])) {
  throw new Error('Eleanor gallery verification failed')
}
console.log(`Restored Eleanor original fifth Pixie photo (${asset.originalFilename}); ${updated.pixiePicture.length} total Pixie photos`)
