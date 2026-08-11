import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineArrayMember, defineField, defineType} from 'sanity'

export const offersPageType = defineType({
  name: 'offersPage',
  title: 'Offers Page',
  type: 'document',
  icon: DocumentTextIcon,
  initialValue: {
    eyebrow: 'Exclusive Offers',
    title: 'Special Offers',
    description:
      'Every celebration deserves a little magic. Explore our exclusive offers, seasonal promotions, and limited-time experiences. We encourage reserving early, as offers may end without prior notice once they reach their allocation or expiration.',
    specialOffersHeading: 'Special Offers',
    comingSoonHeading: 'Coming Soon',
    comingSoonIntroduction: 'Partner offers and more magical experiences are on the way.',
    noCurrentHeading: 'No Current Promotions',
    noCurrentMessage:
      'There are no active promotions and offers at the moment, but more magical offers are coming soon. ✨',
    seoTitle: 'Special Offers | Mystical Wardrobes',
    seoDescription: 'Explore limited-time gown rental offers and seasonal promotions from Mystical Wardrobes.',
  },
  fields: [
    defineField({name: 'eyebrow', type: 'string', validation: (rule) => rule.required()}),
    defineField({name: 'title', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'description',
      type: 'text',
      rows: 4,
      validation: (rule) => rule.required().max(500),
    }),
    defineField({
      name: 'specialOffersHeading',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'termsHeading',
      title: 'Terms heading (Deprecated)',
      type: 'string',
      deprecated: {reason: 'Offer terms are now maintained in the website code.'},
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
    }),
    defineField({
      name: 'globalTerms',
      title: 'Global terms and conditions (Deprecated)',
      type: 'array',
      of: [defineArrayMember({type: 'block'})],
      deprecated: {reason: 'Offer terms are now maintained in the website code.'},
      readOnly: true,
      hidden: ({value}) => value === undefined,
      initialValue: undefined,
    }),
    defineField({
      name: 'comingSoonHeading',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'comingSoonIntroduction',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'noCurrentHeading', type: 'string', validation: (rule) => rule.required()}),
    defineField({
      name: 'noCurrentMessage',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({name: 'seoTitle', type: 'string', validation: (rule) => rule.required().max(60)}),
    defineField({
      name: 'seoDescription',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required().max(160),
    }),
    defineField({
      name: 'socialImage',
      type: 'image',
      options: {hotspot: true},
      fields: [defineField({name: 'alt', type: 'string', validation: (rule) => rule.required()})],
    }),
  ],
  preview: {
    select: {title: 'title', subtitle: 'description', media: 'socialImage'},
  },
})
