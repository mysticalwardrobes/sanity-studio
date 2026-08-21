import {ImagesIcon} from '@sanity/icons/Images'
import {PackageIcon} from '@sanity/icons/Package'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {
  asSanityList,
  gownV2EligibilityOptions,
  rentalTierEligibilityOptions,
} from './gownV2Eligibility'

const selectionModeOptions = [
  {title: 'Select individual products', value: 'manual'},
  {title: 'Select products with filters', value: 'filters'},
]

const gownSortOptions = [
  {title: 'Most Popular', value: 'most-popular'},
  {title: 'New to Old', value: 'new-to-old'},
  {title: 'Old to New', value: 'old-to-new'},
  {title: 'Name A–Z', value: 'name'},
  {title: 'Name Z–A', value: 'name-desc'},
  {title: 'Price: Low to High', value: 'price-low-high'},
  {title: 'Price: High to Low', value: 'price-high-low'},
]

const addOnSortOptions = [
  {title: 'Name A–Z', value: 'name'},
  {title: 'Price: Low to High', value: 'price-low-high'},
  {title: 'Price: High to Low', value: 'price-high-low'},
]

const addOnTypeOptions = [
  'hood',
  'petticoat',
  'crown',
  'fan',
  'gloves',
  'mask',
  'necklace',
  'umbrella',
  'train',
  'wings',
].map((value) => ({
  title: value.replace(/\b\w/g, (letter) => letter.toUpperCase()),
  value,
}))

const isMode = (parent: unknown, mode: 'manual' | 'filters') =>
  (parent as {selectionMode?: string} | undefined)?.selectionMode === mode

const priceRangeValidation = (value: unknown) => {
  const filters = value as {minPrice?: number; maxPrice?: number} | undefined
  if (
    typeof filters?.minPrice === 'number' &&
    typeof filters.maxPrice === 'number' &&
    filters.minPrice > filters.maxPrice
  ) {
    return 'Minimum price cannot be greater than maximum price'
  }
  return true
}

const arrayFilter = (name: string, title: string, options: readonly {title: string; value: string}[]) =>
  defineField({
    name,
    title,
    type: 'array',
    of: [defineArrayMember({type: 'string'})],
    options: {list: [...options]},
    validation: (rule) => rule.unique(),
  })

const galleryPresentationFields = (sortOptions: {title: string; value: string}[]) => [
  defineField({
    name: 'sortBy',
    title: 'Product order',
    type: 'string',
    hidden: ({parent}) => !isMode(parent, 'filters'),
    options: {list: sortOptions},
    validation: (rule) =>
      rule.custom((value, context) =>
        isMode(context.parent, 'filters') && !value ? 'Choose a product order' : true,
      ),
  }),
  defineField({
    name: 'limit',
    title: 'Number of products',
    type: 'number',
    description: 'Show between 1 and 12 products.',
    hidden: ({parent}) => !isMode(parent, 'filters'),
    validation: (rule) =>
      rule.integer().min(1).max(12).custom((value, context) =>
        isMode(context.parent, 'filters') && typeof value !== 'number'
          ? 'Enter the number of products to show'
          : true,
      ),
  }),
  defineField({
    name: 'showViewAll',
    title: 'Show View All button',
    type: 'boolean',
    hidden: ({parent}) => !isMode(parent, 'filters'),
    description: 'Links to the catalogue with these filters and ordering applied.',
  }),
  defineField({
    name: 'showPrice',
    title: 'Show prices',
    type: 'boolean',
    description: 'Gowns use the active package price when applicable; add-ons use Metro Manila rates.',
  }),
]

export const promotionGownGalleryType = defineType({
  name: 'promotionGownGallery',
  title: 'Gown Gallery',
  type: 'object',
  icon: ImagesIcon,
  initialValue: {
    selectionMode: 'filters',
    sortBy: 'most-popular',
    limit: 6,
    showPrice: true,
    showViewAll: false,
  },
  fields: [
    defineField({
      name: 'selectionMode',
      title: 'Select products by',
      type: 'string',
      options: {layout: 'radio', list: selectionModeOptions},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'selectedGowns',
      title: 'Selected gowns',
      type: 'array',
      hidden: ({parent}) => !isMode(parent, 'manual'),
      description: 'Drag the references into the order they should appear.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'gown_temp'}]})],
      validation: (rule) =>
        rule.unique().max(12).custom((value, context) =>
          isMode(context.parent, 'manual') && (!Array.isArray(value) || value.length === 0)
            ? 'Select at least one gown'
            : true,
        ),
    }),
    defineField({
      name: 'filters',
      title: 'Gown filters',
      type: 'object',
      hidden: ({parent}) => !isMode(parent, 'filters'),
      description: 'Selections match any value within a group and every populated group.',
      fields: [
        arrayFilter('gownFeatures', 'Collection', asSanityList(gownV2EligibilityOptions.gownFeatures)),
        arrayFilter('wardrobeFeatures', 'Skirt styles and features', asSanityList(gownV2EligibilityOptions.wardrobeFeatures)),
        arrayFilter('rentalTiers', 'Rental tiers', rentalTierEligibilityOptions),
        arrayFilter('tags', 'Tags', asSanityList(gownV2EligibilityOptions.tags)),
        arrayFilter('colors', 'Colors', asSanityList(gownV2EligibilityOptions.colors)),
        arrayFilter('bestFor', 'Best for', asSanityList(gownV2EligibilityOptions.bestFor)),
        defineField({name: 'minPrice', title: 'Minimum Metro Manila price', type: 'number', validation: (rule) => rule.min(0)}),
        defineField({name: 'maxPrice', title: 'Maximum Metro Manila price', type: 'number', validation: (rule) => rule.min(0)}),
      ],
      validation: (rule) => rule.custom(priceRangeValidation),
    }),
    ...galleryPresentationFields(gownSortOptions),
  ],
  preview: {
    select: {mode: 'selectionMode', selected: 'selectedGowns', limit: 'limit', sortBy: 'sortBy'},
    prepare({mode, selected, limit, sortBy}) {
      const count = mode === 'manual' && Array.isArray(selected) ? selected.length : limit || 6
      return {
        title: 'Gown Gallery',
        subtitle: mode === 'manual' ? `${count} selected gown${count === 1 ? '' : 's'}` : `${count} gowns · ${sortBy || 'most-popular'}`,
        media: ImagesIcon,
      }
    },
  },
})

export const promotionAddOnGalleryType = defineType({
  name: 'promotionAddOnGallery',
  title: 'Add-on Gallery',
  type: 'object',
  icon: PackageIcon,
  initialValue: {
    selectionMode: 'filters',
    sortBy: 'name',
    limit: 6,
    showPrice: true,
    showViewAll: false,
  },
  fields: [
    defineField({
      name: 'selectionMode',
      title: 'Select products by',
      type: 'string',
      options: {layout: 'radio', list: selectionModeOptions},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'selectedAddOns',
      title: 'Selected add-ons',
      type: 'array',
      hidden: ({parent}) => !isMode(parent, 'manual'),
      description: 'Drag the references into the order they should appear.',
      of: [defineArrayMember({type: 'reference', to: [{type: 'addOns'}]})],
      validation: (rule) =>
        rule.unique().max(12).custom((value, context) =>
          isMode(context.parent, 'manual') && (!Array.isArray(value) || value.length === 0)
            ? 'Select at least one add-on'
            : true,
        ),
    }),
    defineField({
      name: 'filters',
      title: 'Add-on filters',
      type: 'object',
      hidden: ({parent}) => !isMode(parent, 'filters'),
      fields: [
        defineField({name: 'type', title: 'Category', type: 'string', options: {list: addOnTypeOptions}}),
        defineField({name: 'minPrice', title: 'Minimum Metro Manila price', type: 'number', validation: (rule) => rule.min(0)}),
        defineField({name: 'maxPrice', title: 'Maximum Metro Manila price', type: 'number', validation: (rule) => rule.min(0)}),
      ],
      validation: (rule) =>
        rule.custom((value, context) => {
          if (!isMode(context.parent, 'filters')) return true
          const rangeResult = priceRangeValidation(value)
          if (rangeResult !== true) return rangeResult
          return (value as {type?: string} | undefined)?.type ? true : 'Choose one add-on category'
        }),
    }),
    ...galleryPresentationFields(addOnSortOptions),
  ],
  preview: {
    select: {mode: 'selectionMode', selected: 'selectedAddOns', type: 'filters.type', limit: 'limit', sortBy: 'sortBy'},
    prepare({mode, selected, type, limit, sortBy}) {
      const count = mode === 'manual' && Array.isArray(selected) ? selected.length : limit || 6
      return {
        title: 'Add-on Gallery',
        subtitle: mode === 'manual' ? `${count} selected add-on${count === 1 ? '' : 's'}` : `${count} ${type || 'category'} add-ons · ${sortBy || 'name'}`,
        media: PackageIcon,
      }
    },
  },
})
