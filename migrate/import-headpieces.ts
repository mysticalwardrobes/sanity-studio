import {getCliClient} from 'sanity/cli'
import {createReadStream} from 'node:fs'
import {readdir} from 'node:fs/promises'
import path from 'node:path'

const client = getCliClient({apiVersion: '2026-01-01'})
const sourceRoot = path.resolve(process.cwd(), '..', 'Add Ons')

const products = [
  ['T1', 1390, 2390, 2890, 8990, 'A dramatic burgundy headpiece with rich floral embroidery, gold floral embellishments, red crystal accents, and a flowing matching veil.'],
  ['T2', 1490, 2490, 2990, 8990, 'A regal charcoal headpiece with ornate gold trim, pearl edging, a white ruffled frame, jeweled detailing, and an elegant trailing veil.'],
  ['T3', 990, 1690, 2190, 7990, 'An ethereal ivory headpiece finished with delicate gold lace trim, rows of pearl-like beads, and crystal teardrop accents for a luminous look.'],
  ['T4', 990, 1690, 2190, 7990, 'A romantic blush-pink headpiece layered with floral lace, pearl strands, rose-toned crystals, jeweled chains, and a decorative beaded front band.'],
  ['T5', 890, 1590, 1990, 7990, 'A deep navy headpiece with a sapphire-toned center jewel, pearl edging, crystal-and-pearl fringe, and a sheer embroidered veil for a refined finish.'],
  ['T6', 890, 1590, 1990, 7990, 'A royal purple headpiece decorated with gold flower motifs, iridescent crystals, a purple centerpiece, and a delicate jeweled chain that drapes across the face.'],
] as const

const portableText = (text: string) => [{
  _key: 'description',
  _type: 'block',
  children: [{_key: 'text', _type: 'span', marks: [], text}],
  markDefs: [],
  style: 'normal',
}]

for (const [folder, metroManilaRate, luzonRate, outsideLuzonRate, forSaleRate, description] of products) {
  const folderPath = path.join(sourceRoot, folder)
  const files = (await readdir(folderPath)).filter((file) => /\.(jpe?g|png|webp)$/i.test(file)).sort()
  const pictures = []

  for (const file of files) {
    const asset = await client.assets.upload('image', createReadStream(path.join(folderPath, file)), {filename: file})
    pictures.push({_key: file.replace(/[^a-zA-Z0-9]/g, '-'), _type: 'image', asset: {_type: 'reference', _ref: asset._id}})
  }

  await client.createOrReplace({
    _id: `headpiece-${folder.toLowerCase()}`,
    _type: 'addOns',
    name: folder,
    description: portableText(description),
    type: 'headpiece',
    metroManilaRate,
    luzonRate,
    outsideLuzonRate,
    forSaleRate,
    pictures,
  })

  console.log(`Imported ${folder}: ${pictures.length} images`)
}
