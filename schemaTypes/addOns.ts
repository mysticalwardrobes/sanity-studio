import { defineArrayMember, defineField, defineType } from 'sanity'

const addOnTypes = [
  'hood',
  'petticoat',
  'crown',
  'headpiece',
  'fan',
  'gloves',
  'mask',
  'necklace',
  'neck collar',
  'umbrella',
  'train',
  'wings',
].map((value) => ({
  title: value.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  value,
}))

export const addOnsType = defineType({
  name: 'addOns',
  title: 'Add Ons',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (rule) => rule.required() }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [defineArrayMember({ type: 'block' }), defineArrayMember({ type: 'image' })],
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: { list: addOnTypes, layout: 'dropdown' },
      validation: (rule) => rule.required().valid(...addOnTypes.map(({ value }) => value)),
    }),
    defineField({ name: 'metroManilaRate', title: 'Metro Manila Rate', type: 'number' }),
    defineField({ name: 'luzonRate', title: 'Luzon Rate', type: 'number' }),
    defineField({ name: 'outsideLuzonRate', title: 'Outside Luzon Rate', type: 'number' }),
    defineField({ name: 'forSaleRate', title: 'For Sale Rate', type: 'number' }),
    defineField({
      name: 'pictures',
      title: 'Pictures',
      type: 'array',
      of: [defineArrayMember({ type: 'image' })],
    }),
    defineField({ name: 'contentfulArchived', title: 'Contentful Archived', type: 'boolean', readOnly: true }),
  ],
})
