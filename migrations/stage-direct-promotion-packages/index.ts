import {at, create, defineMigration, patch, set, transaction} from 'sanity/migrate'

type SlugValue = {_type?: string; current?: string}

type PackageValue = Record<string, unknown> & {
  title?: string
  slug?: SlugValue
}

type PromotionValue = {
  _key?: string
  title?: string
  slug?: SlugValue
  description?: string
  packages?: PackageValue[]
}

const preparePackages = (promotion: PromotionValue) =>
  (promotion.packages ?? []).map((promotionPackage) => {
    const isDebutantsPackageOne =
      promotion.slug?.current === 'debutants-and-celebration' &&
      promotionPackage.slug?.current?.toLowerCase() === 'package-1'

    if (!isDebutantsPackageOne) return promotionPackage

    return {
      ...promotionPackage,
      title: 'Debutants Package 1',
      slug: {_type: 'slug', current: 'debutants-package-1'},
    }
  })

export default defineMigration({
  title: 'Stage direct promotion packages before the frontend cutover',
  documentTypes: ['promotionGroup'],
  filter: 'defined(promotions) && count(promotions) > 0 && !defined(packages)',
  migrate: {
    document(document) {
      const promotions = (document.promotions ?? []) as PromotionValue[]
      const [firstPromotion, ...additionalPromotions] = promotions
      if (!firstPromotion?.packages?.length) return

      const baseHomepageOrder =
        typeof document.homepageOrder === 'number' ? document.homepageOrder : 1
      const shouldFeature = document.featureOnHomepage === true
      const desiredVisibility = document.isVisible !== false

      const mutations = [
        patch(document._id, at('packages', set(preparePackages(firstPromotion)))),
        ...additionalPromotions
          .filter((promotion) => promotion.title && promotion.slug?.current && promotion.packages?.length)
          .map((promotion, index) =>
            create({
              _type: 'promotionGroup',
              internalName: promotion.title,
              title: promotion.title,
              slug: promotion.slug,
              category: document.category,
              summary: promotion.description || document.summary,
              ...(document.campaignImage ? {campaignImage: document.campaignImage} : {}),
              startsAt: document.startsAt,
              endsAt: document.endsAt,
              isVisible: false,
              priority: document.priority ?? 0,
              featureOnHomepage: false,
              packages: preparePackages(promotion),
              _promotionSplitMigration: {
                sourceId: document._id,
                sourcePromotionKey: promotion._key,
                desiredVisibility,
                desiredHomepageFeature: shouldFeature,
                desiredHomepageOrder: shouldFeature ? baseHomepageOrder + index + 1 : null,
              },
            }),
          ),
      ]

      return transaction(mutations)
    },
  },
})
