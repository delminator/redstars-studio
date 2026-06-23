// Build pipeline for the plugin bundle.
//
// Produces a single ESM file `dist/plugin.js` that the host's loader
// fetches at runtime. React + react-dom are externals — the host
// provides them via window globals before evaluating the bundle.
//
// Build size targets:
//   - bundle gzipped < 60 KB (slot React trees + i18n strings only)
//   - no React, no @delminator/core-ui in the output
//
// CI signs `dist/plugin.js` with Ed25519 (scripts/plugin-sign.mjs) +
// uploads it alongside a `manifest.json` as a GitHub Release.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/plugin.ts',
      formats: ['es'],
      fileName: () => 'plugin.js',
    },
    rollupOptions: {
      // React is supplied by the host runtime. core-ui is types-only
      // and erased at compile time. Bundle ONLY the plugin's own
      // source.
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@delminator/core-ui',
        '@delminator/core-ui/native',
        // Host-provided shared components (UserCard, GameThumbnail, …).
        // Resolved at runtime from window.__shell__ via the host loader
        // shim — never bundled. See @delminator/core-ui/host.
        '@delminator/core-ui/host',
      ],
      // Inline every dynamic import (React.lazy chunks) into the
      // single plugin.js file. The host's loader evaluates the bundle
      // via Blob URL — relative-path dynamic imports would 404. The
      // total bundle stays small because slot components are <2 KB
      // each. React.lazy() still defers component code until first
      // mount, so we lose nothing on the runtime side.
      output: {
        inlineDynamicImports: true,
      },
    },
    sourcemap: true,
    minify: 'esbuild',
    emptyOutDir: true,
  },
})
