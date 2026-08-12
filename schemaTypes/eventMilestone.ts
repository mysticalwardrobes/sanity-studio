import {CalendarIcon} from '@sanity/icons/Calendar'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const eventMilestoneKinds = [
  {title: 'Award', value: 'award'},
  {title: 'Fashion Show', value: 'fashionShow'},
  {title: 'Special Event', value: 'specialEvent'},
  {title: 'Company Milestone', value: 'companyMilestone'},
  {title: 'Press Feature', value: 'pressFeature'},
] as const

const imageMember = defineArrayMember({
  name: 'eventImage',
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
    defineField({
      name: 'url',
      type: 'url',
      validation: (rule) =>
        rule.required().custom((value) => {
          if (!value) return true
          return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(value)
            ? true
            : 'Use a valid YouTube or Vimeo URL'
        }),
    }),
    defineField({name: 'caption', type: 'string'}),
  ],
  preview: {select: {title: 'title', subtitle: 'url'}},
})

export const eventMilestoneType = defineType({
  name: 'eventMilestone',
  title: 'Event or Milestone',
  type: 'document',
  icon: CalendarIcon,
  initialValue: {kind: 'specialEvent', featured: false, priority: 0},
  groups: [
    {name: 'content', title: 'Content', default: true},
    {name: 'details', title: 'Details'},
    {name: 'media', title: 'Media'},
    {name: 'seo', title: 'SEO'},
  ],
  fields: [
    defineField({name: 'title', type: 'string', group: 'content', validation: (rule) => rule.required().max(120)}),
    defineField({
      name: 'slug',
      type: 'slug',
      group: 'content',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'kind',
      title: 'Content type',
      type: 'string',
      group: 'content',
      options: {list: [...eventMilestoneKinds], layout: 'radio'},
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'summary', type: 'text', rows: 3, group: 'content', validation: (rule) => rule.required().max(260)}),
    defineField({
      name: 'body',
      title: 'Full story',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'block',
          marks: {
            annotations: [
              defineArrayMember({
                name: 'link',
                type: 'object',
                fields: [defineField({name: 'href', type: 'url', validation: (rule) => rule.required()})],
              }),
            ],
          },
        }),
      ],
    }),
    defineField({name: 'startDate', type: 'date', group: 'details', validation: (rule) => rule.required()}),
    defineField({
      name: 'endDate',
      type: 'date',
      group: 'details',
      validation: (rule) => rule.custom((value, context) => {
        const startDate = context.document?.startDate
        return !value || !startDate || value >= startDate ? true : 'End date must be on or after the start date'
      }),
    }),
    defineField({name: 'displayDate', title: 'Display date override', type: 'string', group: 'details'}),
    defineField({name: 'organization', title: 'Organizer or awarding organization', type: 'string', group: 'details'}),
    defineField({name: 'venue', type: 'string', group: 'details'}),
    defineField({name: 'location', type: 'string', group: 'details'}),
    defineField({
      name: 'facts',
      type: 'array',
      group: 'details',
      of: [defineArrayMember({
        type: 'object',
        name: 'fact',
        fields: [
          defineField({name: 'label', type: 'string', validation: (rule) => rule.required()}),
          defineField({name: 'value', type: 'string', validation: (rule) => rule.required()}),
        ],
        preview: {select: {title: 'label', subtitle: 'value'}},
      })],
    }),
    defineField({name: 'highlights', type: 'array', group: 'details', of: [defineArrayMember({type: 'string'})]}),
    defineField({
      name: 'coverImage',
      type: 'image',
      group: 'media',
      options: {hotspot: true},
      fields: [
        defineField({name: 'alt', type: 'string', validation: (rule) => rule.required()}),
        defineField({name: 'caption', type: 'string'}),
        defineField({name: 'credit', type: 'string'}),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'media', type: 'array', group: 'media', of: [imageMember, videoMember]}),
    defineField({
      name: 'externalLinks',
      title: 'Coverage and related links',
      type: 'array',
      group: 'details',
      of: [defineArrayMember({
        type: 'object',
        name: 'externalLink',
        fields: [
          defineField({name: 'label', type: 'string', validation: (rule) => rule.required()}),
          defineField({name: 'url', type: 'url', validation: (rule) => rule.required().uri({scheme: ['http', 'https']})}),
        ],
        preview: {select: {title: 'label', subtitle: 'url'}},
      })],
    }),
    defineField({
      name: 'featured',
      title: 'Show in homepage gallery',
      type: 'boolean',
      group: 'content',
      description:
        'Prioritize this story in the homepage gallery. If no stories are selected, the latest published stories are shown automatically.',
    }),
    defineField({
      name: 'homepageOrder',
      title: 'Homepage order',
      type: 'number',
      group: 'content',
      description: 'Lower numbers appear first. The homepage shows up to six selected stories.',
      hidden: ({document}) => !document?.featured,
      validation: (rule) => rule.integer().min(1),
    }),
    defineField({name: 'priority', type: 'number', group: 'content', validation: (rule) => rule.integer().min(0)}),
    defineField({name: 'seoTitle', type: 'string', group: 'seo', validation: (rule) => rule.max(60)}),
    defineField({name: 'seoDescription', type: 'text', rows: 3, group: 'seo', validation: (rule) => rule.max(160)}),
    defineField({
      name: 'socialImage',
      type: 'image',
      group: 'seo',
      options: {hotspot: true},
      fields: [defineField({name: 'alt', type: 'string', validation: (rule) => rule.required()})],
    }),
  ],
  orderings: [{title: 'Event date, newest', name: 'dateDesc', by: [{field: 'startDate', direction: 'desc'}]}],
  preview: {
    select: {title: 'title', kind: 'kind', date: 'startDate', media: 'coverImage'},
    prepare: ({title, kind, date, media}) => ({title, subtitle: [kind, date].filter(Boolean).join(' · '), media}),
  },
})
