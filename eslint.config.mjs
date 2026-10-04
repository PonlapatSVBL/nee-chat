import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import boundaries from 'eslint-plugin-boundaries';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'application', pattern: 'src/application/**' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },
        { type: 'presentation', pattern: ['src/presentation/**', 'src/app/**', 'src/middleware.ts'] },
        { type: 'test', pattern: 'src/test/**' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'domain', allow: ['domain'] },
            { from: 'application', allow: ['domain', 'application'] },
            { from: 'infrastructure', allow: ['domain', 'application', 'infrastructure'] },
            { from: 'presentation', allow: ['domain', 'application', 'infrastructure', 'presentation'] },
            { from: 'test', allow: ['domain', 'application', 'infrastructure', 'presentation', 'test'] },
          ],
        },
      ],
      'boundaries/no-unknown-files': 'off',
    },
  },
  { ignores: ['.next/**', 'public/sw.js', 'node_modules/**', 'next-env.d.ts', 'src/infrastructure/db/migrations/**'] },
];

export default eslintConfig;
