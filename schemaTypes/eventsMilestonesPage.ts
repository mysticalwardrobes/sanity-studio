import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {eventMilestoneKinds} from './eventMilestone'

const sectionHeadingFields = [
  defineField({name: 'eyebrow', type: 'string'}),
  defineField({name: 'heading', type: 'string', validation: (rule) => rule.required()}),
  defineField({name: 'introduction', type: 'text', rows: 3}),
]

const galleryImageMember = defineArrayMember({
  name: 'galleryImage',
  title: 'Image',
  type: 'image',
  options: {hotspot: true},
  fields: [
    defineField({name: 'alt', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'caption', type: 'string'}),
    defineField({name: 'credit', type: 'string'}),
  ],
})

const videoMember = defineArrayMember({
  name: 'videoEmbed',
  title: 'YouTube or Vimeo video',
  type: 'object',
  fields: [
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'url', type: 'url', validation: (rule) => rule.required()}),
    defineField({name: 'caption', type: 'string'}),
  ],
  preview: {select: {title: 'title', subtitle: 'url'}},
})

export const eventsMilestonesPageType = defineType({
  name: 'eventsMilestonesPage',
  title: 'Events & Milestones Page',
  type: 'document',
  icon: DocumentTextIcon,
  initialValue: {
    eyebrow: 'About Us',
    title: 'Events & Milestones',
    introduction: 'Celebrating our journey, recognitions, and the magical stages we have been part of.',
    emptyHeading: 'More magical moments are coming soon',
    emptyMessage: 'We are currently curating our awards, events, and milestones.',
    seoTitle: 'Events & Milestones | Mystical Wardrobes',
    seoDescription: 'Explore Mystical Wardrobes awards, fashion shows, events, and company milestones.',
  },
  groups: [
    {name: 'header', title: 'Header', default: true},
    {name: 'sections', title: 'Page Sections'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    defineField({name: 'eyebrow', type: 'string', group: 'header', validation: (rule) => rule.required()}),
    defineField({name: 'title', type: 'string', group: 'header', validation: (rule) => rule.required().max(100)}),
    defineField({name: 'introduction', type: 'text', rows: 4, group: 'header', validation: (rule) => rule.required().max(500)}),
    defineField({
      name: 'heroImage',
      type: 'image',
      group: 'header',
      options: {hotspot: true},
      fields: [defineField({name: 'alt', type: 'string', validation: (rule) => rule.required()})],
    }),
    defineField({name: 'emptyHeading', type: 'string', group: 'header', validation: (rule) => rule.required()}),
    defineField({name: 'emptyMessage', type: 'text', rows: 2, group: 'header', validation: (rule) => rule.required()}),
    defineField({
      name: 'sections',
      type: 'array',
      group: 'sections',
      validation: (rule) => rule.required().min(1),
      of: [
        defineArrayMember({
          name: 'featuredStoriesSection',
          title: 'Featured Stories',
          type: 'object',
          fields: [
            ...sectionHeadingFields,
            defineField({
              name: 'stories',
              type: 'array',
              of: [defineArrayMember({type: 'reference', to: [{type: 'eventMilestone'}]})],
              validation: (rule) => rule.required().min(1).max(8).unique(),
            }),
            defineField({name: 'layout', type: 'string', options: {list: ['cards', 'editorial'], layout: 'radio'}, initialValue: 'cards'}),
          ],
          preview: {select: {title: 'heading'}, prepare: ({title}) => ({title: title || 'Featured Stories', subtitle: 'Featured Stories'})},
        }),
        defineArrayMember({
          name: 'storyCollectionSection',
          title: 'Event Collection',
          type: 'object',
          fields: [
            ...sectionHeadingFields,
            defineField({name: 'includedKinds', type: 'array', of: [defineArrayMember({type: 'string'})], options: {list: [...eventMilestoneKinds]}}),
            defineField({name: 'layout', type: 'string', options: {list: ['grid', 'timeline'], layout: 'radio'}, initialValue: 'grid'}),
            defineField({name: 'sortOrder', type: 'string', options: {list: [{title: 'Newest first', value: 'newest'}, {title: 'Oldest first', value: 'oldest'}], layout: 'radio'}, initialValue: 'newest'}),
            defineField({name: 'limit', type: 'number', validation: (rule) => rule.integer().min(1).max(100), initialValue: 24}),
            defineField({name: 'showFilters', type: 'boolean', initialValue: true}),
          ],
          preview: {select: {title: 'heading', layout: 'layout'}, prepare: ({title, layout}) => ({title: title || 'Event Collection', subtitle: `Collection · ${layout || 'grid'}`})},
        }),
        defineArrayMember({
          name: 'richTextSection',
          title: 'Rich Text Story',
          type: 'object',
          fields: [
            ...sectionHeadingFields,
            defineField({name: 'body', type: 'array', of: [defineArrayMember({type: 'block'})], validation: (rule) => rule.required().min(1)}),
          ],
          preview: {select: {title: 'heading'}, prepare: ({title}) => ({title: title || 'Rich Text Story', subtitle: 'Rich Text'})},
        }),
        defineArrayMember({
          name: 'mediaGallerySection',
          title: 'Media Gallery',
          type: 'object',
          fields: [
            ...sectionHeadingFields,
            defineField({name: 'media', type: 'array', of: [galleryImageMember, videoMember], validation: (rule) => rule.required().min(1)}),
            defineField({name: 'layout', type: 'string', options: {list: ['grid', 'masonry'], layout: 'radio'}, initialValue: 'grid'}),
          ],
          preview: {select: {title: 'heading'}, prepare: ({title}) => ({title: title || 'Media Gallery', subtitle: 'Media Gallery'})},
        }),
        defineArrayMember({
          name: 'statisticsSection',
          title: 'Statistics',
          type: 'object',
          fields: [
            ...sectionHeadingFields,
            defineField({
              name: 'statistics',
              type: 'array',
              of: [defineArrayMember({
                name: 'statistic',
                type: 'object',
                fields: [
                  defineField({name: 'value', type: 'string', validation: (rule) => rule.required()}),
                  defineField({name: 'label', type: 'string', validation: (rule) => rule.required()}),
                  defineField({name: 'description', type: 'text', rows: 2}),
                ],
                preview: {select: {title: 'value', subtitle: 'label'}},
              })],
              validation: (rule) => rule.required().min(1).max(8),
            }),
          ],
          preview: {select: {title: 'heading'}, prepare: ({title}) => ({title: title || 'Statistics', subtitle: 'Statistics'})},
        }),
        defineArrayMember({
          name: 'callToActionSection',
          title: 'Call to Action',
          type: 'object',
          fields: [
            ...sectionHeadingFields,
            defineField({name: 'linkLabel', type: 'string', validation: (rule) => rule.required()}),
            defineField({name: 'linkType', type: 'string', options: {list: ['internal', 'external'], layout: 'radio'}, initialValue: 'internal'}),
            defineField({name: 'internalPath', type: 'string', hidden: ({parent}) => parent?.linkType !== 'internal', validation: (rule) => rule.custom((value, context) => context.parent?.linkType !== 'internal' || value ? true : 'Internal path is required')}),
            defineField({name: 'externalUrl', type: 'url', hidden: ({parent}) => parent?.linkType !== 'external', validation: (rule) => rule.custom((value, context) => context.parent?.linkType !== 'external' || value ? true : 'External URL is required')}),
            defineField({name: 'backgroundImage', type: 'image', options: {hotspot: true}, fields: [defineField({name: 'alt', type: 'string'})]}),
          ],
          preview: {select: {title: 'heading', subtitle: 'linkLabel', media: 'backgroundImage'}},
        }),
      ],
    }),
    defineField({name: 'seoTitle', type: 'string', group: 'seo', validation: (rule) => rule.required().max(60)}),
    defineField({name: 'seoDescription', type: 'text', rows: 3, group: 'seo', validation: (rule) => rule.required().max(160)}),
    defineField({name: 'socialImage', type: 'image', group: 'seo', options: {hotspot: true}, fields: [defineField({name: 'alt', type: 'string', validation: (rule) => rule.required()})]}),
  ],
  preview: {select: {title: 'title', subtitle: 'introduction', media: 'heroImage'}},
})
