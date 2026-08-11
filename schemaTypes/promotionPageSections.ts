import {BlockContentIcon} from '@sanity/icons/BlockContent'
import {DocumentsIcon} from '@sanity/icons/Documents'
import {InfoOutlineIcon} from '@sanity/icons/InfoOutline'
import {LinkIcon} from '@sanity/icons/Link'
import {defineArrayMember, defineField, defineType} from 'sanity'

const portableTextBlock = () =>
  defineArrayMember({
    type: 'block',
    marks: {
      annotations: [
        {
          name: 'link',
          title: 'Link',
          type: 'object',
          fields: [
            defineField({
              name: 'href',
              title: 'Link destination',
              type: 'string',
              description: 'Use a full https:// URL or a website path beginning with /.',
              validation: (rule) =>
                rule.required().custom((value) => {
                  if (!value) return true
                  return /^https?:\/\//i.test(value) || value.startsWith('/')
                    ? true
                    : 'Enter a full https:// URL or an internal path beginning with /'
                }),
            }),
            defineField({
              name: 'openInNewTab',
              title: 'Open in a new tab',
              type: 'boolean',
              initialValue: false,
            }),
          ],
        },
      ],
    },
  })

export const promotionPackageGroupSectionType = defineType({
  name: 'promotionPackageGroupSection',
  title: 'Package Group',
  type: 'object',
  icon: DocumentsIcon,
  fields: [
    defineField({
      name: 'heading',
      title: 'Group heading',
      type: 'string',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'context',
      title: 'Supporting context',
      type: 'string',
      description: 'Optional short qualifier, such as “Collections and Seasonal”.',
      validation: (rule) => rule.max(120),
    }),
    defineField({
      name: 'introduction',
      title: 'Introduction',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(500),
    }),
    defineField({
      name: 'packages',
      title: 'Packages',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'promotionPackage',
          title: 'Package',
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: 'Package title',
              type: 'string',
              validation: (rule) => rule.required().max(100),
            }),
            defineField({
              name: 'body',
              title: 'Package content',
              type: 'array',
              description:
                'Use paragraphs and lists for inclusions, how to avail the promo, and who it is best for.',
              of: [portableTextBlock()],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: {title: 'title'},
            prepare: ({title}) => ({title: title || 'Untitled package', subtitle: 'Package'}),
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'heading', context: 'context'},
    prepare: ({title, context}) => ({
      title: title || 'Untitled package group',
      subtitle: context ? `Package Group · ${context}` : 'Package Group',
      media: DocumentsIcon,
    }),
  },
})

export const promotionRichTextSectionType = defineType({
  name: 'promotionRichTextSection',
  title: 'Rich Text',
  type: 'object',
  icon: BlockContentIcon,
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (rule) => rule.max(100),
    }),
    defineField({
      name: 'body',
      title: 'Content',
      type: 'array',
      of: [portableTextBlock()],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'heading'},
    prepare: ({title}) => ({
      title: title || 'Rich text section',
      subtitle: 'Rich Text',
      media: BlockContentIcon,
    }),
  },
})

export const promotionNoticeSectionType = defineType({
  name: 'promotionNoticeSection',
  title: 'Notice',
  type: 'object',
  icon: InfoOutlineIcon,
  initialValue: {importance: 'information'},
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (rule) => rule.max(100),
    }),
    defineField({
      name: 'importance',
      title: 'Importance',
      type: 'string',
      options: {
        layout: 'radio',
        list: [
          {title: 'Information', value: 'information'},
          {title: 'Important', value: 'important'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'body',
      title: 'Message',
      type: 'array',
      of: [portableTextBlock()],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    select: {title: 'heading', importance: 'importance'},
    prepare: ({title, importance}) => ({
      title: title || 'Notice',
      subtitle: importance === 'important' ? 'Important Notice' : 'Information Notice',
      media: InfoOutlineIcon,
    }),
  },
})

export const promotionCallToActionSectionType = defineType({
  name: 'promotionCallToActionSection',
  title: 'Call to Action',
  type: 'object',
  icon: LinkIcon,
  initialValue: {destinationType: 'eligibleGowns'},
  fields: [
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (rule) => rule.required().max(100),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(400),
    }),
    defineField({
      name: 'linkLabel',
      title: 'Button label',
      type: 'string',
      validation: (rule) => rule.required().max(50),
    }),
    defineField({
      name: 'destinationType',
      title: 'Destination',
      type: 'string',
      options: {
        layout: 'radio',
        list: [
          {title: 'Eligible gowns for this offer', value: 'eligibleGowns'},
          {title: 'Book this offer', value: 'bookNow'},
          {title: 'Another website page', value: 'internal'},
          {title: 'External website', value: 'external'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'internalPath',
      title: 'Website path',
      type: 'string',
      description: 'Example: /rental-tiers',
      hidden: ({parent}) =>
        (parent as {destinationType?: string} | undefined)?.destinationType !== 'internal',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as {destinationType?: string} | undefined
          if (parent?.destinationType !== 'internal') return true
          return typeof value === 'string' && value.startsWith('/')
            ? true
            : 'Enter a website path beginning with /'
        }),
    }),
    defineField({
      name: 'externalUrl',
      title: 'External URL',
      type: 'url',
      hidden: ({parent}) =>
        (parent as {destinationType?: string} | undefined)?.destinationType !== 'external',
      validation: (rule) =>
        rule.uri({scheme: ['http', 'https']}).custom((value, context) => {
          const parent = context.parent as {destinationType?: string} | undefined
          if (parent?.destinationType !== 'external') return true
          return value ? true : 'Enter the external URL'
        }),
    }),
  ],
  preview: {
    select: {title: 'heading', subtitle: 'linkLabel'},
    prepare: ({title, subtitle}) => ({
      title: title || 'Call to Action',
      subtitle: subtitle ? `Call to Action · ${subtitle}` : 'Call to Action',
      media: LinkIcon,
    }),
  },
})

export const promotionPageSectionsType = defineType({
  name: 'promotionPageSections',
  title: 'Promotion Page Sections',
  type: 'array',
  of: [
    defineArrayMember({type: 'promotionPackageGroupSection'}),
    defineArrayMember({type: 'promotionRichTextSection'}),
    defineArrayMember({type: 'promotionNoticeSection'}),
    defineArrayMember({type: 'promotionCallToActionSection'}),
  ],
})
