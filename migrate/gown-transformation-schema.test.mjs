import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {build} from 'esbuild'

async function loadGownTransformationType() {
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
  return module.exports.gownTransformationType
}

test('current gown references the V2 gown document type', async () => {
  const gownTransformationType = await loadGownTransformationType()
  const currentGownField = gownTransformationType.fields.find((field) => field.name === 'currentGown')

  assert.equal(currentGownField.to.length, 1)
  assert.equal(currentGownField.to[0].type, 'gown_temp')
})

test('thumbnail image number is an optional integer with a minimum of one', async () => {
  const gownTransformationType = await loadGownTransformationType()
  const fields = gownTransformationType.fields
  const currentGownIndex = fields.findIndex((field) => field.name === 'currentGown')
  const thumbnailField = fields[currentGownIndex + 1]
  const validationCalls = []
  const rule = {
    integer() {
      validationCalls.push('integer')
      return this
    },
    min(value) {
      validationCalls.push(['min', value])
      return this
    },
  }

  assert.equal(thumbnailField.name, 'thumbnailImageNumber')
  assert.equal(thumbnailField.type, 'number')
  thumbnailField.validation(rule)
  assert.deepEqual(validationCalls, ['integer', ['min', 1]])
})
