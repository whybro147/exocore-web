const fs = require('fs');
const path = require('path');
const { build } = require('esbuild');
const { solidPlugin } = require('esbuild-plugin-solid');
// build jsx dude
const publicDir = path.resolve(__dirname, 'public');

const publicDirJs = path.resolve(__dirname, 'public', 'src');

const jsxFiles = fs.readdirSync(publicDir).filter((file) => file.endsWith('.jsx'));

async function buildAll() {
  for (const file of jsxFiles) {
    const entryPoint = path.join(publicDir, file);
    const outfile = path.join(publicDirJs, file.replace(/\.jsx$/, '.js'));

    console.log(`Building ${file} → ${path.relative(__dirname, outfile)}`);

    await build({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      format: 'esm',
      plugins: [solidPlugin()],
      jsx: 'automatic',
      jsxImportSource: 'solid-js',
    });
  }
}

buildAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
