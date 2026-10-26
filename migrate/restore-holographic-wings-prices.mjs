const {getCliClient} = await import('sanity/cli')

const client = getCliClient({apiVersion: '2026-01-01'})
const prices = [
  {name: 'Wings Holographic 1', metroManilaRate: 2490, luzonRate: 4990, outsideLuzonRate: 7990, forSaleRate: 11990},
  {name: 'Wings Holographic 2', metroManilaRate: 1990, luzonRate: 3990, outsideLuzonRate: 6990, forSaleRate: 9990},
]

for (const {name, ...rates} of prices) {
  const docs = await client.fetch('*[_type == "addOns" && name == $name]{_id,_rev,name,pictures}', {name}, {perspective: 'published'})
  if (docs.length !== 1) throw new Error(`Expected one add-on for ${name}; found ${docs.length}`)
  const doc = docs[0]
  const photosBefore = JSON.stringify(doc.pictures ?? [])
  await client.patch(doc._id).ifRevisionId(doc._rev).set(rates).commit()
  const updated = await client.getDocument(doc._id)
  if (Object.entries(rates).some(([field, value]) => updated[field] !== value) ||
      JSON.stringify(updated.pictures ?? []) !== photosBefore) {
    throw new Error(`${name} price or photo verification failed`)
  }
  console.log(`${name}: previous rates restored; ${updated.pictures?.length ?? 0} photos preserved`)
}
