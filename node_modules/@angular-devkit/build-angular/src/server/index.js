"use strict";
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@angular-devkit/core");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const webpack = require("webpack");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const utils_1 = require("../angular-cli-files/models/webpack-configs/utils");
const read_tsconfig_1 = require("../angular-cli-files/utilities/read-tsconfig");
const require_project_module_1 = require("../angular-cli-files/utilities/require-project-module");
const stats_1 = require("../angular-cli-files/utilities/stats");
const utils_2 = require("../utils");
const webpackMerge = require('webpack-merge');
class ServerBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        // TODO: verify using of(null) to kickstart things is a pattern.
        return rxjs_1.of(null).pipe(operators_1.concatMap(() => options.deleteOutputPath
            ? this._deleteOutputDir(root, core_1.normalize(options.outputPath), this.context.host)
            : rxjs_1.of(null)), operators_1.concatMap(() => utils_2.addFileReplacements(root, host, options.fileReplacements)), operators_1.concatMap(() => new rxjs_1.Observable(obs => {
            // Ensure Build Optimizer is only used with AOT.
            let webpackConfig;
            try {
                webpackConfig = this.buildWebpackConfig(root, projectRoot, host, options);
            }
            catch (e) {
                // TODO: why do I have to catch this error? I thought throwing inside an observable
                // always got converted into an error.
                obs.error(e);
                return;
            }
            const webpackCompiler = webpack(webpackConfig);
            const statsConfig = utils_1.getWebpackStatsConfig(options.verbose);
            const callback = (err, stats) => {
                if (err) {
                    return obs.error(err);
                }
                const json = stats.toJson(statsConfig);
                if (options.verbose) {
                    this.context.logger.info(stats.toString(statsConfig));
                }
                else {
                    this.context.logger.info(stats_1.statsToString(json, statsConfig));
                }
                if (stats.hasWarnings()) {
                    this.context.logger.warn(stats_1.statsWarningsToString(json, statsConfig));
                }
                if (stats.hasErrors()) {
                    this.context.logger.error(stats_1.statsErrorsToString(json, statsConfig));
                }
                obs.next({ success: !stats.hasErrors() });
                obs.complete();
            };
            try {
                webpackCompiler.run(callback);
            }
            catch (err) {
                if (err) {
                    this.context.logger.error('\nAn error occured during the build:\n' + ((err && err.stack) || err));
                }
                throw err;
            }
        })));
    }
    buildWebpackConfig(root, projectRoot, host, options) {
        let wco;
        // TODO: make target defaults into configurations instead
        // options = this.addTargetDefaults(options);
        const tsConfigPath = core_1.getSystemPath(core_1.normalize(core_1.resolve(root, core_1.normalize(options.tsConfig))));
        const tsConfig = read_tsconfig_1.readTsconfig(tsConfigPath);
        const projectTs = require_project_module_1.requireProjectModule(core_1.getSystemPath(projectRoot), 'typescript');
        const supportES2015 = tsConfig.options.target !== projectTs.ScriptTarget.ES3
            && tsConfig.options.target !== projectTs.ScriptTarget.ES5;
        const buildOptions = Object.assign({}, options);
        wco = {
            root: core_1.getSystemPath(root),
            projectRoot: core_1.getSystemPath(projectRoot),
            // TODO: use only this.options, it contains all flags and configs items already.
            buildOptions: Object.assign({}, buildOptions, { aot: true, platform: 'server', scripts: [], styles: [] }),
            tsConfig,
            tsConfigPath,
            supportES2015,
        };
        const webpackConfigs = [
            webpack_configs_1.getCommonConfig(wco),
            webpack_configs_1.getServerConfig(wco),
            webpack_configs_1.getStylesConfig(wco),
        ];
        if (wco.buildOptions.main || wco.buildOptions.polyfills) {
            const typescriptConfigPartial = wco.buildOptions.aot
                ? webpack_configs_1.getAotConfig(wco, host)
                : webpack_configs_1.getNonAotConfig(wco, host);
            webpackConfigs.push(typescriptConfigPartial);
        }
        return webpackMerge(webpackConfigs);
    }
    _deleteOutputDir(root, outputPath, host) {
        const resolvedOutputPath = core_1.resolve(root, outputPath);
        if (resolvedOutputPath === root) {
            throw new Error('Output path MUST not be project root directory!');
        }
        return host.exists(resolvedOutputPath).pipe(operators_1.concatMap(exists => exists
            // TODO: remove this concat once host ops emit an event.
            ? rxjs_1.concat(host.delete(resolvedOutputPath), rxjs_1.of(null)).pipe(operators_1.last())
            // ? of(null)
            : rxjs_1.of(null)));
    }
}
exports.ServerBuilder = ServerBuilder;
exports.default = ServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3NlcnZlci9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQVFILCtDQUEwRjtBQUUxRiwrQkFBOEM7QUFDOUMsOENBQWlEO0FBRWpELG1DQUFtQztBQUVuQyxpRkFNcUQ7QUFDckQsNkVBQTBGO0FBQzFGLGdGQUE0RTtBQUM1RSxrR0FBNkY7QUFDN0YsZ0VBSThDO0FBQzlDLG9DQUErQztBQUUvQyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7QUFHOUM7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTZEO1FBQy9ELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUE2QixDQUFDLENBQUM7UUFFakYsZ0VBQWdFO1FBQ2hFLE1BQU0sQ0FBQyxTQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUNsQixxQkFBUyxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0I7WUFDdEMsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsZ0JBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUM7WUFDL0UsQ0FB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Q0FxSUM7QUFFRCxrQkFBZSxhQUFhLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7XG4gIEJ1aWxkRXZlbnQsXG4gIEJ1aWxkZXIsXG4gIEJ1aWxkZXJDb25maWd1cmF0aW9uLFxuICBCdWlsZGVyQ29udGV4dCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2FyY2hpdGVjdCc7XG5pbXBvcnQgeyBQYXRoLCBnZXRTeXN0ZW1QYXRoLCBub3JtYWxpemUsIHJlc29sdmUsIHZpcnR1YWxGcyB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7IFN0YXRzIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgY29uY2F0LCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgY29uY2F0TWFwLCBsYXN0IH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8taW1wbGljaXQtZGVwZW5kZW5jaWVzXG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgV2VicGFja0NvbmZpZ09wdGlvbnMgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvYnVpbGQtb3B0aW9ucyc7XG5pbXBvcnQge1xuICBnZXRBb3RDb25maWcsXG4gIGdldENvbW1vbkNvbmZpZyxcbiAgZ2V0Tm9uQW90Q29uZmlnLFxuICBnZXRTZXJ2ZXJDb25maWcsXG4gIGdldFN0eWxlc0NvbmZpZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvbW9kZWxzL3dlYnBhY2stY29uZmlncyc7XG5pbXBvcnQgeyBnZXRXZWJwYWNrU3RhdHNDb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3V0aWxzJztcbmltcG9ydCB7IHJlYWRUc2NvbmZpZyB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9yZWFkLXRzY29uZmlnJztcbmltcG9ydCB7IHJlcXVpcmVQcm9qZWN0TW9kdWxlIH0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3JlcXVpcmUtcHJvamVjdC1tb2R1bGUnO1xuaW1wb3J0IHtcbiAgc3RhdHNFcnJvcnNUb1N0cmluZyxcbiAgc3RhdHNUb1N0cmluZyxcbiAgc3RhdHNXYXJuaW5nc1RvU3RyaW5nLFxufSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy91dGlsaXRpZXMvc3RhdHMnO1xuaW1wb3J0IHsgYWRkRmlsZVJlcGxhY2VtZW50cyB9IGZyb20gJy4uL3V0aWxzJztcbmltcG9ydCB7IEJ1aWxkV2VicGFja1NlcnZlclNjaGVtYSB9IGZyb20gJy4vc2NoZW1hJztcbmNvbnN0IHdlYnBhY2tNZXJnZSA9IHJlcXVpcmUoJ3dlYnBhY2stbWVyZ2UnKTtcblxuXG5leHBvcnQgY2xhc3MgU2VydmVyQnVpbGRlciBpbXBsZW1lbnRzIEJ1aWxkZXI8QnVpbGRXZWJwYWNrU2VydmVyU2NoZW1hPiB7XG5cbiAgY29uc3RydWN0b3IocHVibGljIGNvbnRleHQ6IEJ1aWxkZXJDb250ZXh0KSB7IH1cblxuICBydW4oYnVpbGRlckNvbmZpZzogQnVpbGRlckNvbmZpZ3VyYXRpb248QnVpbGRXZWJwYWNrU2VydmVyU2NoZW1hPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8U3RhdHM+KTtcblxuICAgIC8vIFRPRE86IHZlcmlmeSB1c2luZyBvZihudWxsKSB0byBraWNrc3RhcnQgdGhpbmdzIGlzIGEgcGF0dGVybi5cbiAgICByZXR1cm4gb2YobnVsbCkucGlwZShcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBvcHRpb25zLmRlbGV0ZU91dHB1dFBhdGhcbiAgICAgICAgPyB0aGlzLl9kZWxldGVPdXRwdXREaXIocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMub3V0cHV0UGF0aCksIHRoaXMuY29udGV4dC5ob3N0KVxuICAgICAgICA6IG9mKG51bGwpKSxcbiAgICAgICAgY29uY2F0TWFwKCgpID0+IGFkZEZpbGVSZXBsYWNlbWVudHMocm9vdCwgaG9zdCwgb3B0aW9ucy5maWxlUmVwbGFjZW1lbnRzKSksXG4gICAgICAgIGNvbmNhdE1hcCgoKSA9PiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgICAvLyBFbnN1cmUgQnVpbGQgT3B0aW1pemVyIGlzIG9ubHkgdXNlZCB3aXRoIEFPVC5cbiAgICAgICAgbGV0IHdlYnBhY2tDb25maWc7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgd2VicGFja0NvbmZpZyA9IHRoaXMuYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3QsIHByb2plY3RSb290LCBob3N0LCBvcHRpb25zKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIC8vIFRPRE86IHdoeSBkbyBJIGhhdmUgdG8gY2F0Y2ggdGhpcyBlcnJvcj8gSSB0aG91Z2h0IHRocm93aW5nIGluc2lkZSBhbiBvYnNlcnZhYmxlXG4gICAgICAgICAgLy8gYWx3YXlzIGdvdCBjb252ZXJ0ZWQgaW50byBhbiBlcnJvci5cbiAgICAgICAgICBvYnMuZXJyb3IoZSk7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgd2VicGFja0NvbXBpbGVyID0gd2VicGFjayh3ZWJwYWNrQ29uZmlnKTtcbiAgICAgICAgY29uc3Qgc3RhdHNDb25maWcgPSBnZXRXZWJwYWNrU3RhdHNDb25maWcob3B0aW9ucy52ZXJib3NlKTtcblxuICAgICAgICBjb25zdCBjYWxsYmFjazogd2VicGFjay5jb21waWxlci5Db21waWxlckNhbGxiYWNrID0gKGVyciwgc3RhdHMpID0+IHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICByZXR1cm4gb2JzLmVycm9yKGVycik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QganNvbiA9IHN0YXRzLnRvSnNvbihzdGF0c0NvbmZpZyk7XG4gICAgICAgICAgaWYgKG9wdGlvbnMudmVyYm9zZSkge1xuICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzLnRvU3RyaW5nKHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0c1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHN0YXRzLmhhc1dhcm5pbmdzKCkpIHtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2FybihzdGF0c1dhcm5pbmdzVG9TdHJpbmcoanNvbiwgc3RhdHNDb25maWcpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHN0YXRzLmhhc0Vycm9ycygpKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKHN0YXRzRXJyb3JzVG9TdHJpbmcoanNvbiwgc3RhdHNDb25maWcpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBvYnMubmV4dCh7IHN1Y2Nlc3M6ICFzdGF0cy5oYXNFcnJvcnMoKSB9KTtcbiAgICAgICAgICBvYnMuY29tcGxldGUoKTtcbiAgICAgICAgfTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYnBhY2tDb21waWxlci5ydW4oY2FsbGJhY2spO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmVycm9yKFxuICAgICAgICAgICAgICAnXFxuQW4gZXJyb3Igb2NjdXJlZCBkdXJpbmcgdGhlIGJ1aWxkOlxcbicgKyAoKGVyciAmJiBlcnIuc3RhY2spIHx8IGVycikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pKSxcbiAgICApO1xuICB9XG5cbiAgYnVpbGRXZWJwYWNrQ29uZmlnKHJvb3Q6IFBhdGgsIHByb2plY3RSb290OiBQYXRoLFxuICAgICAgICAgICAgICAgICAgICAgaG9zdDogdmlydHVhbEZzLkhvc3Q8U3RhdHM+LFxuICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczogQnVpbGRXZWJwYWNrU2VydmVyU2NoZW1hKSB7XG4gICAgbGV0IHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnM7XG5cbiAgICAvLyBUT0RPOiBtYWtlIHRhcmdldCBkZWZhdWx0cyBpbnRvIGNvbmZpZ3VyYXRpb25zIGluc3RlYWRcbiAgICAvLyBvcHRpb25zID0gdGhpcy5hZGRUYXJnZXREZWZhdWx0cyhvcHRpb25zKTtcblxuICAgIGNvbnN0IHRzQ29uZmlnUGF0aCA9IGdldFN5c3RlbVBhdGgobm9ybWFsaXplKHJlc29sdmUocm9vdCwgbm9ybWFsaXplKG9wdGlvbnMudHNDb25maWcpKSkpO1xuICAgIGNvbnN0IHRzQ29uZmlnID0gcmVhZFRzY29uZmlnKHRzQ29uZmlnUGF0aCk7XG5cbiAgICBjb25zdCBwcm9qZWN0VHMgPSByZXF1aXJlUHJvamVjdE1vZHVsZShnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSwgJ3R5cGVzY3JpcHQnKSBhcyB0eXBlb2YgdHM7XG5cbiAgICBjb25zdCBzdXBwb3J0RVMyMDE1ID0gdHNDb25maWcub3B0aW9ucy50YXJnZXQgIT09IHByb2plY3RUcy5TY3JpcHRUYXJnZXQuRVMzXG4gICAgICAmJiB0c0NvbmZpZy5vcHRpb25zLnRhcmdldCAhPT0gcHJvamVjdFRzLlNjcmlwdFRhcmdldC5FUzU7XG5cbiAgICBjb25zdCBidWlsZE9wdGlvbnM6IHR5cGVvZiB3Y29bJ2J1aWxkT3B0aW9ucyddID0ge1xuICAgICAgLi4ub3B0aW9ucyBhcyB7fSBhcyB0eXBlb2Ygd2NvWydidWlsZE9wdGlvbnMnXSxcbiAgICB9O1xuXG4gICAgd2NvID0ge1xuICAgICAgcm9vdDogZ2V0U3lzdGVtUGF0aChyb290KSxcbiAgICAgIHByb2plY3RSb290OiBnZXRTeXN0ZW1QYXRoKHByb2plY3RSb290KSxcbiAgICAgIC8vIFRPRE86IHVzZSBvbmx5IHRoaXMub3B0aW9ucywgaXQgY29udGFpbnMgYWxsIGZsYWdzIGFuZCBjb25maWdzIGl0ZW1zIGFscmVhZHkuXG4gICAgICBidWlsZE9wdGlvbnM6IHtcbiAgICAgICAgLi4uYnVpbGRPcHRpb25zLFxuICAgICAgICBhb3Q6IHRydWUsXG4gICAgICAgIHBsYXRmb3JtOiAnc2VydmVyJyxcbiAgICAgICAgc2NyaXB0czogW10sXG4gICAgICAgIHN0eWxlczogW10sXG4gICAgICB9LFxuICAgICAgdHNDb25maWcsXG4gICAgICB0c0NvbmZpZ1BhdGgsXG4gICAgICBzdXBwb3J0RVMyMDE1LFxuICAgIH07XG5cbiAgICBjb25zdCB3ZWJwYWNrQ29uZmlnczoge31bXSA9IFtcbiAgICAgIGdldENvbW1vbkNvbmZpZyh3Y28pLFxuICAgICAgZ2V0U2VydmVyQ29uZmlnKHdjbyksXG4gICAgICBnZXRTdHlsZXNDb25maWcod2NvKSxcbiAgICBdO1xuXG4gICAgaWYgKHdjby5idWlsZE9wdGlvbnMubWFpbiB8fCB3Y28uYnVpbGRPcHRpb25zLnBvbHlmaWxscykge1xuICAgICAgY29uc3QgdHlwZXNjcmlwdENvbmZpZ1BhcnRpYWwgPSB3Y28uYnVpbGRPcHRpb25zLmFvdFxuICAgICAgICA/IGdldEFvdENvbmZpZyh3Y28sIGhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8U3RhdHM+KVxuICAgICAgICA6IGdldE5vbkFvdENvbmZpZyh3Y28sIGhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8U3RhdHM+KTtcbiAgICAgIHdlYnBhY2tDb25maWdzLnB1c2godHlwZXNjcmlwdENvbmZpZ1BhcnRpYWwpO1xuICAgIH1cblxuICAgIHJldHVybiB3ZWJwYWNrTWVyZ2Uod2VicGFja0NvbmZpZ3MpO1xuICB9XG5cbiAgcHJpdmF0ZSBfZGVsZXRlT3V0cHV0RGlyKHJvb3Q6IFBhdGgsIG91dHB1dFBhdGg6IFBhdGgsIGhvc3Q6IHZpcnR1YWxGcy5Ib3N0KSB7XG4gICAgY29uc3QgcmVzb2x2ZWRPdXRwdXRQYXRoID0gcmVzb2x2ZShyb290LCBvdXRwdXRQYXRoKTtcbiAgICBpZiAocmVzb2x2ZWRPdXRwdXRQYXRoID09PSByb290KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ091dHB1dCBwYXRoIE1VU1Qgbm90IGJlIHByb2plY3Qgcm9vdCBkaXJlY3RvcnkhJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGhvc3QuZXhpc3RzKHJlc29sdmVkT3V0cHV0UGF0aCkucGlwZShcbiAgICAgIGNvbmNhdE1hcChleGlzdHMgPT4gZXhpc3RzXG4gICAgICAgIC8vIFRPRE86IHJlbW92ZSB0aGlzIGNvbmNhdCBvbmNlIGhvc3Qgb3BzIGVtaXQgYW4gZXZlbnQuXG4gICAgICAgID8gY29uY2F0KGhvc3QuZGVsZXRlKHJlc29sdmVkT3V0cHV0UGF0aCksIG9mKG51bGwpKS5waXBlKGxhc3QoKSlcbiAgICAgICAgLy8gPyBvZihudWxsKVxuICAgICAgICA6IG9mKG51bGwpKSxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNlcnZlckJ1aWxkZXI7XG4iXX0=