#!/bin/bash

rm -rf dist/packages/builders

tsc -p packages/builders/tsconfig.json

# rsync -a packages/builders/. dist/packages/builders --exclude *.ts --exclude tsconfig.json
cp packages/builders/src/build-ng-packagr/src/build/schema.json dist/packages/builders/src/build-ng-packagr/src/build/schema.json
cp packages/builders/src/build-ng-packagr/builders.json dist/packages/builders/src/build-ng-packagr/builders.json
cp packages/builders/src/build-ng-packagr/package.json dist/packages/builders/src/build-ng-packagr/package.json

cp LICENSE dist/packages/builders/src/build-ng-packagr/LICENSE
cp README.md dist/packages/builders/src/build-ng-packagr/README.md

echo "Build of builders finished"
