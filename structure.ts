import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {TagIcon} from '@sanity/icons/Tag'
import {CalendarIcon} from '@sanity/icons/Calendar'
import type {StructureResolver} from 'sanity/structure'

const SINGLETON_TYPES = new Set([
  'offersPage',
  'gownDiscountCampaign',
  'eventsMilestonesPage',
  'collectionPageCards',
])

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Website Content')
    .items([
      S.listItem()
        .title('Collection Page Cards')
        .icon(DocumentTextIcon)
        .child(
          S.document()
            .schemaType('collectionPageCards')
            .documentId('collectionPageCards')
            .title('Collection Page Cards'),
        ),
      S.listItem()
        .title('Offers Page')
        .icon(DocumentTextIcon)
        .child(S.document().schemaType('offersPage').documentId('offersPage').title('Offers Page')),
      S.listItem()
        .title('Gown Discount Campaign')
        .icon(TagIcon)
        .child(
          S.document()
            .schemaType('gownDiscountCampaign')
            .documentId('gownDiscountCampaign')
            .title('Gown Discount Campaign'),
        ),
      S.listItem()
        .title('Promotions')
        .icon(TagIcon)
        .child(
          S.list()
            .title('Promotions')
            .items([
              S.documentTypeListItem('promotionGroup').title('All Promotions'),
              S.listItem()
                .title('Hidden')
                .child(
                  S.documentList()
                    .title('Hidden Promotions')
                    .schemaType('promotionGroup')
                    .filter('_type == "promotionGroup" && isVisible == false'),
                ),
              S.listItem()
                .title('Active')
                .child(
                  S.documentList()
                    .title('Active Promotions')
                    .schemaType('promotionGroup')
                    .filter(
                      '_type == "promotionGroup" && coalesce(isVisible, true) == true && startsAt <= now() && endsAt > now()',
                    ),
                ),
              S.listItem()
                .title('Upcoming')
                .child(
                  S.documentList()
                    .title('Upcoming Promotions')
                    .schemaType('promotionGroup')
                    .filter(
                      '_type == "promotionGroup" && coalesce(isVisible, true) == true && startsAt > now()',
                    ),
                ),
              S.listItem()
                .title('Expired')
                .child(
                  S.documentList()
                    .title('Expired Promotions')
                    .schemaType('promotionGroup')
                    .filter('_type == "promotionGroup" && endsAt <= now()'),
                ),
              S.listItem()
                .title('Homepage')
                .child(
                  S.documentList()
                    .title('Homepage Promotions')
                    .schemaType('promotionGroup')
                    .filter('_type == "promotionGroup" && featureOnHomepage == true')
                    .defaultOrdering([{field: 'homepageOrder', direction: 'asc'}]),
                ),
            ]),
        ),
      S.listItem()
        .title('Legacy Promotions')
        .icon(TagIcon)
        .child(S.documentTypeList('promotion').title('Legacy Promotions')),
      S.listItem()
        .title('Events & Milestones Page')
        .icon(DocumentTextIcon)
        .child(
          S.document()
            .schemaType('eventsMilestonesPage')
            .documentId('eventsMilestonesPage')
            .title('Events & Milestones Page'),
        ),
      S.listItem()
        .title('Events & Milestones')
        .icon(CalendarIcon)
        .child(
          S.list()
            .title('Events & Milestones')
            .items([
              S.documentTypeListItem('eventMilestone').title('All'),
              ...[
                ['Awards', 'award'],
                ['Fashion Shows', 'fashionShow'],
                ['Special Events', 'specialEvent'],
                ['Company Milestones', 'companyMilestone'],
                ['Press Features', 'pressFeature'],
              ].map(([title, kind]) =>
                S.listItem()
                  .title(title)
                  .child(
                    S.documentList()
                      .title(title)
                      .schemaType('eventMilestone')
                      .filter('_type == "eventMilestone" && kind == $kind')
                      .params({kind}),
                  ),
              ),
              S.listItem()
                .title('Featured')
                .child(
                  S.documentList()
                    .title('Featured')
                    .schemaType('eventMilestone')
                    .filter('_type == "eventMilestone" && featured == true')
                    .defaultOrdering([
                      {field: 'homepageOrder', direction: 'asc'},
                      {field: 'startDate', direction: 'desc'},
                    ]),
                ),
            ]),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (listItem) =>
          !SINGLETON_TYPES.has(listItem.getId() as string) &&
          listItem.getId() !== 'promotion' &&
          listItem.getId() !== 'promotionGroup' &&
          listItem.getId() !== 'eventMilestone',
      ),
    ])
