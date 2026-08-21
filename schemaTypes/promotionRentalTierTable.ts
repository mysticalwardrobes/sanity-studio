import {ThListIcon} from '@sanity/icons/ThList'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {rentalTierEligibilityOptions} from './gownV2Eligibility'

export const promotionRentalTierTableType = defineType({
  name: 'promotionRentalTierTable',
  title: 'Rental Tier Table',
  type: 'object',
  icon: ThListIcon,
  initialValue: {
    tiers: rentalTierEligibilityOptions.map((tier) => tier.value),
  },
  fields: [
    defineField({
      name: 'tiers',
      title: 'Visible rental tiers',
      type: 'array',
      description:
        'Choose the tiers to show. They appear from lowest to highest Metro Manila rate on the website.',
      of: [defineArrayMember({type: 'string'})],
      options: {list: [...rentalTierEligibilityOptions]},
      validation: (rule) => rule.required().min(1).unique(),
    }),
  ],
  preview: {
    select: {tiers: 'tiers'},
    prepare({tiers}) {
      const selectedTiers = Array.isArray(tiers) ? tiers : []
      const labels = rentalTierEligibilityOptions
        .filter((tier) => selectedTiers.includes(tier.value))
        .map((tier) => tier.title)

      return {
        title: 'Rental Tier Table',
        subtitle: labels.length ? labels.join(', ') : 'No tiers selected',
        media: ThListIcon,
      }
    },
  },
})
