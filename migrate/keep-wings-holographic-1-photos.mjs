const apply = process.argv.includes('--apply')
const documentId = '57d7f4e2-c3c7-4e48-bf4f-9b6dcf4ff937'
const expectedKeys = ['5f30bb8379ce', '881226e94513', '07584859bf27', 'c0130018c310', 'e32452e8e5a1']
const retainedKeys = [expectedKeys[0], expectedKeys[4]]

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
const doc = await client.getDocument(documentId)
if (!doc || doc._type !== 'addOns' || doc.name !== 'Wings Holographic 1') throw new Error('Add-on not found')
const currentKeys = (doc.pictures ?? []).map((image) => image._key)
if (JSON.stringify(currentKeys) !== JSON.stringify(expectedKeys) && JSON.stringify(currentKeys) !== JSON.stringify(retainedKeys)) {
  throw new Error(`Unexpected gallery order: ${currentKeys.join(', ')}`)
}
const retained = (doc.pictures ?? []).filter((image) => retainedKeys.includes(image._key))
console.log(`Wings Holographic 1: ${currentKeys.length} photos; keeping original photos 1 and 5`)
if (!apply || JSON.stringify(currentKeys) === JSON.stringify(retainedKeys)) process.exit(0)

await client.patch(documentId).set({pictures: retained}).commit()
const updated = await client.getDocument(documentId)
const updatedKeys = (updated.pictures ?? []).map((image) => image._key)
if (JSON.stringify(updatedKeys) !== JSON.stringify(retainedKeys) ||
    updated.pictures.some((image, index) => image.asset?._ref !== retained[index].asset?._ref)) {
  throw new Error('Wings Holographic 1 photo verification failed')
}
console.log('Updated gallery: only photos 1 and 5 remain in their original order')
