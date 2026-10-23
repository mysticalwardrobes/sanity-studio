import assert from 'node:assert/strict'
import vm from 'node:vm'
import {build} from 'esbuild'

const result = await build({
  entryPoints: ['migrate/schema.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  write: false,
  plugins: [
    {
      name: 'sanity-schema-functions',
      setup(build) {
        build.onResolve({filter: /^sanity$/}, () => ({path: 'sanity', namespace: 'test'}))
        build.onLoad({filter: /.*/, namespace: 'test'}, () => ({
          contents: 'exports.defineField = value => value; exports.defineType = value => value',
          loader: 'js',
        }))
      },
    },
  ],
})

const module = {exports: {}}
vm.runInNewContext(result.outputFiles[0].text, {exports: module.exports, module})

const addOnsType = module.exports.addOnsType
const typeField = addOnsType.fields.find((field) => field.name === 'type')
const customRule = typeField.validation({custom: (validator) => validator})

const expected = [
  ['crown', 'Crowns & Headpieces'],
  ['headpiece', 'Handmade Headpieces'],
  ['wig', 'Wigs'],
  ['mask', 'Masks'],
  ['necklace', 'Neck Accessories'],
  ['gloves', 'Gloves'],
  ['fan', 'Fans'],
  ['umbrella', 'Umbrellas'],
  ['prop', 'Props'],
  ['petticoat', 'Petticoats'],
  ['hood', 'Hoods'],
  ['neck collar', 'Neck Collars'],
  ['train', 'Trains'],
  ['wings', 'Wings'],
  ['inner garment', 'Inner Garments'],
  ['outerwear', 'Outerwear'],
]
assert.deepEqual(
  JSON.parse(JSON.stringify(typeField.options.list)),
  expected.map(([value, title]) => ({title, value})),
)
for (const [value] of expected) {
  assert.equal(customRule(value), true, `${value} fails schema validation`)
}
assert.notEqual(customRule('unknown'), true)
console.log('Add-on schema offers and accepts all catalogue categories')
