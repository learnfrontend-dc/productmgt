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
const fs_1 = require("fs");
const path = require("path");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const url = require("url");
const webpack = require("webpack");
const utils_1 = require("../angular-cli-files/models/webpack-configs/utils");
const check_port_1 = require("../angular-cli-files/utilities/check-port");
const stats_1 = require("../angular-cli-files/utilities/stats");
const _1 = require("../browser/");
const utils_2 = require("../utils");
const opn = require('opn');
const WebpackDevServer = require('webpack-dev-server');
class DevServerBuilder {
    constructor(context) {
        this.context = context;
    }
    run(builderConfig) {
        const options = builderConfig.options;
        const root = this.context.workspace.root;
        const projectRoot = core_1.resolve(root, builderConfig.root);
        const host = new core_1.virtualFs.AliasHost(this.context.host);
        let browserOptions;
        return check_port_1.checkPort(options.port, options.host).pipe(operators_1.tap((port) => options.port = port), operators_1.concatMap(() => this._getBrowserOptions(options)), operators_1.tap((opts) => browserOptions = opts), operators_1.concatMap(() => utils_2.addFileReplacements(root, host, browserOptions.fileReplacements)), operators_1.concatMap(() => utils_2.normalizeAssetPatterns(browserOptions.assets, host, root, projectRoot, builderConfig.sourceRoot)), 
        // Replace the assets in options with the normalized version.
        operators_1.tap((assetPatternObjects => browserOptions.assets = assetPatternObjects)), operators_1.concatMap(() => new rxjs_1.Observable(obs => {
            const browserBuilder = new _1.BrowserBuilder(this.context);
            const webpackConfig = browserBuilder.buildWebpackConfig(root, projectRoot, host, browserOptions);
            const statsConfig = utils_1.getWebpackStatsConfig(browserOptions.verbose);
            let webpackDevServerConfig;
            try {
                webpackDevServerConfig = this._buildServerConfig(root, projectRoot, options, browserOptions);
            }
            catch (err) {
                obs.error(err);
                return;
            }
            // Resolve public host and client address.
            let clientAddress = `${options.ssl ? 'https' : 'http'}://0.0.0.0:0`;
            if (options.publicHost) {
                let publicHost = options.publicHost;
                if (!/^\w+:\/\//.test(publicHost)) {
                    publicHost = `${options.ssl ? 'https' : 'http'}://${publicHost}`;
                }
                const clientUrl = url.parse(publicHost);
                options.publicHost = clientUrl.host;
                clientAddress = url.format(clientUrl);
            }
            // Resolve serve address.
            const serverAddress = url.format({
                protocol: options.ssl ? 'https' : 'http',
                hostname: options.host === '0.0.0.0' ? 'localhost' : options.host,
                port: options.port.toString(),
            });
            // Add live reload config.
            if (options.liveReload) {
                this._addLiveReload(options, browserOptions, webpackConfig, clientAddress);
            }
            else if (options.hmr) {
                this.context.logger.warn('Live reload is disabled. HMR option ignored.');
            }
            if (!options.watch) {
                // There's no option to turn off file watching in webpack-dev-server, but
                // we can override the file watcher instead.
                webpackConfig.plugins.unshift({
                    // tslint:disable-next-line:no-any
                    apply: (compiler) => {
                        compiler.hooks.afterEnvironment.tap('angular-cli', () => {
                            compiler.watchFileSystem = { watch: () => { } };
                        });
                    },
                });
            }
            if (browserOptions.optimization) {
                this.context.logger.error(core_1.tags.stripIndents `
            ****************************************************************************************
            This is a simple server for use in testing or debugging Angular applications locally.
            It hasn't been reviewed for security issues.

            DON'T USE IT FOR PRODUCTION!
            ****************************************************************************************
          `);
            }
            this.context.logger.info(core_1.tags.oneLine `
          **
          Angular Live Development Server is listening on ${options.host}:
          ${options.port}, open your browser on ${serverAddress}${webpackDevServerConfig.publicPath}
          **
        `);
            const webpackCompiler = webpack(webpackConfig);
            const server = new WebpackDevServer(webpackCompiler, webpackDevServerConfig);
            let first = true;
            // tslint:disable-next-line:no-any
            webpackCompiler.hooks.done.tap('angular-cli', (stats) => {
                if (!browserOptions.verbose) {
                    const json = stats.toJson(statsConfig);
                    this.context.logger.info(stats_1.statsToString(json, statsConfig));
                    if (stats.hasWarnings()) {
                        this.context.logger.info(stats_1.statsWarningsToString(json, statsConfig));
                    }
                    if (stats.hasErrors()) {
                        this.context.logger.info(stats_1.statsErrorsToString(json, statsConfig));
                    }
                }
                obs.next({ success: true });
                if (first && options.open) {
                    first = false;
                    opn(serverAddress + webpackDevServerConfig.publicPath);
                }
            });
            const httpServer = server.listen(options.port, options.host, (err) => {
                if (err) {
                    obs.error(err);
                }
            });
            // Node 8 has a keepAliveTimeout bug which doesn't respect active connections.
            // Connections will end after ~5 seconds (arbitrary), often not letting the full download
            // of large pieces of content, such as a vendor javascript file.  This results in browsers
            // throwing a "net::ERR_CONTENT_LENGTH_MISMATCH" error.
            // https://github.com/angular/angular-cli/issues/7197
            // https://github.com/nodejs/node/issues/13391
            // https://github.com/nodejs/node/commit/2cb6f2b281eb96a7abe16d58af6ebc9ce23d2e96
            if (/^v8.\d.\d+$/.test(process.version)) {
                httpServer.keepAliveTimeout = 30000; // 30 seconds
            }
            // Teardown logic. Close the server when unsubscribed from.
            return () => server.close();
        })));
    }
    _buildServerConfig(root, projectRoot, options, browserOptions) {
        const systemRoot = core_1.getSystemPath(root);
        if (options.disableHostCheck) {
            this.context.logger.warn(core_1.tags.oneLine `
        WARNING: Running a server with --disable-host-check is a security risk.
        See https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
        for more information.
      `);
        }
        const servePath = this._buildServePath(options, browserOptions);
        const config = {
            headers: { 'Access-Control-Allow-Origin': '*' },
            historyApiFallback: {
                index: `${servePath}/${path.basename(browserOptions.index)}`,
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
            },
            stats: browserOptions.verbose ? utils_1.getWebpackStatsConfig(browserOptions.verbose) : false,
            compress: browserOptions.optimization,
            watchOptions: {
                poll: browserOptions.poll,
            },
            https: options.ssl,
            overlay: {
                errors: !browserOptions.optimization,
                warnings: false,
            },
            contentBase: false,
            public: options.publicHost,
            disableHostCheck: options.disableHostCheck,
            publicPath: servePath,
            hot: options.hmr,
        };
        if (options.ssl) {
            this._addSslConfig(systemRoot, options, config);
        }
        if (options.proxyConfig) {
            this._addProxyConfig(systemRoot, options, config);
        }
        return config;
    }
    _addLiveReload(options, browserOptions, webpackConfig, // tslint:disable-line:no-any
    clientAddress) {
        // This allows for live reload of page when changes are made to repo.
        // https://webpack.js.org/configuration/dev-server/#devserver-inline
        let webpackDevServerPath;
        try {
            webpackDevServerPath = require.resolve('webpack-dev-server/client');
        }
        catch (_a) {
            throw new Error('The "webpack-dev-server" package could not be found.');
        }
        const entryPoints = [`${webpackDevServerPath}?${clientAddress}`];
        if (options.hmr) {
            const webpackHmrLink = 'https://webpack.js.org/guides/hot-module-replacement';
            this.context.logger.warn(core_1.tags.oneLine `NOTICE: Hot Module Replacement (HMR) is enabled for the dev server.`);
            const showWarning = options.hmrWarning;
            if (showWarning) {
                this.context.logger.info(core_1.tags.stripIndents `
          The project will still live reload when HMR is enabled,
          but to take advantage of HMR additional application code is required'
          (not included in an Angular CLI project by default).'
          See ${webpackHmrLink}
          for information on working with HMR for Webpack.`);
                this.context.logger.warn(core_1.tags.oneLine `To disable this warning use "hmrWarning: false" under "serve"
           options in "angular.json".`);
            }
            entryPoints.push('webpack/hot/dev-server');
            webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
            if (browserOptions.extractCss) {
                this.context.logger.warn(core_1.tags.oneLine `NOTICE: (HMR) does not allow for CSS hot reload
                when used together with '--extract-css'.`);
            }
        }
        if (!webpackConfig.entry.main) {
            webpackConfig.entry.main = [];
        }
        webpackConfig.entry.main.unshift(...entryPoints);
    }
    _addSslConfig(root, options, config) {
        let sslKey = undefined;
        let sslCert = undefined;
        if (options.sslKey) {
            const keyPath = path.resolve(root, options.sslKey);
            if (fs_1.existsSync(keyPath)) {
                sslKey = fs_1.readFileSync(keyPath, 'utf-8');
            }
        }
        if (options.sslCert) {
            const certPath = path.resolve(root, options.sslCert);
            if (fs_1.existsSync(certPath)) {
                sslCert = fs_1.readFileSync(certPath, 'utf-8');
            }
        }
        config.https = true;
        if (sslKey != null && sslCert != null) {
            config.key = sslKey;
            config.cert = sslCert;
        }
    }
    _addProxyConfig(root, options, config) {
        let proxyConfig = {};
        const proxyPath = path.resolve(root, options.proxyConfig);
        if (fs_1.existsSync(proxyPath)) {
            proxyConfig = require(proxyPath);
        }
        else {
            const message = 'Proxy config file ' + proxyPath + ' does not exist.';
            throw new Error(message);
        }
        config.proxy = proxyConfig;
    }
    _buildServePath(options, browserOptions) {
        let servePath = options.servePath;
        if (!servePath && servePath !== '') {
            const defaultServePath = this._findDefaultServePath(browserOptions.baseHref, browserOptions.deployUrl);
            const showWarning = options.servePathDefaultWarning;
            if (defaultServePath == null && showWarning) {
                this.context.logger.warn(core_1.tags.oneLine `
            WARNING: --deploy-url and/or --base-href contain
            unsupported values for ng serve.  Default serve path of '/' used.
            Use --serve-path to override.
          `);
            }
            servePath = defaultServePath || '';
        }
        if (servePath.endsWith('/')) {
            servePath = servePath.substr(0, servePath.length - 1);
        }
        if (!servePath.startsWith('/')) {
            servePath = `/${servePath}`;
        }
        return servePath;
    }
    _findDefaultServePath(baseHref, deployUrl) {
        if (!baseHref && !deployUrl) {
            return '';
        }
        if (/^(\w+:)?\/\//.test(baseHref || '') || /^(\w+:)?\/\//.test(deployUrl || '')) {
            // If baseHref or deployUrl is absolute, unsupported by ng serve
            return null;
        }
        // normalize baseHref
        // for ng serve the starting base is always `/` so a relative
        // and root relative value are identical
        const baseHrefParts = (baseHref || '')
            .split('/')
            .filter(part => part !== '');
        if (baseHref && !baseHref.endsWith('/')) {
            baseHrefParts.pop();
        }
        const normalizedBaseHref = baseHrefParts.length === 0 ? '/' : `/${baseHrefParts.join('/')}/`;
        if (deployUrl && deployUrl[0] === '/') {
            if (baseHref && baseHref[0] === '/' && normalizedBaseHref !== deployUrl) {
                // If baseHref and deployUrl are root relative and not equivalent, unsupported by ng serve
                return null;
            }
            return deployUrl;
        }
        // Join together baseHref and deployUrl
        return `${normalizedBaseHref}${deployUrl || ''}`;
    }
    _getBrowserOptions(options) {
        const architect = this.context.architect;
        const [project, target, configuration] = options.browserTarget.split(':');
        // Override browser build watch setting.
        const overrides = { watch: options.watch };
        const browserTargetSpec = { project, target, configuration, overrides };
        const builderConfig = architect.getBuilderConfiguration(browserTargetSpec);
        // Update the browser options with the same options we support in serve, if defined.
        builderConfig.options = Object.assign({}, (options.optimization !== undefined ? { optimization: options.optimization } : {}), (options.aot !== undefined ? { aot: options.aot } : {}), (options.sourceMap !== undefined ? { sourceMap: options.sourceMap } : {}), (options.evalSourceMap !== undefined ? { evalSourceMap: options.evalSourceMap } : {}), (options.vendorChunk !== undefined ? { vendorChunk: options.vendorChunk } : {}), (options.commonChunk !== undefined ? { commonChunk: options.commonChunk } : {}), (options.baseHref !== undefined ? { baseHref: options.baseHref } : {}), (options.progress !== undefined ? { progress: options.progress } : {}), (options.poll !== undefined ? { poll: options.poll } : {}), builderConfig.options);
        return architect.getBuilderDescription(builderConfig).pipe(operators_1.concatMap(browserDescription => architect.validateBuilderOptions(builderConfig, browserDescription)), operators_1.map(browserConfig => browserConfig.options));
    }
}
exports.DevServerBuilder = DevServerBuilder;
exports.default = DevServerBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2Rldi1zZXJ2ZXIvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7QUFRSCwrQ0FBcUY7QUFDckYsMkJBQThDO0FBRTlDLDZCQUE2QjtBQUM3QiwrQkFBa0M7QUFDbEMsOENBQXFEO0FBQ3JELDJCQUEyQjtBQUMzQixtQ0FBbUM7QUFDbkMsNkVBQTBGO0FBQzFGLDBFQUFzRTtBQUN0RSxnRUFJOEM7QUFDOUMsa0NBQTZFO0FBRTdFLG9DQUF1RTtBQUN2RSxNQUFNLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQTJEdkQ7SUFFRSxZQUFtQixPQUF1QjtRQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtJQUFJLENBQUM7SUFFL0MsR0FBRyxDQUFDLGFBQTREO1FBQzlELE1BQU0sT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3pDLE1BQU0sV0FBVyxHQUFHLGNBQU8sQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RELE1BQU0sSUFBSSxHQUFHLElBQUksZ0JBQVMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFnQyxDQUFDLENBQUM7UUFDcEYsSUFBSSxjQUFvQyxDQUFDO1FBRXpDLE1BQU0sQ0FBQyxzQkFBUyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FDL0MsZUFBRyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxPQUFPLENBQUMs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bmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1xuICBCdWlsZEV2ZW50LFxuICBCdWlsZGVyLFxuICBCdWlsZGVyQ29uZmlndXJhdGlvbixcbiAgQnVpbGRlckNvbnRleHQsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgUGF0aCwgZ2V0U3lzdGVtUGF0aCwgcmVzb2x2ZSwgdGFncywgdmlydHVhbEZzIH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgZXhpc3RzU3luYywgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGNvbmNhdE1hcCwgbWFwLCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCAqIGFzIHdlYnBhY2sgZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgeyBnZXRXZWJwYWNrU3RhdHNDb25maWcgfSBmcm9tICcuLi9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3V0aWxzJztcbmltcG9ydCB7IGNoZWNrUG9ydCB9IGZyb20gJy4uL2FuZ3VsYXItY2xpLWZpbGVzL3V0aWxpdGllcy9jaGVjay1wb3J0JztcbmltcG9ydCB7XG4gIHN0YXRzRXJyb3JzVG9TdHJpbmcsXG4gIHN0YXRzVG9TdHJpbmcsXG4gIHN0YXRzV2FybmluZ3NUb1N0cmluZyxcbn0gZnJvbSAnLi4vYW5ndWxhci1jbGktZmlsZXMvdXRpbGl0aWVzL3N0YXRzJztcbmltcG9ydCB7IEJyb3dzZXJCdWlsZGVyLCBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEgfSBmcm9tICcuLi9icm93c2VyLyc7XG5pbXBvcnQgeyBCcm93c2VyQnVpbGRlclNjaGVtYSB9IGZyb20gJy4uL2Jyb3dzZXIvc2NoZW1hJztcbmltcG9ydCB7IGFkZEZpbGVSZXBsYWNlbWVudHMsIG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMgfSBmcm9tICcuLi91dGlscyc7XG5jb25zdCBvcG4gPSByZXF1aXJlKCdvcG4nKTtcbmNvbnN0IFdlYnBhY2tEZXZTZXJ2ZXIgPSByZXF1aXJlKCd3ZWJwYWNrLWRldi1zZXJ2ZXInKTtcblxuXG5leHBvcnQgaW50ZXJmYWNlIERldlNlcnZlckJ1aWxkZXJPcHRpb25zIHtcbiAgYnJvd3NlclRhcmdldDogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG4gIGhvc3Q6IHN0cmluZztcbiAgcHJveHlDb25maWc/OiBzdHJpbmc7XG4gIHNzbDogYm9vbGVhbjtcbiAgc3NsS2V5Pzogc3RyaW5nO1xuICBzc2xDZXJ0Pzogc3RyaW5nO1xuICBvcGVuOiBib29sZWFuO1xuICBsaXZlUmVsb2FkOiBib29sZWFuO1xuICBwdWJsaWNIb3N0Pzogc3RyaW5nO1xuICBzZXJ2ZVBhdGg/OiBzdHJpbmc7XG4gIGRpc2FibGVIb3N0Q2hlY2s6IGJvb2xlYW47XG4gIGhtcjogYm9vbGVhbjtcbiAgd2F0Y2g6IGJvb2xlYW47XG4gIGhtcldhcm5pbmc6IGJvb2xlYW47XG4gIHNlcnZlUGF0aERlZmF1bHRXYXJuaW5nOiBib29sZWFuO1xuXG4gIC8vIFRoZXNlIG9wdGlvbnMgY29tZSBmcm9tIHRoZSBicm93c2VyIGJ1aWxkZXIgYW5kIGFyZSBwcm92aWRlZCBoZXJlIGZvciBjb252ZW5pZW5jZS5cbiAgb3B0aW1pemF0aW9uPzogYm9vbGVhbjtcbiAgYW90PzogYm9vbGVhbjtcbiAgc291cmNlTWFwPzogYm9vbGVhbjtcbiAgZXZhbFNvdXJjZU1hcD86IGJvb2xlYW47XG4gIHZlbmRvckNodW5rPzogYm9vbGVhbjtcbiAgY29tbW9uQ2h1bms/OiBib29sZWFuO1xuICBiYXNlSHJlZj86IHN0cmluZztcbiAgcHJvZ3Jlc3M/OiBib29sZWFuO1xuICBwb2xsPzogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zIHtcbiAgY29udGVudEJhc2U/OiBib29sZWFuIHwgc3RyaW5nIHwgc3RyaW5nW107XG4gIGhvdD86IGJvb2xlYW47XG4gIGhpc3RvcnlBcGlGYWxsYmFjaz86IHsgW2tleTogc3RyaW5nXTogYW55IH0gfCBib29sZWFuOyAvLyB0c2xpbnQ6ZGlzYWJsZS1saW5lOm5vLWFueVxuICBjb21wcmVzcz86IGJvb2xlYW47XG4gIHByb3h5PzogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfTtcbiAgc3RhdGljT3B0aW9ucz86IGFueTsgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgcXVpZXQ/OiBib29sZWFuO1xuICBub0luZm8/OiBib29sZWFuO1xuICBsYXp5PzogYm9vbGVhbjtcbiAgZmlsZW5hbWU/OiBzdHJpbmc7XG4gIHdhdGNoT3B0aW9ucz86IHtcbiAgICBhZ2dyZWdhdGVUaW1lb3V0PzogbnVtYmVyO1xuICAgIHBvbGw/OiBudW1iZXI7XG4gIH07XG4gIHB1YmxpY1BhdGg/OiBzdHJpbmc7XG4gIGhlYWRlcnM/OiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9O1xuICBzdGF0cz86IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9IHwgc3RyaW5nIHwgYm9vbGVhbjtcbiAgaHR0cHM/OiBib29sZWFuO1xuICBrZXk/OiBzdHJpbmc7XG4gIGNlcnQ/OiBzdHJpbmc7XG4gIG92ZXJsYXk/OiBib29sZWFuIHwgeyBlcnJvcnM6IGJvb2xlYW4sIHdhcm5pbmdzOiBib29sZWFuIH07XG4gIHB1YmxpYz86IHN0cmluZztcbiAgZGlzYWJsZUhvc3RDaGVjaz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBEZXZTZXJ2ZXJCdWlsZGVyIGltcGxlbWVudHMgQnVpbGRlcjxEZXZTZXJ2ZXJCdWlsZGVyT3B0aW9ucz4ge1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCkgeyB9XG5cbiAgcnVuKGJ1aWxkZXJDb25maWc6IEJ1aWxkZXJDb25maWd1cmF0aW9uPERldlNlcnZlckJ1aWxkZXJPcHRpb25zPik6IE9ic2VydmFibGU8QnVpbGRFdmVudD4ge1xuICAgIGNvbnN0IG9wdGlvbnMgPSBidWlsZGVyQ29uZmlnLm9wdGlvbnM7XG4gICAgY29uc3Qgcm9vdCA9IHRoaXMuY29udGV4dC53b3Jrc3BhY2Uucm9vdDtcbiAgICBjb25zdCBwcm9qZWN0Um9vdCA9IHJlc29sdmUocm9vdCwgYnVpbGRlckNvbmZpZy5yb290KTtcbiAgICBjb25zdCBob3N0ID0gbmV3IHZpcnR1YWxGcy5BbGlhc0hvc3QodGhpcy5jb250ZXh0Lmhvc3QgYXMgdmlydHVhbEZzLkhvc3Q8ZnMuU3RhdHM+KTtcbiAgICBsZXQgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hO1xuXG4gICAgcmV0dXJuIGNoZWNrUG9ydChvcHRpb25zLnBvcnQsIG9wdGlvbnMuaG9zdCkucGlwZShcbiAgICAgIHRhcCgocG9ydCkgPT4gb3B0aW9ucy5wb3J0ID0gcG9ydCksXG4gICAgICBjb25jYXRNYXAoKCkgPT4gdGhpcy5fZ2V0QnJvd3Nlck9wdGlvbnMob3B0aW9ucykpLFxuICAgICAgdGFwKChvcHRzKSA9PiBicm93c2VyT3B0aW9ucyA9IG9wdHMpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IGFkZEZpbGVSZXBsYWNlbWVudHMocm9vdCwgaG9zdCwgYnJvd3Nlck9wdGlvbnMuZmlsZVJlcGxhY2VtZW50cykpLFxuICAgICAgY29uY2F0TWFwKCgpID0+IG5vcm1hbGl6ZUFzc2V0UGF0dGVybnMoXG4gICAgICAgIGJyb3dzZXJPcHRpb25zLmFzc2V0cywgaG9zdCwgcm9vdCwgcHJvamVjdFJvb3QsIGJ1aWxkZXJDb25maWcuc291cmNlUm9vdCkpLFxuICAgICAgLy8gUmVwbGFjZSB0aGUgYXNzZXRzIGluIG9wdGlvbnMgd2l0aCB0aGUgbm9ybWFsaXplZCB2ZXJzaW9uLlxuICAgICAgdGFwKChhc3NldFBhdHRlcm5PYmplY3RzID0+IGJyb3dzZXJPcHRpb25zLmFzc2V0cyA9IGFzc2V0UGF0dGVybk9iamVjdHMpKSxcbiAgICAgIGNvbmNhdE1hcCgoKSA9PiBuZXcgT2JzZXJ2YWJsZShvYnMgPT4ge1xuICAgICAgICBjb25zdCBicm93c2VyQnVpbGRlciA9IG5ldyBCcm93c2VyQnVpbGRlcih0aGlzLmNvbnRleHQpO1xuICAgICAgICBjb25zdCB3ZWJwYWNrQ29uZmlnID0gYnJvd3NlckJ1aWxkZXIuYnVpbGRXZWJwYWNrQ29uZmlnKFxuICAgICAgICAgIHJvb3QsIHByb2plY3RSb290LCBob3N0LCBicm93c2VyT3B0aW9ucyBhcyBOb3JtYWxpemVkQnJvd3NlckJ1aWxkZXJTY2hlbWEpO1xuICAgICAgICBjb25zdCBzdGF0c0NvbmZpZyA9IGdldFdlYnBhY2tTdGF0c0NvbmZpZyhicm93c2VyT3B0aW9ucy52ZXJib3NlKTtcblxuICAgICAgICBsZXQgd2VicGFja0RldlNlcnZlckNvbmZpZzogV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYnBhY2tEZXZTZXJ2ZXJDb25maWcgPSB0aGlzLl9idWlsZFNlcnZlckNvbmZpZyhcbiAgICAgICAgICAgIHJvb3QsIHByb2plY3RSb290LCBvcHRpb25zLCBicm93c2VyT3B0aW9ucyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIG9icy5lcnJvcihlcnIpO1xuXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBwdWJsaWMgaG9zdCBhbmQgY2xpZW50IGFkZHJlc3MuXG4gICAgICAgIGxldCBjbGllbnRBZGRyZXNzID0gYCR7b3B0aW9ucy5zc2wgPyAnaHR0cHMnIDogJ2h0dHAnfTovLzAuMC4wLjA6MGA7XG4gICAgICAgIGlmIChvcHRpb25zLnB1YmxpY0hvc3QpIHtcbiAgICAgICAgICBsZXQgcHVibGljSG9zdCA9IG9wdGlvbnMucHVibGljSG9zdDtcbiAgICAgICAgICBpZiAoIS9eXFx3KzpcXC9cXC8vLnRlc3QocHVibGljSG9zdCkpIHtcbiAgICAgICAgICAgIHB1YmxpY0hvc3QgPSBgJHtvcHRpb25zLnNzbCA/ICdodHRwcycgOiAnaHR0cCd9Oi8vJHtwdWJsaWNIb3N0fWA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGNsaWVudFVybCA9IHVybC5wYXJzZShwdWJsaWNIb3N0KTtcbiAgICAgICAgICBvcHRpb25zLnB1YmxpY0hvc3QgPSBjbGllbnRVcmwuaG9zdDtcbiAgICAgICAgICBjbGllbnRBZGRyZXNzID0gdXJsLmZvcm1hdChjbGllbnRVcmwpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVzb2x2ZSBzZXJ2ZSBhZGRyZXNzLlxuICAgICAgICBjb25zdCBzZXJ2ZXJBZGRyZXNzID0gdXJsLmZvcm1hdCh7XG4gICAgICAgICAgcHJvdG9jb2w6IG9wdGlvbnMuc3NsID8gJ2h0dHBzJyA6ICdodHRwJyxcbiAgICAgICAgICBob3N0bmFtZTogb3B0aW9ucy5ob3N0ID09PSAnMC4wLjAuMCcgPyAnbG9jYWxob3N0JyA6IG9wdGlvbnMuaG9zdCxcbiAgICAgICAgICBwb3J0OiBvcHRpb25zLnBvcnQudG9TdHJpbmcoKSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQWRkIGxpdmUgcmVsb2FkIGNvbmZpZy5cbiAgICAgICAgaWYgKG9wdGlvbnMubGl2ZVJlbG9hZCkge1xuICAgICAgICAgIHRoaXMuX2FkZExpdmVSZWxvYWQob3B0aW9ucywgYnJvd3Nlck9wdGlvbnMsIHdlYnBhY2tDb25maWcsIGNsaWVudEFkZHJlc3MpO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuaG1yKSB7XG4gICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci53YXJuKCdMaXZlIHJlbG9hZCBpcyBkaXNhYmxlZC4gSE1SIG9wdGlvbiBpZ25vcmVkLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFvcHRpb25zLndhdGNoKSB7XG4gICAgICAgICAgLy8gVGhlcmUncyBubyBvcHRpb24gdG8gdHVybiBvZmYgZmlsZSB3YXRjaGluZyBpbiB3ZWJwYWNrLWRldi1zZXJ2ZXIsIGJ1dFxuICAgICAgICAgIC8vIHdlIGNhbiBvdmVycmlkZSB0aGUgZmlsZSB3YXRjaGVyIGluc3RlYWQuXG4gICAgICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnVuc2hpZnQoe1xuICAgICAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAgICAgYXBwbHk6IChjb21waWxlcjogYW55KSA9PiB7XG4gICAgICAgICAgICAgIGNvbXBpbGVyLmhvb2tzLmFmdGVyRW52aXJvbm1lbnQudGFwKCdhbmd1bGFyLWNsaScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBjb21waWxlci53YXRjaEZpbGVTeXN0ZW0gPSB7IHdhdGNoOiAoKSA9PiB7IH0gfTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGJyb3dzZXJPcHRpb25zLm9wdGltaXphdGlvbikge1xuICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuZXJyb3IodGFncy5zdHJpcEluZGVudHNgXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgICBUaGlzIGlzIGEgc2ltcGxlIHNlcnZlciBmb3IgdXNlIGluIHRlc3Rpbmcgb3IgZGVidWdnaW5nIEFuZ3VsYXIgYXBwbGljYXRpb25zIGxvY2FsbHkuXG4gICAgICAgICAgICBJdCBoYXNuJ3QgYmVlbiByZXZpZXdlZCBmb3Igc2VjdXJpdHkgaXNzdWVzLlxuXG4gICAgICAgICAgICBET04nVCBVU0UgSVQgRk9SIFBST0RVQ1RJT04hXG4gICAgICAgICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICAgICAgYCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8odGFncy5vbmVMaW5lYFxuICAgICAgICAgICoqXG4gICAgICAgICAgQW5ndWxhciBMaXZlIERldmVsb3BtZW50IFNlcnZlciBpcyBsaXN0ZW5pbmcgb24gJHtvcHRpb25zLmhvc3R9OlxuICAgICAgICAgICR7b3B0aW9ucy5wb3J0fSwgb3BlbiB5b3VyIGJyb3dzZXIgb24gJHtzZXJ2ZXJBZGRyZXNzfSR7d2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRofVxuICAgICAgICAgICoqXG4gICAgICAgIGApO1xuXG4gICAgICAgIGNvbnN0IHdlYnBhY2tDb21waWxlciA9IHdlYnBhY2sod2VicGFja0NvbmZpZyk7XG4gICAgICAgIGNvbnN0IHNlcnZlciA9IG5ldyBXZWJwYWNrRGV2U2VydmVyKHdlYnBhY2tDb21waWxlciwgd2VicGFja0RldlNlcnZlckNvbmZpZyk7XG5cbiAgICAgICAgbGV0IGZpcnN0ID0gdHJ1ZTtcbiAgICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWFueVxuICAgICAgICAod2VicGFja0NvbXBpbGVyIGFzIGFueSkuaG9va3MuZG9uZS50YXAoJ2FuZ3VsYXItY2xpJywgKHN0YXRzOiB3ZWJwYWNrLlN0YXRzKSA9PiB7XG4gICAgICAgICAgaWYgKCFicm93c2VyT3B0aW9ucy52ZXJib3NlKSB7XG4gICAgICAgICAgICBjb25zdCBqc29uID0gc3RhdHMudG9Kc29uKHN0YXRzQ29uZmlnKTtcbiAgICAgICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyhzdGF0c1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgICBpZiAoc3RhdHMuaGFzV2FybmluZ3MoKSkge1xuICAgICAgICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLmluZm8oc3RhdHNXYXJuaW5nc1RvU3RyaW5nKGpzb24sIHN0YXRzQ29uZmlnKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoc3RhdHMuaGFzRXJyb3JzKCkpIHtcbiAgICAgICAgICAgICAgdGhpcy5jb250ZXh0LmxvZ2dlci5pbmZvKHN0YXRzRXJyb3JzVG9TdHJpbmcoanNvbiwgc3RhdHNDb25maWcpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgb2JzLm5leHQoeyBzdWNjZXNzOiB0cnVlIH0pO1xuXG4gICAgICAgICAgaWYgKGZpcnN0ICYmIG9wdGlvbnMub3Blbikge1xuICAgICAgICAgICAgZmlyc3QgPSBmYWxzZTtcbiAgICAgICAgICAgIG9wbihzZXJ2ZXJBZGRyZXNzICsgd2VicGFja0RldlNlcnZlckNvbmZpZy5wdWJsaWNQYXRoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGh0dHBTZXJ2ZXIgPSBzZXJ2ZXIubGlzdGVuKFxuICAgICAgICAgIG9wdGlvbnMucG9ydCxcbiAgICAgICAgICBvcHRpb25zLmhvc3QsXG4gICAgICAgICAgKGVycjogYW55KSA9PiB7IC8vIHRzbGludDpkaXNhYmxlLWxpbmU6bm8tYW55XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIG9icy5lcnJvcihlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG5cbiAgICAgICAgLy8gTm9kZSA4IGhhcyBhIGtlZXBBbGl2ZVRpbWVvdXQgYnVnIHdoaWNoIGRvZXNuJ3QgcmVzcGVjdCBhY3RpdmUgY29ubmVjdGlvbnMuXG4gICAgICAgIC8vIENvbm5lY3Rpb25zIHdpbGwgZW5kIGFmdGVyIH41IHNlY29uZHMgKGFyYml0cmFyeSksIG9mdGVuIG5vdCBsZXR0aW5nIHRoZSBmdWxsIGRvd25sb2FkXG4gICAgICAgIC8vIG9mIGxhcmdlIHBpZWNlcyBvZiBjb250ZW50LCBzdWNoIGFzIGEgdmVuZG9yIGphdmFzY3JpcHQgZmlsZS4gIFRoaXMgcmVzdWx0cyBpbiBicm93c2Vyc1xuICAgICAgICAvLyB0aHJvd2luZyBhIFwibmV0OjpFUlJfQ09OVEVOVF9MRU5HVEhfTUlTTUFUQ0hcIiBlcnJvci5cbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2FuZ3VsYXIvYW5ndWxhci1jbGkvaXNzdWVzLzcxOTdcbiAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2lzc3Vlcy8xMzM5MVxuICAgICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvY29tbWl0LzJjYjZmMmIyODFlYjk2YTdhYmUxNmQ1OGFmNmViYzljZTIzZDJlOTZcbiAgICAgICAgaWYgKC9edjguXFxkLlxcZCskLy50ZXN0KHByb2Nlc3MudmVyc2lvbikpIHtcbiAgICAgICAgICBodHRwU2VydmVyLmtlZXBBbGl2ZVRpbWVvdXQgPSAzMDAwMDsgLy8gMzAgc2Vjb25kc1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVGVhcmRvd24gbG9naWMuIENsb3NlIHRoZSBzZXJ2ZXIgd2hlbiB1bnN1YnNjcmliZWQgZnJvbS5cbiAgICAgICAgcmV0dXJuICgpID0+IHNlcnZlci5jbG9zZSgpO1xuICAgICAgfSkpKTtcbiAgfVxuXG4gIHByaXZhdGUgX2J1aWxkU2VydmVyQ29uZmlnKFxuICAgIHJvb3Q6IFBhdGgsXG4gICAgcHJvamVjdFJvb3Q6IFBhdGgsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICApIHtcbiAgICBjb25zdCBzeXN0ZW1Sb290ID0gZ2V0U3lzdGVtUGF0aChyb290KTtcbiAgICBpZiAob3B0aW9ucy5kaXNhYmxlSG9zdENoZWNrKSB7XG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYFxuICAgICAgICBXQVJOSU5HOiBSdW5uaW5nIGEgc2VydmVyIHdpdGggLS1kaXNhYmxlLWhvc3QtY2hlY2sgaXMgYSBzZWN1cml0eSByaXNrLlxuICAgICAgICBTZWUgaHR0cHM6Ly9tZWRpdW0uY29tL3dlYnBhY2svd2VicGFjay1kZXYtc2VydmVyLW1pZGRsZXdhcmUtc2VjdXJpdHktaXNzdWVzLTE0ODlkOTUwODc0YVxuICAgICAgICBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAgICAgIGApO1xuICAgIH1cblxuICAgIGNvbnN0IHNlcnZlUGF0aCA9IHRoaXMuX2J1aWxkU2VydmVQYXRoKG9wdGlvbnMsIGJyb3dzZXJPcHRpb25zKTtcblxuICAgIGNvbnN0IGNvbmZpZzogV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zID0ge1xuICAgICAgaGVhZGVyczogeyAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonIH0sXG4gICAgICBoaXN0b3J5QXBpRmFsbGJhY2s6IHtcbiAgICAgICAgaW5kZXg6IGAke3NlcnZlUGF0aH0vJHtwYXRoLmJhc2VuYW1lKGJyb3dzZXJPcHRpb25zLmluZGV4KX1gLFxuICAgICAgICBkaXNhYmxlRG90UnVsZTogdHJ1ZSxcbiAgICAgICAgaHRtbEFjY2VwdEhlYWRlcnM6IFsndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL3hodG1sK3htbCddLFxuICAgICAgfSxcbiAgICAgIHN0YXRzOiBicm93c2VyT3B0aW9ucy52ZXJib3NlID8gZ2V0V2VicGFja1N0YXRzQ29uZmlnKGJyb3dzZXJPcHRpb25zLnZlcmJvc2UpIDogZmFsc2UsXG4gICAgICBjb21wcmVzczogYnJvd3Nlck9wdGlvbnMub3B0aW1pemF0aW9uLFxuICAgICAgd2F0Y2hPcHRpb25zOiB7XG4gICAgICAgIHBvbGw6IGJyb3dzZXJPcHRpb25zLnBvbGwsXG4gICAgICB9LFxuICAgICAgaHR0cHM6IG9wdGlvbnMuc3NsLFxuICAgICAgb3ZlcmxheToge1xuICAgICAgICBlcnJvcnM6ICFicm93c2VyT3B0aW9ucy5vcHRpbWl6YXRpb24sXG4gICAgICAgIHdhcm5pbmdzOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBjb250ZW50QmFzZTogZmFsc2UsXG4gICAgICBwdWJsaWM6IG9wdGlvbnMucHVibGljSG9zdCxcbiAgICAgIGRpc2FibGVIb3N0Q2hlY2s6IG9wdGlvbnMuZGlzYWJsZUhvc3RDaGVjayxcbiAgICAgIHB1YmxpY1BhdGg6IHNlcnZlUGF0aCxcbiAgICAgIGhvdDogb3B0aW9ucy5obXIsXG4gICAgfTtcblxuICAgIGlmIChvcHRpb25zLnNzbCkge1xuICAgICAgdGhpcy5fYWRkU3NsQ29uZmlnKHN5c3RlbVJvb3QsIG9wdGlvbnMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMucHJveHlDb25maWcpIHtcbiAgICAgIHRoaXMuX2FkZFByb3h5Q29uZmlnKHN5c3RlbVJvb3QsIG9wdGlvbnMsIGNvbmZpZyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNvbmZpZztcbiAgfVxuXG4gIHByaXZhdGUgX2FkZExpdmVSZWxvYWQoXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgYnJvd3Nlck9wdGlvbnM6IEJyb3dzZXJCdWlsZGVyU2NoZW1hLFxuICAgIHdlYnBhY2tDb25maWc6IGFueSwgLy8gdHNsaW50OmRpc2FibGUtbGluZTpuby1hbnlcbiAgICBjbGllbnRBZGRyZXNzOiBzdHJpbmcsXG4gICkge1xuICAgIC8vIFRoaXMgYWxsb3dzIGZvciBsaXZlIHJlbG9hZCBvZiBwYWdlIHdoZW4gY2hhbmdlcyBhcmUgbWFkZSB0byByZXBvLlxuICAgIC8vIGh0dHBzOi8vd2VicGFjay5qcy5vcmcvY29uZmlndXJhdGlvbi9kZXYtc2VydmVyLyNkZXZzZXJ2ZXItaW5saW5lXG4gICAgbGV0IHdlYnBhY2tEZXZTZXJ2ZXJQYXRoO1xuICAgIHRyeSB7XG4gICAgICB3ZWJwYWNrRGV2U2VydmVyUGF0aCA9IHJlcXVpcmUucmVzb2x2ZSgnd2VicGFjay1kZXYtc2VydmVyL2NsaWVudCcpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgXCJ3ZWJwYWNrLWRldi1zZXJ2ZXJcIiBwYWNrYWdlIGNvdWxkIG5vdCBiZSBmb3VuZC4nKTtcbiAgICB9XG4gICAgY29uc3QgZW50cnlQb2ludHMgPSBbYCR7d2VicGFja0RldlNlcnZlclBhdGh9PyR7Y2xpZW50QWRkcmVzc31gXTtcbiAgICBpZiAob3B0aW9ucy5obXIpIHtcbiAgICAgIGNvbnN0IHdlYnBhY2tIbXJMaW5rID0gJ2h0dHBzOi8vd2VicGFjay5qcy5vcmcvZ3VpZGVzL2hvdC1tb2R1bGUtcmVwbGFjZW1lbnQnO1xuXG4gICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgIHRhZ3Mub25lTGluZWBOT1RJQ0U6IEhvdCBNb2R1bGUgUmVwbGFjZW1lbnQgKEhNUikgaXMgZW5hYmxlZCBmb3IgdGhlIGRldiBzZXJ2ZXIuYCk7XG5cbiAgICAgIGNvbnN0IHNob3dXYXJuaW5nID0gb3B0aW9ucy5obXJXYXJuaW5nO1xuICAgICAgaWYgKHNob3dXYXJuaW5nKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIuaW5mbyh0YWdzLnN0cmlwSW5kZW50c2BcbiAgICAgICAgICBUaGUgcHJvamVjdCB3aWxsIHN0aWxsIGxpdmUgcmVsb2FkIHdoZW4gSE1SIGlzIGVuYWJsZWQsXG4gICAgICAgICAgYnV0IHRvIHRha2UgYWR2YW50YWdlIG9mIEhNUiBhZGRpdGlvbmFsIGFwcGxpY2F0aW9uIGNvZGUgaXMgcmVxdWlyZWQnXG4gICAgICAgICAgKG5vdCBpbmNsdWRlZCBpbiBhbiBBbmd1bGFyIENMSSBwcm9qZWN0IGJ5IGRlZmF1bHQpLidcbiAgICAgICAgICBTZWUgJHt3ZWJwYWNrSG1yTGlua31cbiAgICAgICAgICBmb3IgaW5mb3JtYXRpb24gb24gd29ya2luZyB3aXRoIEhNUiBmb3IgV2VicGFjay5gLFxuICAgICAgICApO1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4oXG4gICAgICAgICAgdGFncy5vbmVMaW5lYFRvIGRpc2FibGUgdGhpcyB3YXJuaW5nIHVzZSBcImhtcldhcm5pbmc6IGZhbHNlXCIgdW5kZXIgXCJzZXJ2ZVwiXG4gICAgICAgICAgIG9wdGlvbnMgaW4gXCJhbmd1bGFyLmpzb25cIi5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgZW50cnlQb2ludHMucHVzaCgnd2VicGFjay9ob3QvZGV2LXNlcnZlcicpO1xuICAgICAgd2VicGFja0NvbmZpZy5wbHVnaW5zLnB1c2gobmV3IHdlYnBhY2suSG90TW9kdWxlUmVwbGFjZW1lbnRQbHVnaW4oKSk7XG4gICAgICBpZiAoYnJvd3Nlck9wdGlvbnMuZXh0cmFjdENzcykge1xuICAgICAgICB0aGlzLmNvbnRleHQubG9nZ2VyLndhcm4odGFncy5vbmVMaW5lYE5PVElDRTogKEhNUikgZG9lcyBub3QgYWxsb3cgZm9yIENTUyBob3QgcmVsb2FkXG4gICAgICAgICAgICAgICAgd2hlbiB1c2VkIHRvZ2V0aGVyIHdpdGggJy0tZXh0cmFjdC1jc3MnLmApO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXdlYnBhY2tDb25maWcuZW50cnkubWFpbikgeyB3ZWJwYWNrQ29uZmlnLmVudHJ5Lm1haW4gPSBbXTsgfVxuICAgIHdlYnBhY2tDb25maWcuZW50cnkubWFpbi51bnNoaWZ0KC4uLmVudHJ5UG9pbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgX2FkZFNzbENvbmZpZyhcbiAgICByb290OiBzdHJpbmcsXG4gICAgb3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsXG4gICAgY29uZmlnOiBXZWJwYWNrRGV2U2VydmVyQ29uZmlndXJhdGlvbk9wdGlvbnMsXG4gICkge1xuICAgIGxldCBzc2xLZXk6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgc3NsQ2VydDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuICAgIGlmIChvcHRpb25zLnNzbEtleSkge1xuICAgICAgY29uc3Qga2V5UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbEtleSBhcyBzdHJpbmcpO1xuICAgICAgaWYgKGV4aXN0c1N5bmMoa2V5UGF0aCkpIHtcbiAgICAgICAgc3NsS2V5ID0gcmVhZEZpbGVTeW5jKGtleVBhdGgsICd1dGYtOCcpO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3B0aW9ucy5zc2xDZXJ0KSB7XG4gICAgICBjb25zdCBjZXJ0UGF0aCA9IHBhdGgucmVzb2x2ZShyb290LCBvcHRpb25zLnNzbENlcnQgYXMgc3RyaW5nKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKGNlcnRQYXRoKSkge1xuICAgICAgICBzc2xDZXJ0ID0gcmVhZEZpbGVTeW5jKGNlcnRQYXRoLCAndXRmLTgnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25maWcuaHR0cHMgPSB0cnVlO1xuICAgIGlmIChzc2xLZXkgIT0gbnVsbCAmJiBzc2xDZXJ0ICE9IG51bGwpIHtcbiAgICAgIGNvbmZpZy5rZXkgPSBzc2xLZXk7XG4gICAgICBjb25maWcuY2VydCA9IHNzbENlcnQ7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfYWRkUHJveHlDb25maWcoXG4gICAgcm9vdDogc3RyaW5nLFxuICAgIG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zLFxuICAgIGNvbmZpZzogV2VicGFja0RldlNlcnZlckNvbmZpZ3VyYXRpb25PcHRpb25zLFxuICApIHtcbiAgICBsZXQgcHJveHlDb25maWcgPSB7fTtcbiAgICBjb25zdCBwcm94eVBhdGggPSBwYXRoLnJlc29sdmUocm9vdCwgb3B0aW9ucy5wcm94eUNvbmZpZyBhcyBzdHJpbmcpO1xuICAgIGlmIChleGlzdHNTeW5jKHByb3h5UGF0aCkpIHtcbiAgICAgIHByb3h5Q29uZmlnID0gcmVxdWlyZShwcm94eVBhdGgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gJ1Byb3h5IGNvbmZpZyBmaWxlICcgKyBwcm94eVBhdGggKyAnIGRvZXMgbm90IGV4aXN0Lic7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgfVxuICAgIGNvbmZpZy5wcm94eSA9IHByb3h5Q29uZmlnO1xuICB9XG5cbiAgcHJpdmF0ZSBfYnVpbGRTZXJ2ZVBhdGgob3B0aW9uczogRGV2U2VydmVyQnVpbGRlck9wdGlvbnMsIGJyb3dzZXJPcHRpb25zOiBCcm93c2VyQnVpbGRlclNjaGVtYSkge1xuICAgIGxldCBzZXJ2ZVBhdGggPSBvcHRpb25zLnNlcnZlUGF0aDtcbiAgICBpZiAoIXNlcnZlUGF0aCAmJiBzZXJ2ZVBhdGggIT09ICcnKSB7XG4gICAgICBjb25zdCBkZWZhdWx0U2VydmVQYXRoID1cbiAgICAgICAgdGhpcy5fZmluZERlZmF1bHRTZXJ2ZVBhdGgoYnJvd3Nlck9wdGlvbnMuYmFzZUhyZWYsIGJyb3dzZXJPcHRpb25zLmRlcGxveVVybCk7XG4gICAgICBjb25zdCBzaG93V2FybmluZyA9IG9wdGlvbnMuc2VydmVQYXRoRGVmYXVsdFdhcm5pbmc7XG4gICAgICBpZiAoZGVmYXVsdFNlcnZlUGF0aCA9PSBudWxsICYmIHNob3dXYXJuaW5nKSB7XG4gICAgICAgIHRoaXMuY29udGV4dC5sb2dnZXIud2Fybih0YWdzLm9uZUxpbmVgXG4gICAgICAgICAgICBXQVJOSU5HOiAtLWRlcGxveS11cmwgYW5kL29yIC0tYmFzZS1ocmVmIGNvbnRhaW5cbiAgICAgICAgICAgIHVuc3VwcG9ydGVkIHZhbHVlcyBmb3Igbmcgc2VydmUuICBEZWZhdWx0IHNlcnZlIHBhdGggb2YgJy8nIHVzZWQuXG4gICAgICAgICAgICBVc2UgLS1zZXJ2ZS1wYXRoIHRvIG92ZXJyaWRlLlxuICAgICAgICAgIGApO1xuICAgICAgfVxuICAgICAgc2VydmVQYXRoID0gZGVmYXVsdFNlcnZlUGF0aCB8fCAnJztcbiAgICB9XG4gICAgaWYgKHNlcnZlUGF0aC5lbmRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBzZXJ2ZVBhdGguc3Vic3RyKDAsIHNlcnZlUGF0aC5sZW5ndGggLSAxKTtcbiAgICB9XG4gICAgaWYgKCFzZXJ2ZVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICBzZXJ2ZVBhdGggPSBgLyR7c2VydmVQYXRofWA7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlcnZlUGF0aDtcbiAgfVxuXG4gIHByaXZhdGUgX2ZpbmREZWZhdWx0U2VydmVQYXRoKGJhc2VIcmVmPzogc3RyaW5nLCBkZXBsb3lVcmw/OiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBpZiAoIWJhc2VIcmVmICYmICFkZXBsb3lVcmwpIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG5cbiAgICBpZiAoL14oXFx3KzopP1xcL1xcLy8udGVzdChiYXNlSHJlZiB8fCAnJykgfHwgL14oXFx3KzopP1xcL1xcLy8udGVzdChkZXBsb3lVcmwgfHwgJycpKSB7XG4gICAgICAvLyBJZiBiYXNlSHJlZiBvciBkZXBsb3lVcmwgaXMgYWJzb2x1dGUsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBub3JtYWxpemUgYmFzZUhyZWZcbiAgICAvLyBmb3Igbmcgc2VydmUgdGhlIHN0YXJ0aW5nIGJhc2UgaXMgYWx3YXlzIGAvYCBzbyBhIHJlbGF0aXZlXG4gICAgLy8gYW5kIHJvb3QgcmVsYXRpdmUgdmFsdWUgYXJlIGlkZW50aWNhbFxuICAgIGNvbnN0IGJhc2VIcmVmUGFydHMgPSAoYmFzZUhyZWYgfHwgJycpXG4gICAgICAuc3BsaXQoJy8nKVxuICAgICAgLmZpbHRlcihwYXJ0ID0+IHBhcnQgIT09ICcnKTtcbiAgICBpZiAoYmFzZUhyZWYgJiYgIWJhc2VIcmVmLmVuZHNXaXRoKCcvJykpIHtcbiAgICAgIGJhc2VIcmVmUGFydHMucG9wKCk7XG4gICAgfVxuICAgIGNvbnN0IG5vcm1hbGl6ZWRCYXNlSHJlZiA9IGJhc2VIcmVmUGFydHMubGVuZ3RoID09PSAwID8gJy8nIDogYC8ke2Jhc2VIcmVmUGFydHMuam9pbignLycpfS9gO1xuXG4gICAgaWYgKGRlcGxveVVybCAmJiBkZXBsb3lVcmxbMF0gPT09ICcvJykge1xuICAgICAgaWYgKGJhc2VIcmVmICYmIGJhc2VIcmVmWzBdID09PSAnLycgJiYgbm9ybWFsaXplZEJhc2VIcmVmICE9PSBkZXBsb3lVcmwpIHtcbiAgICAgICAgLy8gSWYgYmFzZUhyZWYgYW5kIGRlcGxveVVybCBhcmUgcm9vdCByZWxhdGl2ZSBhbmQgbm90IGVxdWl2YWxlbnQsIHVuc3VwcG9ydGVkIGJ5IG5nIHNlcnZlXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gZGVwbG95VXJsO1xuICAgIH1cblxuICAgIC8vIEpvaW4gdG9nZXRoZXIgYmFzZUhyZWYgYW5kIGRlcGxveVVybFxuICAgIHJldHVybiBgJHtub3JtYWxpemVkQmFzZUhyZWZ9JHtkZXBsb3lVcmwgfHwgJyd9YDtcbiAgfVxuXG4gIHByaXZhdGUgX2dldEJyb3dzZXJPcHRpb25zKG9wdGlvbnM6IERldlNlcnZlckJ1aWxkZXJPcHRpb25zKSB7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID0gdGhpcy5jb250ZXh0LmFyY2hpdGVjdDtcbiAgICBjb25zdCBbcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uXSA9IG9wdGlvbnMuYnJvd3NlclRhcmdldC5zcGxpdCgnOicpO1xuICAgIC8vIE92ZXJyaWRlIGJyb3dzZXIgYnVpbGQgd2F0Y2ggc2V0dGluZy5cbiAgICBjb25zdCBvdmVycmlkZXMgPSB7IHdhdGNoOiBvcHRpb25zLndhdGNoIH07XG4gICAgY29uc3QgYnJvd3NlclRhcmdldFNwZWMgPSB7IHByb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbiwgb3ZlcnJpZGVzIH07XG4gICAgY29uc3QgYnVpbGRlckNvbmZpZyA9IGFyY2hpdGVjdC5nZXRCdWlsZGVyQ29uZmlndXJhdGlvbjxCcm93c2VyQnVpbGRlclNjaGVtYT4oXG4gICAgICBicm93c2VyVGFyZ2V0U3BlYyk7XG5cbiAgICAvLyBVcGRhdGUgdGhlIGJyb3dzZXIgb3B0aW9ucyB3aXRoIHRoZSBzYW1lIG9wdGlvbnMgd2Ugc3VwcG9ydCBpbiBzZXJ2ZSwgaWYgZGVmaW5lZC5cbiAgICBidWlsZGVyQ29uZmlnLm9wdGlvbnMgPSB7XG4gICAgICAuLi4ob3B0aW9ucy5vcHRpbWl6YXRpb24gIT09IHVuZGVmaW5lZCA/IHsgb3B0aW1pemF0aW9uOiBvcHRpb25zLm9wdGltaXphdGlvbiB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMuYW90ICE9PSB1bmRlZmluZWQgPyB7IGFvdDogb3B0aW9ucy5hb3QgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLnNvdXJjZU1hcCAhPT0gdW5kZWZpbmVkID8geyBzb3VyY2VNYXA6IG9wdGlvbnMuc291cmNlTWFwIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5ldmFsU291cmNlTWFwICE9PSB1bmRlZmluZWQgPyB7IGV2YWxTb3VyY2VNYXA6IG9wdGlvbnMuZXZhbFNvdXJjZU1hcCB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMudmVuZG9yQ2h1bmsgIT09IHVuZGVmaW5lZCA/IHsgdmVuZG9yQ2h1bms6IG9wdGlvbnMudmVuZG9yQ2h1bmsgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLmNvbW1vbkNodW5rICE9PSB1bmRlZmluZWQgPyB7IGNvbW1vbkNodW5rOiBvcHRpb25zLmNvbW1vbkNodW5rIH0gOiB7fSksXG4gICAgICAuLi4ob3B0aW9ucy5iYXNlSHJlZiAhPT0gdW5kZWZpbmVkID8geyBiYXNlSHJlZjogb3B0aW9ucy5iYXNlSHJlZiB9IDoge30pLFxuICAgICAgLi4uKG9wdGlvbnMucHJvZ3Jlc3MgIT09IHVuZGVmaW5lZCA/IHsgcHJvZ3Jlc3M6IG9wdGlvbnMucHJvZ3Jlc3MgfSA6IHt9KSxcbiAgICAgIC4uLihvcHRpb25zLnBvbGwgIT09IHVuZGVmaW5lZCA/IHsgcG9sbDogb3B0aW9ucy5wb2xsIH0gOiB7fSksXG5cbiAgICAgIC4uLmJ1aWxkZXJDb25maWcub3B0aW9ucyxcbiAgICB9O1xuXG4gICAgcmV0dXJuIGFyY2hpdGVjdC5nZXRCdWlsZGVyRGVzY3JpcHRpb24oYnVpbGRlckNvbmZpZykucGlwZShcbiAgICAgIGNvbmNhdE1hcChicm93c2VyRGVzY3JpcHRpb24gPT5cbiAgICAgICAgYXJjaGl0ZWN0LnZhbGlkYXRlQnVpbGRlck9wdGlvbnMoYnVpbGRlckNvbmZpZywgYnJvd3NlckRlc2NyaXB0aW9uKSksXG4gICAgICBtYXAoYnJvd3NlckNvbmZpZyA9PiBicm93c2VyQ29uZmlnLm9wdGlvbnMpLFxuICAgICk7XG4gIH1cbn1cblxuXG5leHBvcnQgZGVmYXVsdCBEZXZTZXJ2ZXJCdWlsZGVyO1xuIl19