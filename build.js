const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['background.js'],
  bundle: true,
  outfile: 'dist/background.js',
  format: 'esm',
  platform: 'browser',
  loader: {
    '.js': 'jsx'
  },
  minify: false,
  sourcemap: true,
  target: ['chrome58'],
  external: ['chrome'],
  nodePaths: ['./node_modules'],
  resolveExtensions: ['.js', '.json'],
  mainFields: ['browser', 'module', 'main']
}).catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});