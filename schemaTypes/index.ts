import type {SchemaTypeDefinition} from 'sanity'
import {offersPageType} from './offersPage'
import {promotionType} from './promotion'
import {eventMilestoneType} from './eventMilestone'
import {eventsMilestonesPageType} from './eventsMilestonesPage'

export const schemaTypes = [
  offersPageType,
  promotionType,
  eventMilestoneType,
  eventsMilestonesPageType,
] satisfies SchemaTypeDefinition[]
