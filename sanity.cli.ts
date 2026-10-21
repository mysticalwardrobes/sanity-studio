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
    appId: 'wshy1vfezukril8t825ox32i',
    // Bundle installed dependencies so builds do not require the Sanity CDN.
    autoUpdates: false,
  }
})
