import {TagIcon} from '@sanity/icons/Tag'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {
  asSanityList,
  gownV2EligibilityOptions,
  rentalTierEligibilityOptions,
} from './gownV2Eligibility'

const rentalVariantOptions = [
  {title: 'Standard rental', value: 'standard'},
  {title: 'Pixie rental', value: 'pixie'},
]

const serviceRegionOptions = [
  {title: 'Metro Manila', value: 'metroManila'},
  {title: 'Luzon', value: 'luzon'},
  {title: 'Outside Luzon', value: 'outsideLuzon'},
]

export const promotionPackageType = defineType({
  name: 'promotionPackage',
  title: 'Promotion Package',
  type: 'object',
  icon: TagIcon,
  initialValue: {
    benefitType: 'informational',
    eligibilityMode: 'selectedV2Gowns',
    rentalVariants: ['standard'],
    serviceRegions: ['metroManila', 'luzon', 'outsideLuzon'],
    isAvailable: true,
    priority: 0,
  },
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'benefit', title: 'Benefit'},
    {name: 'eligibility', title: 'Eligibility'},
    {name: 'presentation', title: 'Availability'},
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Package title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(90),
    }),
    defineField({
      name: 'slug',
      title: 'Package slug',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      type: 'text',
      rows: 3,
      group: 'content',
      validation: (rule) => rule.required().max(600),
    }),
    defineField({
      name: 'banner',
      title: 'Package banner',
      type: 'image',
      group: 'content',
      description: 'Shown above this package’s details. Use a 4:3 image.',
      options: {hotspot: true},
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
          validation: (rule) => rule.required(),
        }),
      ],
    }),
    defineField({
      name: 'details',
      title: 'Package details',
      type: 'array',
      group: 'content',
      description:
        'Describe inclusions, how to avail the package, and who it is best for. Add explanation images between text sections as needed.',
      of: [
        defineArrayMember({type: 'block'}),
        defineArrayMember({
          type: 'image',
          title: 'Explanation image',
          options: {hotspot: true},
          fields: [
            defineField({
              name: 'alt',
              title: 'Alternative text',
              type: 'string',
              description: 'Describe the image and any important text shown inside it.',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'caption',
              title: 'Caption',
              type: 'string',
              description: 'Optional supporting text shown below the image.',
              validation: (rule) => rule.max(180),
            }),
          ],
        }),
        defineArrayMember({type: 'promotionRentalTierTable'}),
        defineArrayMember({type: 'promotionGownGallery'}),
        defineArrayMember({type: 'promotionAddOnGallery'}),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'benefitType',
      title: 'Benefit type',
      type: 'string',
      group: 'benefit',
      options: {
        layout: 'radio',
        list: [
          {title: 'Percentage discount', value: 'percentage'},
          {title: 'Fixed peso reduction', value: 'fixedAmount'},
          {title: 'Informational package', value: 'informational'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'discountValue',
      title: 'Discount value',
      type: 'number',
      group: 'benefit',
      hidden: ({parent}) =>
        (parent as {benefitType?: string} | undefined)?.benefitType === 'informational',
      description: 'Enter a percentage or Philippine-peso amount based on the benefit type.',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as {benefitType?: string} | undefined
          if (parent?.benefitType === 'informational') return true
          if (typeof value !== 'number' || value <= 0) return 'Enter a value greater than zero'
          if (parent?.benefitType === 'percentage' && value > 100) {
            return 'Percentage discounts cannot exceed 100%'
          }
          return true
        }),
    }),
    defineField({
      name: 'promoCode',
      title: 'Promo code',
      type: 'string',
      group: 'benefit',
      description: 'Optional code customers should mention when messaging the team.',
      validation: (rule) => rule.uppercase().max(32),
    }),
    defineField({
      name: 'redemptionInstructions',
      type: 'text',
      rows: 3,
      group: 'benefit',
      description: 'Optional manual-booking instructions shown with this package.',
    }),
    defineField({
      name: 'terms',
      title: 'Package terms and conditions',
      type: 'array',
      group: 'benefit',
      description: 'Optional package-specific terms shown in addition to the general promotions terms.',
      of: [defineArrayMember({type: 'block'})],
    }),
    defineField({
      name: 'eligibilityMode',
      title: 'Eligible gowns',
      type: 'string',
      group: 'eligibility',
      options: {
        layout: 'radio',
        list: [
          {title: 'All V2 gowns', value: 'allV2Gowns'},
          {title: 'V2 gown filters', value: 'v2Filters'},
          {title: 'Selected V2 gowns', value: 'selectedV2Gowns'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'v2Filters',
      title: 'Eligible V2 gown filters',
      type: 'object',
      group: 'eligibility',
      description:
        'A gown must match every populated filter group. Within a group, matching any selected value is enough.',
      hidden: ({parent}) =>
        (parent as {eligibilityMode?: string} | undefined)?.eligibilityMode !== 'v2Filters',
      fields: [
        ...([
          ['upcomingDesign', 'Upcoming Design & Evolution', gownV2EligibilityOptions.upcomingDesign],
          ['gownStatus', 'Gown Status', gownV2EligibilityOptions.gownStatus],
          ['gownFeatures', 'Gown Features', gownV2EligibilityOptions.gownFeatures],
          ['wardrobeFeatures', 'Wardrobe Features', gownV2EligibilityOptions.wardrobeFeatures],
          ['bestFor', 'Best For', gownV2EligibilityOptions.bestFor],
          ['tags', 'Tags', gownV2EligibilityOptions.tags],
          ['colors', 'Color', gownV2EligibilityOptions.colors],
          ['ageGroups', 'Age Group', gownV2EligibilityOptions.ageGroups],
          ['petticoats', 'Petticoat Types', gownV2EligibilityOptions.petticoats],
        ] as const).map(([name, title, values]) =>
          defineField({
            name,
            title,
            type: 'array',
            of: [defineArrayMember({type: 'string'})],
            options: {list: asSanityList(values)},
            validation: (rule) => rule.unique(),
          }),
        ),
        defineField({
          name: 'rentalTiers',
          title: 'Rental Tiers',
          type: 'array',
          description:
            'A gown’s tier is based on its Metro Manila standard rate, falling back to its pixie rate when needed.',
          of: [defineArrayMember({type: 'string'})],
          options: {list: [...rentalTierEligibilityOptions]},
          validation: (rule) => rule.unique(),
        }),
        defineField({
          name: 'corsetCounts',
          title: 'Corset Count',
          description: 'Enter exact Corset Count values used by V2 gown documents.',
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
          options: {layout: 'tags'},
          validation: (rule) => rule.unique(),
        }),
      ],
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as {eligibilityMode?: string} | undefined
          if (parent?.eligibilityMode !== 'v2Filters') return true
          if (!value || typeof value !== 'object') return 'Set at least one V2 gown filter'
          return Object.values(value).some((entry) => Array.isArray(entry) && entry.length > 0)
            ? true
            : 'Set at least one V2 gown filter'
        }),
    }),
    defineField({
      name: 'eligibleV2Gowns',
      title: 'Eligible V2 gowns',
      type: 'array',
      group: 'eligibility',
      hidden: ({parent}) =>
        (parent as {eligibilityMode?: string} | undefined)?.eligibilityMode !==
        'selectedV2Gowns',
      of: [defineArrayMember({type: 'reference', to: [{type: 'gown_temp'}]})],
      validation: (rule) =>
        rule.unique().custom((value, context) => {
          const parent = context.parent as {eligibilityMode?: string} | undefined
          if (parent?.eligibilityMode !== 'selectedV2Gowns') return true
          return Array.isArray(value) && value.length > 0 ? true : 'Select at least one V2 gown'
        }),
    }),
    defineField({
      name: 'rentalVariants',
      title: 'Eligible rental variants',
      type: 'array',
      group: 'eligibility',
      of: [defineArrayMember({type: 'string'})],
      options: {list: rentalVariantOptions},
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'serviceRegions',
      title: 'Eligible service regions',
      type: 'array',
      group: 'eligibility',
      of: [defineArrayMember({type: 'string'})],
      options: {list: serviceRegionOptions},
      validation: (rule) => rule.required().min(1).unique(),
    }),
    defineField({
      name: 'isAvailable',
      title: 'Available on website',
      type: 'boolean',
      group: 'presentation',
      description:
        'Turn this off to hide only this package and prevent its pricing rule from applying.',
      initialValue: true,
    }),
    defineField({
      name: 'priority',
      title: 'Pricing priority',
      type: 'number',
      group: 'presentation',
      description: 'Used to break ties when multiple packages produce the same price.',
      initialValue: 0,
      validation: (rule) => rule.required().integer().min(0),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      benefitType: 'benefitType',
      discountValue: 'discountValue',
      isAvailable: 'isAvailable',
      media: 'banner',
    },
    prepare({title, benefitType, discountValue, isAvailable, media}) {
      const benefit =
        benefitType === 'percentage'
          ? `${discountValue ?? 0}% off`
          : benefitType === 'fixedAmount'
            ? `₱${Number(discountValue ?? 0).toLocaleString('en-PH')} off`
            : 'Informational package'
      return {
        title: title || 'Untitled package',
        subtitle: `${isAvailable === false ? 'Hidden · ' : ''}${benefit}`,
        media: media || TagIcon,
      }
    },
  },
})
