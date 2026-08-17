import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineField, defineType} from 'sanity'

const versionOptions = [
  {title: 'Long gown / standard', value: 'longGown'},
  {title: 'Long gown alternate (Design 2 / Corset 2)', value: 'longGownAlt'},
  {title: 'Filipiniana', value: 'filipiniana'},
  {title: 'Pixie / short dress', value: 'pixie'},
  {title: 'Train', value: 'train'},
]

const cardSelectionField = (name: string, title: string) =>
  defineField({
    name,
    title,
    type: 'collectionCardSelection',
  })

export const collectionCardSelectionType = defineType({
  name: 'collectionCardSelection',
  title: 'Collection card cover',
  type: 'object',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'gown',
      title: 'Gown',
      type: 'reference',
      to: [{type: 'gown_temp'}],
      description: 'Choose the gown to feature on this collection card.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'version',
      title: 'Gown version',
      type: 'string',
      description:
        'The first photo from this version is used. If that version has no photo, the website keeps its automatic fallback cover.',
      options: {list: versionOptions, layout: 'radio'},
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {title: 'gown.name', version: 'version'},
    prepare({title, version}) {
      const versionTitle = versionOptions.find((option) => option.value === version)?.title
      return {
        title: title || 'Choose a gown',
        subtitle: versionTitle || 'Choose a version',
      }
    },
  },
})

export const collectionPageCardsType = defineType({
  name: 'collectionPageCards',
  title: 'Collection Page Cards',
  type: 'document',
  icon: DocumentTextIcon,
  description:
    'Choose the gown and gown version shown on every card in the Gowns, Kids, and Cultural collection directories.',
  fields: [
    defineField({
      name: 'gowns',
      title: 'Gowns Collection',
      type: 'object',
      options: {collapsible: true, collapsed: false},
      fields: [
        cardSelectionField('aLineSlimPetticoat', 'A-Line (W/ Slim Petticoat)'),
        cardSelectionField('ballGown', 'Ball gown'),
        cardSelectionField('filipiniana', 'Filipiniana'),
        cardSelectionField('highWaistlineMaternity', 'High Waistline & Maternity Dress'),
        cardSelectionField('maxi', 'Maxi'),
        cardSelectionField('mediumVolume', 'Medium volume'),
        cardSelectionField('mermaidFitted', 'Mermaid & fitted'),
        cardSelectionField('pixieShortDresses', 'Pixie - Short dresses'),
        cardSelectionField('plusSize', 'Plus Size'),
        cardSelectionField('sagalaFloresDeMayo', 'Sagala and Flores De mayo'),
        cardSelectionField('underarmCoverage', 'Underarm Coverage'),
        cardSelectionField('withSlit', 'With Slit'),
        cardSelectionField('withTrail', 'With Trail'),
      ],
    }),
    defineField({
      name: 'kids',
      title: 'Kids Collection',
      type: 'object',
      options: {collapsible: true, collapsed: false},
      fields: [
        cardSelectionField('birthdays', 'Birthdays'),
        cardSelectionField('culturalEvents', 'Cultural Events'),
        cardSelectionField('pageantsCompetitions', 'Pageants & Competitions'),
        cardSelectionField('photoshoots', 'Photoshoots'),
        cardSelectionField('sagalaFloresDeMayo', 'Sagala & Flores de Mayo'),
        cardSelectionField('themedEvents', 'Themed Events'),
      ],
    }),
    defineField({
      name: 'cultural',
      title: 'Cultural Collection',
      type: 'object',
      options: {collapsible: true, collapsed: false},
      fields: [
        cardSelectionField('filipinianaShawl', 'Filipiniana & Shawl'),
        cardSelectionField('hanfu', 'Hanfu'),
      ],
    }),
  ],
  preview: {
    prepare() {
      return {title: 'Collection Page Cards', subtitle: 'Gowns, Kids, and Cultural'}
    },
  },
})
