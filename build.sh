rm -rf dist
rm -rf build
rm -rf tmp


npm run build:esm
node node_modules/.bin/ngc -p ./tsconfig-build.json
node node_modules/.bin/rollup -c

rsync -a --exclude=*.js build/ dist
cp src/package.json dist/package.json