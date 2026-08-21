import type {SchemaTypeDefinition} from 'sanity'
import {offersPageType} from './offersPage'
import {promotionType} from './promotion'
import {eventMilestoneType} from './eventMilestone'
import {eventsMilestonesPageType} from './eventsMilestonesPage'
import {promotionGroupType} from './promotionGroup'
import {promotionPackageType} from './promotionPackage'
import {promotionRentalTierTableType} from './promotionRentalTierTable'
import {promotionOfferType} from './promotionOffer'
import {gownDiscountCampaignType} from './gownDiscountCampaign'
import {
  promotionCallToActionSectionType,
  promotionNoticeSectionType,
  promotionPackageGroupSectionType,
  promotionPageSectionsType,
  promotionRichTextSectionType,
} from './promotionPageSections'
import {collectionCardSelectionType, collectionPageCardsType} from './collectionPageCards'

export const schemaTypes = [
  collectionCardSelectionType,
  collectionPageCardsType,
  offersPageType,
  gownDiscountCampaignType,
  promotionPackageGroupSectionType,
  promotionRichTextSectionType,
  promotionNoticeSectionType,
  promotionCallToActionSectionType,
  promotionPageSectionsType,
  promotionRentalTierTableType,
  promotionPackageType,
  promotionOfferType,
  promotionGroupType,
  promotionType,
  eventMilestoneType,
  eventsMilestonesPageType,
] satisfies SchemaTypeDefinition[]
