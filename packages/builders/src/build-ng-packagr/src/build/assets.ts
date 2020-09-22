import { BuilderContext } from '@angular-devkit/architect';
import { getSystemPath, normalize, resolve, virtualFs } from '@angular-devkit/core';
import { NodeJsSyncHost } from '@angular-devkit/core/node';
import * as fs from 'fs';
import * as globby from 'globby';
import { discoverPackages } from 'ng-packagr/lib/ng-package/discover-packages';
import * as log from 'ng-packagr/lib/utils/log';
import * as path from 'path';
import { Observable, from } from 'rxjs';
import { AssetPattern, normalizeAssetPatterns } from './assets-patterns';
import { AssetPatternClass, Schema as NgPackagrBuilderOptions, SingleAssetPatternClass } from './schema';

export function handleAssets(
  context: BuilderContext,
  options: NgPackagrBuilderOptions,
): Observable<any> {
  const host = new NodeJsSyncHost();
  const projectPath = resolve(normalize(context.workspaceRoot), normalize(path.dirname(options.project)));
  const projectRoot = getSystemPath(projectPath);

  return from(discoverPackages({ project: projectRoot }).then(ngPackage => {
    log.info('Copying Assets');
    const syncHost = new virtualFs.SyncDelegateHost(host);

    if (options.assets.length === 0) {
      return Promise.resolve();
    }

    const assets = normalizeAssetPatterns(
      options.assets,
      syncHost,
      projectPath,
      projectPath,
      undefined,
    );

    log.info(JSON.stringify({ assets: assets }, null, 2))

    return moveAssets(ngPackage.src, ngPackage.dest, assets);
  }));
}

function isSinglePattern(asset: any): boolean {
  return asset.inputFile !== undefined
}

/**
 *
 * @see https://github.com/angular/angular-cli/blob/29609fb0785646fdbb636b08853a13df65fac06a/packages/angular_devkit/build_angular/src/angular-cli-files/models/webpack-configs/common.ts#L160-L188
 */
function moveAssets(
  src: string,
  dest: string,
  assets: AssetPattern[],
): Promise<any> {
  try {
    const copyWebpackPluginPatterns = assets.map(
      (_asset: AssetPatternClass | SingleAssetPatternClass) => {
        if (!isSinglePattern(_asset)) {
          const asset = _asset as AssetPatternClass
          // Resolve input paths relative to workspace root and add slash at the end.
          asset.input = path.resolve(src, asset.input).replace(/\\/g, '/');
          asset.input = asset.input.endsWith('/')
            ? asset.input
            : asset.input + '/';
          asset.output = asset.output.endsWith('/')
            ? asset.output
            : asset.output + '/';

          if (asset.output.startsWith('..')) {
            const message =
              'An asset cannot be written to a location outside of the output path.';
            throw new Error(message);
          }

          return {
            context: asset.input,
            // Now we remove starting slash to make Webpack place it from the output root.
            to: asset.output.replace(/^\//, ''),
            ignore: asset.ignore,
            from: {
              glob: asset.glob,
              dot: true,
            },
          };
        } else {
          const asset = _asset as SingleAssetPatternClass
          // log.info('handle single')
          // log.info(JSON.stringify(asset, null, 2))

          const inputFile = path.resolve(src, asset.inputFile).replace(/\\/g, '/');
          const outputFile = path.join(dest, asset.outputFile)

          return {
            // context: asset.inputFile,
            // Now we remove starting slash to make Webpack place it from the output root.
            to: outputFile.replace(/^\//, ''),
            // ignore: asset.ignore,
            from: inputFile,
            toType: 'file'
          };
        }
      },
    );

    const copyPromises = copyWebpackPluginPatterns.map(rule => {
      // log.info('rule')
      // log.info(JSON.stringify(rule, null, 2))
      if (rule.toType !== 'file') {
        const pattern = rule.context + (rule.from as any).glob;

        return globby(pattern, { dot: (rule.from as any).dot }).then(entries => {
          entries.forEach(entry => {
            const cleanFilePath = entry.replace((rule as any).context, '');
            const to = path.resolve(dest, rule.to, cleanFilePath);
            const pathToFolder = path.dirname(to);
            pathToFolder.split(path.sep).reduce((p, folder) => {
              p += folder + path.sep;
              if (!fs.existsSync(p)) {
                fs.mkdirSync(p);
              }
              return p;
            }, '');

            fs.copyFileSync(entry, to);
            log.success(` - from: ${entry}`);
            log.success(` - to: ${to}`);
          });
        });
      } else {
        fs.copyFileSync(rule.from as string, rule.to);
        log.success(` -+ from: ${rule.from}`);
        log.success(` -+ to: ${rule.to}`);
      }
    });

    return Promise.all(copyPromises);
  } catch (e) {
    log.error(e.message);
    return Promise.resolve();
  }
}
