import {at, defineMigration, setIfMissing} from 'sanity/migrate'

export default defineMigration({
  title: 'Nest promotion group packages under promotions',
  documentTypes: ['promotionGroup'],
  filter: 'defined(packages) && count(packages) > 0 && !defined(promotions)',
  migrate: {
    document(document) {
      const packages = Array.isArray(document.packages) ? document.packages : []
      if (packages.length === 0 || document.promotions !== undefined) return

      return at(
        'promotions',
        setIfMissing([
          {
            _type: 'promotionOffer',
            _key: 'availablePackages',
            title: 'Available Packages',
            slug: {_type: 'slug', current: 'available-packages'},
            packages,
          },
        ]),
      )
    },
  },
})
