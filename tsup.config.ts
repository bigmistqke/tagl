import type { Options } from 'tsup'

const env = process.env.NODE_ENV

export const tsup: Options = {
  splitting: false,
  sourcemap: env === 'prod', // source map is only available in prod
  clean: true, // rimraf disr
  dts: true, // generate dts file for main module
  format: ['cjs', 'esm'], // generate cjs and esm files
  minify: env === 'production',
  bundle: env === 'production',
  skipNodeModulesBundle: true,
  entryPoints: ['src/core/index.ts', 'src/world/index.ts', 'src/world/text/index.ts'],
  watch: env === 'development',
  target: 'es2020',
  outDir: env === 'production' ? 'dist' : 'lib',
  // prettier-ignore
  entry: [
    'src/core/index.ts', 
    'src/world/index.ts', 
    'src/world/text/index.ts', 
    'src/world/controls/index.ts',
    'src/world/bounds/index.ts',
    'src/world/h/index.ts',
  ],
}
