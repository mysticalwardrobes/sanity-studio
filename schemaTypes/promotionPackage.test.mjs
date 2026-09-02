import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'
import {build} from 'esbuild'

async function loadPromotionPackageType() {
  const result = await build({
    entryPoints: ['schemaTypes/promotionPackage.ts'],
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
            contents:
              'exports.defineArrayMember = value => value; exports.defineField = value => value; exports.defineType = value => value',
            loader: 'js',
          }))
          build.onResolve({filter: /^@sanity\/icons\//}, () => ({
            path: 'sanity-icon',
            namespace: 'test',
          }))
          build.onLoad({filter: /sanity-icon/, namespace: 'test'}, () => ({
            contents: 'exports.TagIcon = function TagIcon() {}',
            loader: 'js',
          }))
        },
      },
    ],
  })

  const module = {exports: {}}
  vm.runInNewContext(result.outputFiles[0].text, {exports: module.exports, module})
  return module.exports.promotionPackageType
}

function createTextRule() {
  let required = false
  let maximum

  return {
    required() {
      required = true
      return this
    },
    max(value) {
      maximum = value
      return this
    },
    validate(value) {
      if (required && !value) return false
      return maximum === undefined || value.length <= maximum
    },
  }
}

test('package summary accepts 600 characters and rejects 601', async () => {
  const promotionPackageType = await loadPromotionPackageType()
  const summaryField = promotionPackageType.fields.find((field) => field.name === 'summary')
  const rule = summaryField.validation(createTextRule())

  assert.equal(rule.validate('a'.repeat(600)), true)
  assert.equal(rule.validate('a'.repeat(601)), false)
})
