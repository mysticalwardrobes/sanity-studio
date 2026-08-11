import type {SchemaTypeDefinition} from 'sanity'
import {offersPageType} from './offersPage'
import {promotionType} from './promotion'
import {eventMilestoneType} from './eventMilestone'
import {eventsMilestonesPageType} from './eventsMilestonesPage'
import {promotionGroupType} from './promotionGroup'
import {promotionPackageType} from './promotionPackage'
import {
  promotionCallToActionSectionType,
  promotionNoticeSectionType,
  promotionPackageGroupSectionType,
  promotionPageSectionsType,
  promotionRichTextSectionType,
} from './promotionPageSections'

export const schemaTypes = [
  offersPageType,
  promotionPackageGroupSectionType,
  promotionRichTextSectionType,
  promotionNoticeSectionType,
  promotionCallToActionSectionType,
  promotionPageSectionsType,
  promotionPackageType,
  promotionGroupType,
  promotionType,
  eventMilestoneType,
  eventsMilestonesPageType,
] satisfies SchemaTypeDefinition[]
