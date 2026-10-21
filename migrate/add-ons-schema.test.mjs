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

assert.ok(typeField.options.list.includes('neck collar'), 'neck collar is missing from options')
assert.equal(customRule('neck collar'), true, 'neck collar fails schema validation')
console.log('Add-on schema offers and accepts neck collar as a type')

for (const [value, title] of [['crown', 'Crowns & Headpieces'], ['headpiece', 'Handmade Headpieces'], ['wig', 'Wigs'], ['prop', 'Props']]) {
  assert.ok(typeField.options.list.some(option => option.value === value && option.title === title))
  assert.equal(customRule(value), true)
}
assert.notEqual(customRule('unknown-category'), true)
