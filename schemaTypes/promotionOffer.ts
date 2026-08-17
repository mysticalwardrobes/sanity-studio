import {TagsIcon} from '@sanity/icons/Tags'
import {defineArrayMember, defineField, defineType} from 'sanity'

type PackageValue = {
  slug?: {current?: string}
  isAvailable?: boolean
}

export const promotionOfferType = defineType({
  name: 'promotionOffer',
  title: 'Promotion',
  type: 'object',
  icon: TagsIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Promotion title',
      type: 'string',
      validation: (rule) => rule.required().max(90),
    }),
    defineField({
      name: 'slug',
      title: 'Promotion slug',
      type: 'slug',
      options: {source: 'title', maxLength: 96},
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Promotion description',
      type: 'text',
      rows: 3,
      description: 'Optional introduction shown below the promotion title.',
      validation: (rule) => rule.max(320),
    }),
    defineField({
      name: 'availabilityNote',
      title: 'Availability note',
      type: 'string',
      description: 'Optional short note, for example “Open for 30 slots only.”',
      validation: (rule) => rule.max(120),
    }),
    defineField({
      name: 'packages',
      title: 'Promotion packages',
      type: 'array',
      description: 'Create packages here and drag them into the order customers should see.',
      of: [defineArrayMember({type: 'promotionPackage'})],
      validation: (rule) =>
        rule
          .required()
          .min(1)
          .custom((value) => {
            const packages = (value ?? []) as PackageValue[]
            const slugs = packages
              .map((item) => item.slug?.current?.trim().toLowerCase())
              .filter((slug): slug is string => Boolean(slug))
            return new Set(slugs).size === slugs.length
              ? true
              : 'Every package in this promotion must have a unique slug'
          }),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      availabilityNote: 'availabilityNote',
      packages: 'packages',
    },
    prepare({title, availabilityNote, packages}) {
      const packageCount = Array.isArray(packages)
        ? packages.filter((item: PackageValue) => item.isAvailable !== false).length
        : 0
      return {
        title: title || 'Untitled promotion',
        subtitle: [
          availabilityNote,
          `${packageCount} package${packageCount === 1 ? '' : 's'}`,
        ]
          .filter(Boolean)
          .join(' · '),
        media: TagsIcon,
      }
    },
  },
})
