import {TagsIcon} from '@sanity/icons/Tags'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {promotionCategoryOptions} from './promotion'

const promotionGroupCategoryOptions = promotionCategoryOptions.filter(
  (option) => option.value !== 'limitedTimeDiscount',
)

type PackageValue = {
  slug?: {current?: string}
  isAvailable?: boolean
}

type PromotionValue = {
  slug?: {current?: string}
  packages?: PackageValue[]
}

export const promotionGroupType = defineType({
  name: 'promotionGroup',
  title: 'Promo Group',
  type: 'document',
  icon: TagsIcon,
  initialValue: {
    category: 'seasonalOffer',
    isVisible: true,
    priority: 0,
    featureOnHomepage: false,
  },
  groups: [
    {name: 'content', title: 'Campaign', default: true},
    {name: 'promotions', title: 'Promotions'},
    {name: 'schedule', title: 'Schedule'},
    {name: 'presentation', title: 'Presentation'},
  ],
  fields: [
    defineField({
      name: 'internalName',
      title: 'Internal name',
      type: 'string',
      group: 'content',
      description: 'Used by editors to distinguish campaigns.',
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
      description: 'Limited-Time Discounts are managed by the Gown Discount Campaign singleton.',
      options: {list: [...promotionGroupCategoryOptions], layout: 'radio'},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summary',
      type: 'text',
      rows: 4,
      group: 'content',
      description: 'Used on Home, Offers, and the group hero.',
      validation: (rule) => rule.required().max(320),
    }),
    defineField({
      name: 'campaignImage',
      title: 'Campaign image',
      type: 'image',
      group: 'content',
      description: 'Optional. Use a 4:3 image; image-free groups use a branded text layout.',
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
      name: 'promotions',
      title: 'Promotions',
      type: 'array',
      group: 'promotions',
      description: 'Create promotions here and drag them into the order customers should see.',
      of: [defineArrayMember({type: 'promotionOffer'})],
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .custom((value) => {
            const promotions = (value ?? []) as PromotionValue[]
            const slugs = promotions
              .map((item) => item.slug?.current?.trim().toLowerCase())
              .filter((slug): slug is string => Boolean(slug))
            return new Set(slugs).size === slugs.length
              ? true
              : 'Every promotion in this group must have a unique slug'
          }),
    }),
    defineField({
      name: 'packages',
      title: 'Promotion packages (Deprecated)',
      type: 'array',
      group: 'promotions',
      of: [defineArrayMember({type: 'promotionPackage'})],
      deprecated: {reason: 'Packages now belong to promotions inside this promo group.'},
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
    }),
    defineField({
      name: 'startsAt',
      title: 'Starts at',
      type: 'datetime',
      group: 'schedule',
      description: 'All promotions and packages in this group share this schedule.',
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
      name: 'isVisible',
      title: 'Visible on website',
      type: 'boolean',
      group: 'presentation',
      description:
        'Turn this off to hide the group everywhere and disable all of its package rules.',
      initialValue: true,
      validation: (rule) =>
        rule
          .custom((value, context) => {
            if (value === false) return true
            const promotions = (context.document?.promotions ?? []) as PromotionValue[]
            return promotions.some((promotion) =>
              promotion.packages?.some((item) => item.isAvailable !== false),
            )
              ? true
              : 'A visible group should contain at least one promotion with an available package'
          })
          .warning(),
    }),
    defineField({
      name: 'priority',
      title: 'Display priority',
      type: 'number',
      group: 'presentation',
      description: 'Higher values appear first when dates are equal.',
      initialValue: 0,
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: 'featureOnHomepage',
      title: 'Feature on homepage',
      type: 'boolean',
      group: 'presentation',
      initialValue: false,
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
      isVisible: 'isVisible',
      promotions: 'promotions',
      media: 'campaignImage',
    },
    prepare({title, internalName, category, startsAt, endsAt, isVisible, promotions, media}) {
      const categoryTitle =
        promotionCategoryOptions.find((option) => option.value === category)?.title ?? 'Promo Group'
      const promotionValues = Array.isArray(promotions) ? (promotions as PromotionValue[]) : []
      const promotionCount = promotionValues.length
      const packageCount = promotionValues.reduce(
        (count, promotion) =>
          count + (promotion.packages ?? []).filter((item) => item.isAvailable !== false).length,
        0,
      )
      const schedule = startsAt && endsAt ? `${startsAt} – ${endsAt}` : 'Schedule incomplete'
      return {
        title: title || internalName || 'Untitled promo group',
        subtitle: `${isVisible === false ? 'Hidden · ' : ''}${categoryTitle} · ${promotionCount} promotion${promotionCount === 1 ? '' : 's'} · ${packageCount} package${packageCount === 1 ? '' : 's'} · ${schedule}`,
        media,
      }
    },
  },
})
