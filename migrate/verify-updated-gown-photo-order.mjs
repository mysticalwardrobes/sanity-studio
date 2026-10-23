import {readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import path from 'node:path'

const root = path.resolve(process.cwd(), '..', 'Rush Website Update', 'GOWN RENTALS', 'Photo andor details Updates')
const galleries = [
  ['Astrid', 'Pixie Version', 'pixiePicture', 'Astrid/Pixie Version'],
  ['Beetle', '', 'longGownPicture', 'Beetle'],
  ['Belle', '', 'longGownPicture', 'Belle'],
  ['Charlotte', '', 'longGownPicture', 'Charlotte'],
  ['Eclipse', '', 'pixiePicture', 'Eclipse'],
  ['Eleanor', '', 'pixiePicture', 'Eleanor'],
  ['Elowen', '', 'pixiePicture', 'Elowen/Pixie'],
  ['Ember', '', 'longGownPicture', 'Ember/Long'],
  ['Gothel', '', 'longGownPicture', 'Gothel/Long'],
  ['Ivory', 'Long Version', 'longGownPicture', 'Ivory/Long Version'],
  ['Ivory', 'Pixie Version', 'pixiePicture', 'Ivory/Pixie Version'],
  ['Lucia', 'Long Version', 'longGownPicture', 'Lucia/Long Version'],
  ['Lucia', 'Pixie Version', 'pixiePicture', 'Lucia/Pixie Version'],
  ['Margareth', '', 'longGownPicture', 'Margareth/Long'],
  ['Scarlet Nova', '', 'pixiePicture', 'Scarlet Nova/Pixie'],
  ['Silvermist', '', 'pixiePicture', 'Silvermist/Pixie'],
  ['Starbound', '', 'longGownPicture', 'Starbound/Long'],
  ['Tinkermist', '', 'pixiePicture', 'Tinkermist/Pixie'],
  ['Tinkerose', '', 'pixiePicture', 'Tinkerose/Pixie'],
  ['Penelope', '', 'longGownPicture', 'Penelope/Long'],
  ['Giselle', '', 'longGownPicture', 'Giselle/Long'],
  ['Coraline', '', 'longGownPicture', 'Coraline/Long'],
  ['Pearl', '', 'longGownPicture', 'Pearl/Long'],
  ['Drama', '', 'longGownPicture', 'Drama/Long'],
]

const {getCliClient} = await import('sanity/cli')
const client = getCliClient({apiVersion: '2026-01-01'})
for (const [name, folder, field, keyPrefix] of galleries) {
  let filenames = (await readdir(path.join(root, name, folder))).filter((filename) => /\.(jpe?g|png|webp)$/i.test(filename))
  if (name === 'Ember') filenames = filenames.filter((filename) => filename !== 'DSC02672(1).jpg') // Duplicate of DSC02672.jpg.
  if (name === 'Giselle') filenames = filenames.filter((filename) => !filename.startsWith('DYB')) // Outside the annotated five-photo set.
  filenames.sort((a, b) => Number(!/^cover\./i.test(a)) - Number(!/^cover\./i.test(b)) || a.localeCompare(b))
  const expectedKeys = filenames.map((filename) => createHash('sha1').update(`${keyPrefix}/${filename}`).digest('hex').slice(0, 12))
  const doc = await client.getDocument(`gown-temp-${name.toLowerCase().replaceAll(' ', '-')}`)
  if (!doc) throw new Error(`Missing gown: ${name}`)
  const actualKeys = (doc[field] ?? []).map((image) => image._key)
  if (JSON.stringify(actualKeys.slice(0, expectedKeys.length)) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${name} ${field}: new photos are not a contiguous prefix in cover-first order`)
  }
  console.log(`${name} ${field}: ${expectedKeys.length} new photos first, ${actualKeys.length - expectedKeys.length} retained photos after`)
}

const sleepingBeauty = await client.getDocument('3d91b304-012c-4725-92ff-8fd64056c5b5')
if (!sleepingBeauty) throw new Error('Missing Sleeping Beauty gown')
const sleepingLongNames = ['325435.jpg', 'DSC00309.jpg', 'DSC00318.jpg', 'DSC00322 (2).jpg']
const sleepingLongKeys = sleepingLongNames.map((filename) => createHash('sha1').update(`Sleeping Beauty/Long Version/${filename}`).digest('hex').slice(0, 12))
const expectedLongKeys = ['sleeping-beauty-long-1', ...sleepingLongKeys, 'sleeping-beauty-long-3', 'sleeping-beauty-long-4']
const actualLongKeys = (sleepingBeauty.longGownPicture ?? []).map((image) => image._key)
if (JSON.stringify(actualLongKeys) !== JSON.stringify(expectedLongKeys)) throw new Error('Sleeping Beauty Long photo order mismatch')
const sleepingPixieNames = ['Cover.jpg', 'DSC03589.jpg', 'DSC03591.jpg', 'DSC03592.jpg', 'DSC03593.jpg']
const expectedPixieKeys = sleepingPixieNames.map((filename) => createHash('sha1').update(`Sleeping Beauty/Pixie/${filename}`).digest('hex').slice(0, 12))
const actualPixieKeys = (sleepingBeauty.pixiePicture ?? []).map((image) => image._key)
if (JSON.stringify(actualPixieKeys) !== JSON.stringify(expectedPixieKeys)) throw new Error('Sleeping Beauty Pixie photo order mismatch')
console.log('Sleeping Beauty: original Long cover, four new Long photos, two retained Long photos; five new Pixie photos')
