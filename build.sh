rm -rf dist
rm -rf build

NGC="node node_modules/.bin/ngc"

ROLLUP="node node_modules/.bin/rollup"

$NGC -p ./src/tsconfig-build.json
$ROLLUP build/product-header.js -o dist/product-header.js -f umd --name "product-header"

rsync -a --exclude=*.js build/ dist
cp src/package.json dist/package.json
