import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { schemaTypes } from './schemaTypes'
import { types } from './migrate/schema'

export default defineConfig({
  name: 'default',
  title: 'mysticalwardrobes',

  projectId: 'yz23zros',
  dataset: 'production',

  plugins: [structureTool(), visionTool()],

  schema: {
    types: types,
  },
})
