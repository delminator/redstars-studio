import { lazy } from 'react'
import type { PluginView } from '@delminator/core-ui'

// Studio = the in-app application builder. One screen: the visual composer
// (a custom slot — Studio is itself an app, but its builder is bespoke code).
export const collaboratorView: PluginView = {
  menu: [
    { id: 'builder', label: { fr: 'Créateur', en: 'Builder' }, icon: '🛠️' },
  ],
  slots: {
    builder: lazy(() => import('../studio/Builder')),
  },
}
