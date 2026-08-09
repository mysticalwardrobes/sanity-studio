import type {SchemaTypeDefinition} from 'sanity'
import {offersPageType} from './offersPage'
import {promotionType} from './promotion'

export const schemaTypes = [offersPageType, promotionType] satisfies SchemaTypeDefinition[]
