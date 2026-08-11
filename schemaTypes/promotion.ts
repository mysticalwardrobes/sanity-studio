import {TagIcon} from '@sanity/icons/Tag'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {asSanityList, gownV2EligibilityOptions} from './gownV2Eligibility'

export const promotionCategoryOptions = [
  {title: 'Limited-Time Discount', value: 'limitedTimeDiscount'},
  {title: 'Event Exclusive', value: 'eventExclusive'},
  {title: 'Seasonal Offer', value: 'seasonalOffer'},
  {title: 'Loyalty & Rewards', value: 'loyaltyReward'},
  {title: 'Partner Offer & Experience', value: 'partnerExperience'},
] as const

const rentalVariantOptions = [
  {title: 'Standard rental', value: 'standard'},
  {title: 'Pixie rental', value: 'pixie'},
]

const serviceRegionOptions = [
  {title: 'Metro Manila', value: 'metroManila'},
  {title: 'Luzon', value: 'luzon'},
  {title: 'Outside Luzon', value: 'outsideLuzon'},
]

export const promotionType = defineType({
  name: 'promotion',
  title: 'Promotion',
  type: 'document',
  icon: TagIcon,
  initialValue: {
    category: 'limitedTimeDiscount',
    benefitType: 'percentage',
    eligibilityMode: 'selectedV2Gowns',
    rentalVariants: ['standard'],
    serviceRegions: ['metroManila', 'luzon', 'outsideLuzon'],
    priority: 0,
    featureOnHomepage: false,
  },
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'benefit', title: 'Benefit'},
    {name: 'eligibility', title: 'Eligibility'},
    {name: 'schedule', title: 'Schedule'},
    {name: 'presentation', title: 'Presentation'},
  ],
  fields: [
    defineField({
      name: 'internalName',
      title: 'Internal name',
      type: 'string',
      description: 'Used by editors to distinguish campaigns.',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Public title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(90),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'category',
      type: 'string',
      group: 'content',
      options: {list: [...promotionCategoryOptions], layout: 'radio'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      type: 'text',
      rows: 3,
      group: 'content',
      validation: (rule) => rule.required().max(220),
    }),
    defineField({
      name: 'details',
      title: 'Offer details',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({type: 'block'})],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'campaignImage',
      title: 'Campaign image',
      type: 'image',
      group: 'content',
      description: 'Optional. Promotions without an image use a text-first card layout.',
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
      name: 'benefitType',
      title: 'Benefit type',
      type: 'string',
      group: 'benefit',
      options: {
        layout: 'radio',
        list: [
          {title: 'Percentage discount', value: 'percentage'},
          {title: 'Fixed peso reduction', value: 'fixedAmount'},
          {title: 'Informational only', value: 'informational'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'discountValue',
      title: 'Discount value',
      type: 'number',
      group: 'benefit',
      hidden: ({document}) => document?.benefitType === 'informational',
      description: 'Enter a percentage or Philippine-peso amount based on the benefit type.',
      validation: (rule) =>
        rule.custom((value, context) => {
          const benefitType = context.document?.benefitType
          if (benefitType === 'informational') return true
          if (typeof value !== 'number' || value <= 0) return 'Enter a value greater than zero'
          if (benefitType === 'percentage' && value > 100) {
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
      description: 'Optional manual-booking instructions shown with the offer.',
    }),
    defineField({
      name: 'terms',
      title: 'Offer terms and conditions',
      type: 'array',
      group: 'benefit',
      of: [defineArrayMember({type: 'block'})],
      validation: (rule) => rule.required().min(1),
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
      description: 'A gown must match every populated filter group. Within a group, matching any selected value is enough.',
      hidden: ({document}) => document?.eligibilityMode !== 'v2Filters',
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
        ] as const).map(([name, title, values]) => defineField({
          name,
          title,
          type: 'array',
          of: [defineArrayMember({type: 'string'})],
          options: {list: asSanityList(values)},
          validation: (rule) => rule.unique(),
        })),
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
          if (context.document?.eligibilityMode !== 'v2Filters') return true
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
      hidden: ({document}) => document?.eligibilityMode !== 'selectedV2Gowns',
      of: [defineArrayMember({type: 'reference', to: [{type: 'gown_temp'}]})],
      validation: (rule) =>
        rule.unique().custom((value, context) => {
          if (context.document?.eligibilityMode !== 'selectedV2Gowns') return true
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
      name: 'startsAt',
      title: 'Starts at',
      type: 'datetime',
      group: 'schedule',
      description: 'Enter the intended absolute time; the website displays it in Philippine time.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'endsAt',
      title: 'Ends at',
      type: 'datetime',
      group: 'schedule',
      validation: (rule) =>
        rule.required().custom((endsAt, context) => {
          const startsAt = context.document?.startsAt
          if (!startsAt || !endsAt) return true
          return new Date(String(endsAt)) > new Date(String(startsAt))
            ? true
            : 'End time must be later than the start time'
        }),
    }),
    defineField({
      name: 'priority',
      title: 'Display priority',
      type: 'number',
      group: 'presentation',
      description: 'Higher values win ties and determine informational-offer prominence.',
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: 'featureOnHomepage',
      title: 'Feature on homepage',
      type: 'boolean',
      group: 'presentation',
    }),
    defineField({
      name: 'homepageOrder',
      title: 'Homepage order',
      type: 'number',
      group: 'presentation',
      hidden: ({document}) => !document?.featureOnHomepage,
      validation: (rule) =>
        rule.integer().min(1).custom((value, context) => {
          if (!context.document?.featureOnHomepage) return true
          return typeof value === 'number' ? true : 'Set the homepage order'
        }),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      internalName: 'internalName',
      category: 'category',
      startsAt: 'startsAt',
      endsAt: 'endsAt',
      media: 'campaignImage',
    },
    prepare({title, internalName, category, startsAt, endsAt, media}) {
      const categoryTitle =
        promotionCategoryOptions.find((option) => option.value === category)?.title ?? 'Promotion'
      const schedule = startsAt && endsAt ? `${startsAt} – ${endsAt}` : 'Schedule incomplete'
      return {
        title: title || internalName || 'Untitled promotion',
        subtitle: `${categoryTitle} · ${schedule}`,
        media,
      }
    },
  },
})
