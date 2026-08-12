import {TagIcon} from '@sanity/icons/Tag'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const gownDiscountCampaignType = defineType({
  name: 'gownDiscountCampaign',
  title: 'Gown Discount Campaign',
  type: 'document',
  icon: TagIcon,
  initialValue: {
    eyebrow: 'Limited-Time Discounts',
    title: 'Limited-Time Gown Discounts',
    summary: 'Explore wardrobes with special rental savings already applied to selected rates.',
    featureOnHomepage: false,
    homepageOrder: 1,
    seoTitle: 'Limited-Time Gown Discounts | Mystical Wardrobes',
    seoDescription:
      'Browse Mystical Wardrobes gowns with limited-time discounts on selected rental rates.',
  },
  groups: [
    {name: 'content', title: 'Campaign', default: true},
    {name: 'presentation', title: 'Presentation'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    defineField({
      name: 'eyebrow',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(80),
    }),
    defineField({
      name: 'title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'summary',
      type: 'text',
      rows: 3,
      group: 'content',
      description: 'Used on All Offers and the homepage.',
      validation: (rule) => rule.required().max(320),
    }),
    defineField({
      name: 'description',
      title: 'Campaign description',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({type: 'block'})],
    }),
    defineField({
      name: 'campaignImage',
      title: 'Campaign image',
      type: 'image',
      group: 'content',
      description: 'Optional. Use a 4:3 image.',
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
      name: 'terms',
      title: 'Campaign terms',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({type: 'block'})],
    }),
    defineField({
      name: 'featureOnHomepage',
      title: 'Feature on homepage',
      type: 'boolean',
      group: 'presentation',
      description: 'The campaign appears only while at least one gown has a valid rate discount.',
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
    defineField({
      name: 'seoTitle',
      type: 'string',
      group: 'seo',
      validation: (rule) => rule.required().max(60),
    }),
    defineField({
      name: 'seoDescription',
      type: 'text',
      rows: 3,
      group: 'seo',
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: 'socialImage',
      type: 'image',
      group: 'seo',
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
  ],
  preview: {
    select: {title: 'title', subtitle: 'summary', media: 'campaignImage'},
  },
})
