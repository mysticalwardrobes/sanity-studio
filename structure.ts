import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {TagIcon} from '@sanity/icons/Tag'
import {CalendarIcon} from '@sanity/icons/Calendar'
import type {StructureResolver} from 'sanity/structure'

const SINGLETON_TYPES = new Set(['offersPage', 'eventsMilestonesPage'])

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Website Content')
    .items([
      S.listItem()
        .title('Offers Page')
        .icon(DocumentTextIcon)
        .child(S.document().schemaType('offersPage').documentId('offersPage').title('Offers Page')),
      S.listItem()
        .title('Promotions')
        .icon(TagIcon)
        .child(
          S.list()
            .title('Promotions')
            .items([
              S.documentTypeListItem('promotion').title('All Promotions'),
              S.listItem()
                .title('Active')
                .child(
                  S.documentList()
                    .title('Active Promotions')
                    .schemaType('promotion')
                    .filter('_type == "promotion" && startsAt <= now() && endsAt > now()'),
                ),
              S.listItem()
                .title('Upcoming')
                .child(
                  S.documentList()
                    .title('Upcoming Promotions')
                    .schemaType('promotion')
                    .filter('_type == "promotion" && startsAt > now()'),
                ),
              S.listItem()
                .title('Expired')
                .child(
                  S.documentList()
                    .title('Expired Promotions')
                    .schemaType('promotion')
                    .filter('_type == "promotion" && endsAt <= now()'),
                ),
            ]),
        ),
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
                    .filter('_type == "eventMilestone" && featured == true'),
                ),
            ]),
        ),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (listItem) =>
          !SINGLETON_TYPES.has(listItem.getId() as string) &&
          listItem.getId() !== 'promotion' &&
          listItem.getId() !== 'eventMilestone',
      ),
    ])
