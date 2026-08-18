import {at, defineMigration, patch, set, transaction, unset} from 'sanity/migrate'

type SlugValue = {_type?: string; current?: string}

type PromotionValue = {
  title?: string
  slug?: SlugValue
  description?: string
}

type SplitMarker = {
  desiredVisibility?: boolean
  desiredHomepageFeature?: boolean
  desiredHomepageOrder?: number | null
}

export default defineMigration({
  title: 'Finalize direct promotion packages after the frontend cutover',
  documentTypes: ['promotionGroup'],
  filter: 'defined(packages) && (defined(promotions) || defined(_promotionSplitMigration))',
  migrate: {
    document(document) {
      const promotions = (document.promotions ?? []) as PromotionValue[]
      const firstPromotion = promotions[0]
      const marker = document._promotionSplitMigration as SplitMarker | undefined
      const originalPromotionMutation =
        firstPromotion?.title && firstPromotion.slug?.current
          ? patch(document._id, [
              at('internalName', set(firstPromotion.title)),
              at('title', set(firstPromotion.title)),
              at('slug', set(firstPromotion.slug)),
              at('summary', set(firstPromotion.description || document.summary)),
              at('promotions', unset()),
            ])
          : null

      const splitPromotionMutation = marker
        ? patch(document._id, [
          at('isVisible', set(marker.desiredVisibility !== false)),
          at('featureOnHomepage', set(marker.desiredHomepageFeature === true)),
          marker.desiredHomepageFeature && typeof marker.desiredHomepageOrder === 'number'
            ? at('homepageOrder', set(marker.desiredHomepageOrder))
            : at('homepageOrder', unset()),
          at('_promotionSplitMigration', unset()),
        ])
        : null

      if (originalPromotionMutation && splitPromotionMutation) {
        return transaction([originalPromotionMutation, splitPromotionMutation])
      }
      return originalPromotionMutation ?? splitPromotionMutation ?? undefined
    },
  },
})
