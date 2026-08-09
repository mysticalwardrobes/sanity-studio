import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'yz23zros',
    dataset: 'production'
  },
  typegen: {
    enabled: true,
    path: '../mysticalwardrobes/{app,components,lib}/**/*.{ts,tsx}',
    schema: 'schema.json',
    generates: '../mysticalwardrobes/sanity.types.ts',
    overloadClientMethods: true,
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  }
})
