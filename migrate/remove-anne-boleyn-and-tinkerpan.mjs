// Removes both live catalog documents and their legacy gown counterparts.
// Legacy related-gown references are cleaned before deletion in one transaction.
const apply = process.argv.includes('--apply')
const targets = [
  {_id: 'gown-temp-anne-boleyn', _type: 'gown_temp', name: 'Anne Boleyn'},
  {_id: 'gown-temp-tinkerpan', _type: 'gown_temp', name: 'Tinkerpan'},
  {_id: '6xeHr4BBMJJyL3qu8RY2VS', _type: 'gown', name: 'Anne Boleyn'},
  {_id: '1nmo43cfAByNF8M0DyVVuo', _type: 'gown', name: 'Tinkerpan'},
]
const ids = targets.map(({_id}) => _id)
const legacyIds = new Set(ids.slice(2))
const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})

const documents = await Promise.all(ids.map((id) => client.getDocument(id)))
for (const [index, doc] of documents.entries()) {
  if (doc && (doc._type !== targets[index]._type || doc.name !== targets[index].name)) {
    throw new Error(`Unexpected document at ${ids[index]}`)
  }
}
const referencers = await client.fetch('*[references($ids)]{_id,_type,name,relatedGowns}', {ids})
for (const doc of referencers) {
  if (ids.includes(doc._id)) continue
  const matching = (doc.relatedGowns ?? []).filter((item) => legacyIds.has(item._ref))
  if (!matching.length || doc._type !== 'gown') throw new Error(`Unexpected reference to target from ${doc._id}`)
  // Ensure every matching reference belongs to relatedGowns, not another field.
  const all = await client.getDocument(doc._id)
  const outsideRelated = {...all, relatedGowns: []}
  for (const id of ids) {
    if (JSON.stringify(outsideRelated).includes(`"_ref":"${id}"`)) {
      throw new Error(`Reference outside relatedGowns on ${doc._id}`)
    }
  }
}
console.log(`Found ${documents.filter(Boolean).length} gown documents and ${referencers.filter((doc) => !ids.includes(doc._id)).length} legacy related-gown references to remove`)
if (!apply) process.exit(0)

const transaction = client.transaction()
for (const doc of referencers) {
  if (ids.includes(doc._id)) continue
  const remaining = (doc.relatedGowns ?? []).filter((item) => !legacyIds.has(item._ref))
  transaction.patch(doc._id, (patch) => patch.set({relatedGowns: remaining}))
}
for (const doc of documents) if (doc) transaction.delete(doc._id)
await transaction.commit()

const remaining = await client.fetch('*[_id in $ids]{_id}', {ids})
const dangling = await client.fetch('*[references($ids)]{_id}', {ids})
if (remaining.length || dangling.length) throw new Error(`Removal verification failed: ${remaining.length} gowns, ${dangling.length} references remain`)
console.log('Removed Anne Boleyn and Tinkerpan from both catalog and legacy Sanity records; related references cleared')
