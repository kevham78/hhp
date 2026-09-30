import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

// Lightweight setup: keep the rules that catch real bugs (React hooks,
// Next.js correctness) and turn off the ones that are just noise here.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Set explicitly: eslint-plugin-react's auto-detect breaks on ESLint 10.
    settings: { react: { version: '19.3' } },
    rules: {
      // `any` is used deliberately throughout; not worth churning.
      '@typescript-eslint/no-explicit-any': 'off',
      // NHL team logos are external SVGs — plain <img> is intentional.
      '@next/next/no-img-element': 'off',
      // Apostrophes in JSX text render fine; escaping them is pure churn.
      'react/no-unescaped-entities': 'off',
      // We set state in effects on purpose to format dates / read the URL
      // client-side only, which avoids server/client hydration mismatches.
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts', 'prisma/**/*.mjs']),
])
