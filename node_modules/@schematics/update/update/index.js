"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const core_1 = require("@angular-devkit/core");
const schematics_1 = require("@angular-devkit/schematics");
const tasks_1 = require("@angular-devkit/schematics/tasks");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const semver = require("semver");
const npm_1 = require("./npm");
// This is a map of packageGroupName to range extending function. If it isn't found, the range is
// kept the same.
// Angular guarantees that a major is compatible with its following major (so packages that depend
// on Angular 5 are also compatible with Angular 6). This is, in code, represented by verifying
// that all other packages that have a peer dependency of `"@angular/core": "^5.0.0"` actually
// supports 6.0, by adding that compatibility to the range, so it is `^5.0.0 || ^6.0.0`.
const peerCompatibleWhitelist = {
    '@angular/core': (range) => {
        range = semver.validRange(range);
        let major = 1;
        while (!semver.gtr(major + '.0.0', range)) {
            major++;
            if (major >= 99) {
                throw new schematics_1.SchematicsException(`Invalid range: ${JSON.stringify(range)}`);
            }
        }
        // Add the major version as compatible with the angular compatible. This is already one
        // major above the greatest supported, because we increment `major` before checking.
        return semver.validRange(`^${major}.0.0-rc.0 || ${range}`) || range;
    },
};
function _updatePeerVersion(infoMap, name, range) {
    // Resolve packageGroupName.
    const maybePackageInfo = infoMap.get(name);
    if (!maybePackageInfo) {
        return range;
    }
    if (maybePackageInfo.target) {
        name = maybePackageInfo.target.updateMetadata.packageGroup[0] || name;
    }
    else {
        name = maybePackageInfo.installed.updateMetadata.packageGroup[0] || name;
    }
    const maybeTransform = peerCompatibleWhitelist[name];
    if (maybeTransform) {
        if (typeof maybeTransform == 'function') {
            return maybeTransform(range);
        }
        else {
            return maybeTransform;
        }
    }
    return range;
}
function _validateForwardPeerDependencies(name, infoMap, peers, logger) {
    for (const [peer, range] of Object.entries(peers)) {
        logger.debug(`Checking forward peer ${peer}...`);
        const maybePeerInfo = infoMap.get(peer);
        if (!maybePeerInfo) {
            logger.error([
                `Package ${JSON.stringify(name)} has a missing peer dependency of`,
                `${JSON.stringify(peer)} @ ${JSON.stringify(range)}.`,
            ].join(' '));
            return true;
        }
        const peerVersion = maybePeerInfo.target && maybePeerInfo.target.packageJson.version
            ? maybePeerInfo.target.packageJson.version
            : maybePeerInfo.installed.version;
        logger.debug(`  Range intersects(${range}, ${peerVersion})...`);
        if (!semver.satisfies(peerVersion, range)) {
            logger.error([
                `Package ${JSON.stringify(name)} has an incompatible peer dependency to`,
                `${JSON.stringify(peer)} (requires ${JSON.stringify(range)},`,
                `would install ${JSON.stringify(peerVersion)})`,
            ].join(' '));
            return true;
        }
    }
    return false;
}
function _validateReversePeerDependencies(name, version, infoMap, logger) {
    for (const [installed, installedInfo] of infoMap.entries()) {
        const installedLogger = logger.createChild(installed);
        installedLogger.debug(`${installed}...`);
        const peers = (installedInfo.target || installedInfo.installed).packageJson.peerDependencies;
        for (let [peer, range] of Object.entries(peers || {})) {
            if (peer != name) {
                // Only check peers to the packages we're updating. We don't care about peers
                // that are unmet but we have no effect on.
                continue;
            }
            // Override the peer version range if it's whitelisted.
            range = _updatePeerVersion(infoMap, peer, range);
            if (!semver.satisfies(version, range)) {
                logger.error([
                    `Package ${JSON.stringify(installed)} has an incompatible peer dependency to`,
                    `${JSON.stringify(name)} (requires ${JSON.stringify(range)},`,
                    `would install ${JSON.stringify(version)}).`,
                ].join(' '));
                return true;
            }
        }
    }
    return false;
}
function _validateUpdatePackages(infoMap, force, logger) {
    logger.debug('Updating the following packages:');
    infoMap.forEach(info => {
        if (info.target) {
            logger.debug(`  ${info.name} => ${info.target.version}`);
        }
    });
    let peerErrors = false;
    infoMap.forEach(info => {
        const { name, target } = info;
        if (!target) {
            return;
        }
        const pkgLogger = logger.createChild(name);
        logger.debug(`${name}...`);
        const peers = target.packageJson.peerDependencies || {};
        peerErrors = _validateForwardPeerDependencies(name, infoMap, peers, pkgLogger) || peerErrors;
        peerErrors
            = _validateReversePeerDependencies(name, target.version, infoMap, pkgLogger)
                || peerErrors;
    });
    if (!force && peerErrors) {
        throw new schematics_1.SchematicsException(`Incompatible peer dependencies found. See above.`);
    }
}
function _performUpdate(tree, context, infoMap, logger, migrateOnly) {
    const packageJsonContent = tree.read('/package.json');
    if (!packageJsonContent) {
        throw new schematics_1.SchematicsException('Could not find a package.json. Are you in a Node project?');
    }
    let packageJson;
    try {
        packageJson = JSON.parse(packageJsonContent.toString());
    }
    catch (e) {
        throw new schematics_1.SchematicsException('package.json could not be parsed: ' + e.message);
    }
    const toInstall = [...infoMap.values()]
        .map(x => [x.name, x.target, x.installed])
        .filter(([name, target, installed]) => {
        return !!name && !!target && !!installed;
    });
    toInstall.forEach(([name, target, installed]) => {
        logger.info(`Updating package.json with dependency ${name} `
            + `@ ${JSON.stringify(target.version)} (was ${JSON.stringify(installed.version)})...`);
        if (packageJson.dependencies && packageJson.dependencies[name]) {
            packageJson.dependencies[name] = target.version;
            if (packageJson.devDependencies && packageJson.devDependencies[name]) {
                delete packageJson.devDependencies[name];
            }
            if (packageJson.peerDependencies && packageJson.peerDependencies[name]) {
                delete packageJson.peerDependencies[name];
            }
        }
        else if (packageJson.devDependencies && packageJson.devDependencies[name]) {
            packageJson.devDependencies[name] = target.version;
            if (packageJson.peerDependencies && packageJson.peerDependencies[name]) {
                delete packageJson.peerDependencies[name];
            }
        }
        else if (packageJson.peerDependencies && packageJson.peerDependencies[name]) {
            packageJson.peerDependencies[name] = target.version;
        }
        else {
            logger.warn(`Package ${name} was not found in dependencies.`);
        }
    });
    const newContent = JSON.stringify(packageJson, null, 2);
    if (packageJsonContent.toString() != newContent || migrateOnly) {
        let installTask = [];
        if (!migrateOnly) {
            // If something changed, also hook up the task.
            tree.overwrite('/package.json', JSON.stringify(packageJson, null, 2));
            installTask = [context.addTask(new tasks_1.NodePackageInstallTask())];
        }
        // Run the migrate schematics with the list of packages to use. The collection contains
        // version information and we need to do this post installation. Please note that the
        // migration COULD fail and leave side effects on disk.
        // Run the schematics task of those packages.
        toInstall.forEach(([name, target, installed]) => {
            if (!target.updateMetadata.migrations) {
                return;
            }
            const collection = (target.updateMetadata.migrations.match(/^[./]/)
                ? name + '/'
                : '') + target.updateMetadata.migrations;
            context.addTask(new tasks_1.RunSchematicTask('@schematics/update', 'migrate', {
                package: name,
                collection,
                from: installed.version,
                to: target.version,
            }), installTask);
        });
    }
    return rxjs_1.of(undefined);
}
function _migrateOnly(info, context, from, to) {
    if (!info) {
        return rxjs_1.of();
    }
    const target = info.installed;
    if (!target || !target.updateMetadata.migrations) {
        return rxjs_1.of(undefined);
    }
    const collection = (target.updateMetadata.migrations.match(/^[./]/)
        ? info.name + '/'
        : '') + target.updateMetadata.migrations;
    context.addTask(new tasks_1.RunSchematicTask('@schematics/update', 'migrate', {
        package: info.name,
        collection,
        from: from,
        to: to || target.version,
    }));
    return rxjs_1.of(undefined);
}
function _getUpdateMetadata(packageJson, logger) {
    const metadata = packageJson['ng-update'];
    const result = {
        packageGroup: [],
        requirements: {},
    };
    if (!metadata || typeof metadata != 'object' || Array.isArray(metadata)) {
        return result;
    }
    if (metadata['packageGroup']) {
        const packageGroup = metadata['packageGroup'];
        // Verify that packageGroup is an array of strings. This is not an error but we still warn
        // the user and ignore the packageGroup keys.
        if (!Array.isArray(packageGroup) || packageGroup.some(x => typeof x != 'string')) {
            logger.warn(`packageGroup metadata of package ${packageJson.name} is malformed. Ignoring.`);
        }
        else {
            result.packageGroup = packageGroup;
        }
    }
    if (metadata['requirements']) {
        const requirements = metadata['requirements'];
        // Verify that requirements are
        if (typeof requirements != 'object'
            || Array.isArray(requirements)
            || Object.keys(requirements).some(name => typeof requirements[name] != 'string')) {
            logger.warn(`requirements metadata of package ${packageJson.name} is malformed. Ignoring.`);
        }
        else {
            result.requirements = requirements;
        }
    }
    if (metadata['migrations']) {
        const migrations = metadata['migrations'];
        if (typeof migrations != 'string') {
            logger.warn(`migrations metadata of package ${packageJson.name} is malformed. Ignoring.`);
        }
        else {
            result.migrations = migrations;
        }
    }
    return result;
}
function _usageMessage(options, infoMap, logger) {
    const packageGroups = new Map();
    const packagesToUpdate = [...infoMap.entries()]
        .map(([name, info]) => {
        const tag = options.next
            ? (info.npmPackageJson['dist-tags']['next'] ? 'next' : 'latest') : 'latest';
        const version = info.npmPackageJson['dist-tags'][tag];
        const target = info.npmPackageJson.versions[version];
        return {
            name,
            info,
            version,
            tag,
            target,
        };
    })
        .filter(({ name, info, version, target }) => {
        return (target && semver.compare(info.installed.version, version) < 0);
    })
        .filter(({ target }) => {
        return target['ng-update'];
    })
        .map(({ name, info, version, tag, target }) => {
        // Look for packageGroup.
        if (target['ng-update'] && target['ng-update']['packageGroup']) {
            const packageGroup = target['ng-update']['packageGroup'];
            const packageGroupName = target['ng-update']['packageGroupName']
                || target['ng-update']['packageGroup'][0];
            if (packageGroupName) {
                if (packageGroups.has(name)) {
                    return null;
                }
                packageGroup.forEach((x) => packageGroups.set(x, packageGroupName));
                packageGroups.set(packageGroupName, packageGroupName);
                name = packageGroupName;
            }
        }
        let command = `ng update ${name}`;
        if (tag == 'next') {
            command += ' --next';
        }
        return [name, `${info.installed.version} -> ${version}`, command];
    })
        .filter(x => x !== null)
        .sort((a, b) => a && b ? a[0].localeCompare(b[0]) : 0);
    if (packagesToUpdate.length == 0) {
        logger.info('We analyzed your package.json and everything seems to be in order. Good work!');
        return rxjs_1.of(undefined);
    }
    logger.info('We analyzed your package.json, there are some packages to update:\n');
    // Find the largest name to know the padding needed.
    let namePad = Math.max(...[...infoMap.keys()].map(x => x.length)) + 2;
    if (!Number.isFinite(namePad)) {
        namePad = 30;
    }
    const pads = [namePad, 25, 0];
    logger.info('  '
        + ['Name', 'Version', 'Command to update'].map((x, i) => x.padEnd(pads[i])).join(''));
    logger.info(' ' + '-'.repeat(pads.reduce((s, x) => s += x, 0) + 20));
    packagesToUpdate.forEach(fields => {
        if (!fields) {
            return;
        }
        logger.info('  ' + fields.map((x, i) => x.padEnd(pads[i])).join(''));
    });
    logger.info('\n');
    logger.info('There might be additional packages that are outdated.');
    logger.info('Or run ng update --all to try to update all at the same time.\n');
    return rxjs_1.of(undefined);
}
function _buildPackageInfo(tree, packages, allDependencies, npmPackageJson, logger) {
    const name = npmPackageJson.name;
    const packageJsonRange = allDependencies.get(name);
    if (!packageJsonRange) {
        throw new schematics_1.SchematicsException(`Package ${JSON.stringify(name)} was not found in package.json.`);
    }
    // Find out the currently installed version. Either from the package.json or the node_modules/
    // TODO: figure out a way to read package-lock.json and/or yarn.lock.
    let installedVersion;
    const packageContent = tree.read(`/node_modules/${name}/package.json`);
    if (packageContent) {
        const content = JSON.parse(packageContent.toString());
        installedVersion = content.version;
    }
    if (!installedVersion) {
        // Find the version from NPM that fits the range to max.
        installedVersion = semver.maxSatisfying(Object.keys(npmPackageJson.versions), packageJsonRange);
    }
    const installedPackageJson = npmPackageJson.versions[installedVersion] || packageContent;
    if (!installedPackageJson) {
        throw new schematics_1.SchematicsException(`An unexpected error happened; package ${name} has no version ${installedVersion}.`);
    }
    let targetVersion = packages.get(name);
    if (targetVersion) {
        if (npmPackageJson['dist-tags'][targetVersion]) {
            targetVersion = npmPackageJson['dist-tags'][targetVersion];
        }
        else if (targetVersion == 'next') {
            targetVersion = npmPackageJson['dist-tags']['latest'];
        }
        else {
            targetVersion = semver.maxSatisfying(Object.keys(npmPackageJson.versions), targetVersion);
        }
    }
    if (targetVersion && semver.lte(targetVersion, installedVersion)) {
        logger.debug(`Package ${name} already satisfied by package.json (${packageJsonRange}).`);
        targetVersion = undefined;
    }
    const target = targetVersion
        ? {
            version: targetVersion,
            packageJson: npmPackageJson.versions[targetVersion],
            updateMetadata: _getUpdateMetadata(npmPackageJson.versions[targetVersion], logger),
        }
        : undefined;
    // Check if there's an installed version.
    return {
        name,
        npmPackageJson,
        installed: {
            version: installedVersion,
            packageJson: installedPackageJson,
            updateMetadata: _getUpdateMetadata(installedPackageJson, logger),
        },
        target,
        packageJsonRange,
    };
}
function _buildPackageList(options, projectDeps, logger) {
    // Parse the packages options to set the targeted version.
    const packages = new Map();
    const commandLinePackages = (options.packages && options.packages.length > 0)
        ? options.packages
        : (options.all ? projectDeps.keys() : []);
    for (const pkg of commandLinePackages) {
        // Split the version asked on command line.
        const m = pkg.match(/^((?:@[^/]{1,100}\/)?[^@]{1,100})(?:@(.{1,100}))?$/);
        if (!m) {
            logger.warn(`Invalid package argument: ${JSON.stringify(pkg)}. Skipping.`);
            continue;
        }
        const [, npmName, maybeVersion] = m;
        const version = projectDeps.get(npmName);
        if (!version) {
            logger.warn(`Package not installed: ${JSON.stringify(npmName)}. Skipping.`);
            continue;
        }
        // Verify that people have an actual version in the package.json, otherwise (label or URL or
        // gist or ...) we don't update it.
        if (version.startsWith('http:') // HTTP
            || version.startsWith('file:') // Local folder
            || version.startsWith('git:') // GIT url
            || version.match(/^\w{1,100}\/\w{1,100}/) // GitHub's "user/repo"
            || version.match(/^(?:\.{0,2}\/)\w{1,100}/) // Local folder, maybe relative.
        ) {
            // We only do that for --all. Otherwise we have the installed version and the user specified
            // it on the command line.
            if (options.all) {
                logger.warn(`Package ${JSON.stringify(npmName)} has a custom version: `
                    + `${JSON.stringify(version)}. Skipping.`);
                continue;
            }
        }
        packages.set(npmName, (maybeVersion || (options.next ? 'next' : 'latest')));
    }
    return packages;
}
function _addPackageGroup(packages, allDependencies, npmPackageJson, logger) {
    const maybePackage = packages.get(npmPackageJson.name);
    if (!maybePackage) {
        return;
    }
    const version = npmPackageJson['dist-tags'][maybePackage] || maybePackage;
    if (!npmPackageJson.versions[version]) {
        return;
    }
    const ngUpdateMetadata = npmPackageJson.versions[version]['ng-update'];
    if (!ngUpdateMetadata) {
        return;
    }
    const packageGroup = ngUpdateMetadata['packageGroup'];
    if (!packageGroup) {
        return;
    }
    if (!Array.isArray(packageGroup) || packageGroup.some(x => typeof x != 'string')) {
        logger.warn(`packageGroup metadata of package ${npmPackageJson.name} is malformed.`);
        return;
    }
    packageGroup
        .filter(name => !packages.has(name)) // Don't override names from the command line.
        .filter(name => allDependencies.has(name)) // Remove packages that aren't installed.
        .forEach(name => {
        packages.set(name, maybePackage);
    });
}
/**
 * Add peer dependencies of packages on the command line to the list of packages to update.
 * We don't do verification of the versions here as this will be done by a later step (and can
 * be ignored by the --force flag).
 * @private
 */
function _addPeerDependencies(packages, _allDependencies, npmPackageJson, _logger) {
    const maybePackage = packages.get(npmPackageJson.name);
    if (!maybePackage) {
        return;
    }
    const version = npmPackageJson['dist-tags'][maybePackage] || maybePackage;
    if (!npmPackageJson.versions[version]) {
        return;
    }
    const packageJson = npmPackageJson.versions[version];
    const error = false;
    for (const [peer, range] of Object.entries(packageJson.peerDependencies || {})) {
        if (!packages.has(peer)) {
            packages.set(peer, range);
        }
    }
    if (error) {
        throw new schematics_1.SchematicsException('An error occured, see above.');
    }
}
function _getAllDependencies(tree) {
    const packageJsonContent = tree.read('/package.json');
    if (!packageJsonContent) {
        throw new schematics_1.SchematicsException('Could not find a package.json. Are you in a Node project?');
    }
    let packageJson;
    try {
        packageJson = JSON.parse(packageJsonContent.toString());
    }
    catch (e) {
        throw new schematics_1.SchematicsException('package.json could not be parsed: ' + e.message);
    }
    return new Map([
        ...Object.entries(packageJson.peerDependencies || {}),
        ...Object.entries(packageJson.devDependencies || {}),
        ...Object.entries(packageJson.dependencies || {}),
    ]);
}
function _formatVersion(version) {
    if (version === undefined) {
        return undefined;
    }
    if (!version.match(/^\d{1,30}\.\d{1,30}\.\d{1,30}/)) {
        version += '.0';
    }
    if (!version.match(/^\d{1,30}\.\d{1,30}\.\d{1,30}/)) {
        version += '.0';
    }
    if (!semver.valid(version)) {
        throw new schematics_1.SchematicsException(`Invalid migration version: ${JSON.stringify(version)}`);
    }
    return version;
}
function default_1(options) {
    if (!options.packages) {
        // We cannot just return this because we need to fetch the packages from NPM still for the
        // help/guide to show.
        options.packages = [];
    }
    else if (typeof options.packages == 'string') {
        // If a string, then we should split it and make it an array.
        options.packages = options.packages.split(/,/g);
    }
    if (options.migrateOnly && options.from) {
        if (options.packages.length !== 1) {
            throw new schematics_1.SchematicsException('--from requires that only a single package be passed.');
        }
    }
    options.from = _formatVersion(options.from);
    options.to = _formatVersion(options.to);
    return (tree, context) => {
        const logger = context.logger;
        const allDependencies = _getAllDependencies(tree);
        const packages = _buildPackageList(options, allDependencies, logger);
        return rxjs_1.from([...allDependencies.keys()]).pipe(
        // Grab all package.json from the npm repository. This requires a lot of HTTP calls so we
        // try to parallelize as many as possible.
        operators_1.mergeMap(depName => npm_1.getNpmPackageJson(depName, options.registry, logger)), 
        // Build a map of all dependencies and their packageJson.
        operators_1.reduce((acc, npmPackageJson) => {
            // If the package was not found on the registry. It could be private, so we will just
            // ignore. If the package was part of the list, we will error out, but will simply ignore
            // if it's either not requested (so just part of package.json. silently) or if it's a
            // `--all` situation. There is an edge case here where a public package peer depends on a
            // private one, but it's rare enough.
            if (!npmPackageJson.name) {
                if (packages.has(npmPackageJson.requestedName)) {
                    if (options.all) {
                        logger.warn(`Package ${JSON.stringify(npmPackageJson.requestedName)} was not `
                            + 'found on the registry. Skipping.');
                    }
                    else {
                        throw new schematics_1.SchematicsException(`Package ${JSON.stringify(npmPackageJson.requestedName)} was not found on the `
                            + 'registry. Cannot continue as this may be an error.');
                    }
                }
            }
            else {
                acc.set(npmPackageJson.name, npmPackageJson);
            }
            return acc;
        }, new Map()), operators_1.map(npmPackageJsonMap => {
            // Augment the command line package list with packageGroups and forward peer dependencies.
            npmPackageJsonMap.forEach((npmPackageJson) => {
                _addPackageGroup(packages, allDependencies, npmPackageJson, logger);
                _addPeerDependencies(packages, allDependencies, npmPackageJson, logger);
            });
            // Build the PackageInfo for each module.
            const packageInfoMap = new Map();
            npmPackageJsonMap.forEach((npmPackageJson) => {
                packageInfoMap.set(npmPackageJson.name, _buildPackageInfo(tree, packages, allDependencies, npmPackageJson, logger));
            });
            return packageInfoMap;
        }), operators_1.switchMap(infoMap => {
            // Now that we have all the information, check the flags.
            if (packages.size > 0) {
                if (options.migrateOnly && options.from && options.packages) {
                    return _migrateOnly(infoMap.get(options.packages[0]), context, options.from, options.to);
                }
                const sublog = new core_1.logging.LevelCapLogger('validation', logger.createChild(''), 'warn');
                _validateUpdatePackages(infoMap, options.force, sublog);
                return _performUpdate(tree, context, infoMap, logger, options.migrateOnly);
            }
            else {
                return _usageMessage(options, infoMap, logger);
            }
        }), operators_1.switchMap(() => rxjs_1.of(tree)));
    };
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi8iLCJzb3VyY2VzIjpbInBhY2thZ2VzL3NjaGVtYXRpY3MvdXBkYXRlL3VwZGF0ZS9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtDQUErQztBQUMvQywyREFNb0M7QUFDcEMsNERBQTRGO0FBQzVGLCtCQUE4RDtBQUM5RCw4Q0FBa0U7QUFDbEUsaUNBQWlDO0FBQ2pDLCtCQUEwQztBQVExQyxpR0FBaUc7QUFDakcsaUJBQWlCO0FBQ2pCLGtHQUFrRztBQUNsRywrRkFBK0Y7QUFDL0YsOEZBQThGO0FBQzlGLHdGQUF3RjtBQUN4RixNQUFNLHVCQUF1QixHQUE2QztJQUN4RSxlQUFlLEVBQUUsQ0FBQyxLQUFhLEVBQUUsRUFBRTtRQUNqQyxLQUFLLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNqQyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDZCxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDMUMsS0FBSyxFQUFFLENBQUM7WUFDUixFQUFFLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDaEIsTUFBTSxJQUFJLGdDQUFtQixDQUFDLGtCQUFrQixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMzRSxDQUFDO1FBQ0gsQ0FBQztRQUVELHVGQUF1RjtRQUN2RixvRkFBb0Y7UUFDcEYsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSSxLQUFLLGdCQUFnQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEtBQUssQ0FBQztJQUN0RSxDQUFDO0NBQ0YsQ0FBQztBQXNCRiw0QkFBNEIsT0FBaUMsRUFBRSxJQUFZLEVBQUUsS0FBYTtJQUN4Riw0QkFBNEI7SUFDNUIsTUFBTSxnQkFB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WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDakQsQ0FBQztRQUNILENBQUMsQ0FBQyxFQUVGLHFCQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsU0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQzFCLENBQUM7SUFDSixDQUFDLENBQUM7QUFDSixDQUFDO0FBeEdELDRCQXdHQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cbmltcG9ydCB7IGxvZ2dpbmcgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1xuICBSdWxlLFxuICBTY2hlbWF0aWNDb250ZXh0LFxuICBTY2hlbWF0aWNzRXhjZXB0aW9uLFxuICBUYXNrSWQsXG4gIFRyZWUsXG59IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7IE5vZGVQYWNrYWdlSW5zdGFsbFRhc2ssIFJ1blNjaGVtYXRpY1Rhc2sgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcy90YXNrcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlLCBmcm9tIGFzIG9ic2VydmFibGVGcm9tLCBvZiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgbWFwLCBtZXJnZU1hcCwgcmVkdWNlLCBzd2l0Y2hNYXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgKiBhcyBzZW12ZXIgZnJvbSAnc2VtdmVyJztcbmltcG9ydCB7IGdldE5wbVBhY2thZ2VKc29uIH0gZnJvbSAnLi9ucG0nO1xuaW1wb3J0IHsgTnBtUmVwb3NpdG9yeVBhY2thZ2VKc29uIH0gZnJvbSAnLi9ucG0tcGFja2FnZS1qc29uJztcbmltcG9ydCB7IEpzb25TY2hlbWFGb3JOcG1QYWNrYWdlSnNvbkZpbGVzIH0gZnJvbSAnLi9wYWNrYWdlLWpzb24nO1xuaW1wb3J0IHsgVXBkYXRlU2NoZW1hIH0gZnJvbSAnLi9zY2hlbWEnO1xuXG50eXBlIFZlcnNpb25SYW5nZSA9IHN0cmluZyAmIHsgX19WRVJTSU9OX1JBTkdFOiB2b2lkOyB9O1xudHlwZSBQZWVyVmVyc2lvblRyYW5zZm9ybSA9IHN0cmluZyB8ICgocmFuZ2U6IHN0cmluZykgPT4gc3RyaW5nKTtcblxuLy8gVGhpcyBpcyBhIG1hcCBvZiBwYWNrYWdlR3JvdXBOYW1lIHRvIHJhbmdlIGV4dGVuZGluZyBmdW5jdGlvbi4gSWYgaXQgaXNuJ3QgZm91bmQsIHRoZSByYW5nZSBpc1xuLy8ga2VwdCB0aGUgc2FtZS5cbi8vIEFuZ3VsYXIgZ3VhcmFudGVlcyB0aGF0IGEgbWFqb3IgaXMgY29tcGF0aWJsZSB3aXRoIGl0cyBmb2xsb3dpbmcgbWFqb3IgKHNvIHBhY2thZ2VzIHRoYXQgZGVwZW5kXG4vLyBvbiBBbmd1bGFyIDUgYXJlIGFsc28gY29tcGF0aWJsZSB3aXRoIEFuZ3VsYXIgNikuIFRoaXMgaXMsIGluIGNvZGUsIHJlcHJlc2VudGVkIGJ5IHZlcmlmeWluZ1xuLy8gdGhhdCBhbGwgb3RoZXIgcGFja2FnZXMgdGhhdCBoYXZlIGEgcGVlciBkZXBlbmRlbmN5IG9mIGBcIkBhbmd1bGFyL2NvcmVcIjogXCJeNS4wLjBcImAgYWN0dWFsbHlcbi8vIHN1cHBvcnRzIDYuMCwgYnkgYWRkaW5nIHRoYXQgY29tcGF0aWJpbGl0eSB0byB0aGUgcmFuZ2UsIHNvIGl0IGlzIGBeNS4wLjAgfHwgXjYuMC4wYC5cbmNvbnN0IHBlZXJDb21wYXRpYmxlV2hpdGVsaXN0OiB7IFtuYW1lOiBzdHJpbmddOiBQZWVyVmVyc2lvblRyYW5zZm9ybSB9ID0ge1xuICAnQGFuZ3VsYXIvY29yZSc6IChyYW5nZTogc3RyaW5nKSA9PiB7XG4gICAgcmFuZ2UgPSBzZW12ZXIudmFsaWRSYW5nZShyYW5nZSk7XG4gICAgbGV0IG1ham9yID0gMTtcbiAgICB3aGlsZSAoIXNlbXZlci5ndHIobWFqb3IgKyAnLjAuMCcsIHJhbmdlKSkge1xuICAgICAgbWFqb3IrKztcbiAgICAgIGlmIChtYWpvciA+PSA5OSkge1xuICAgICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgSW52YWxpZCByYW5nZTogJHtKU09OLnN0cmluZ2lmeShyYW5nZSl9YCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQWRkIHRoZSBtYWpvciB2ZXJzaW9uIGFzIGNvbXBhdGlibGUgd2l0aCB0aGUgYW5ndWxhciBjb21wYXRpYmxlLiBUaGlzIGlzIGFscmVhZHkgb25lXG4gICAgLy8gbWFqb3IgYWJvdmUgdGhlIGdyZWF0ZXN0IHN1cHBvcnRlZCwgYmVjYXVzZSB3ZSBpbmNyZW1lbnQgYG1ham9yYCBiZWZvcmUgY2hlY2tpbmcuXG4gICAgcmV0dXJuIHNlbXZlci52YWxpZFJhbmdlKGBeJHttYWpvcn0uMC4wLXJjLjAgfHwgJHtyYW5nZX1gKSB8fCByYW5nZTtcbiAgfSxcbn07XG5cbmludGVyZmFjZSBQYWNrYWdlVmVyc2lvbkluZm8ge1xuICB2ZXJzaW9uOiBWZXJzaW9uUmFuZ2U7XG4gIHBhY2thZ2VKc29uOiBKc29uU2NoZW1hRm9yTnBtUGFja2FnZUpzb25GaWxlcztcbiAgdXBkYXRlTWV0YWRhdGE6IFVwZGF0ZU1ldGFkYXRhO1xufVxuXG5pbnRlcmZhY2UgUGFja2FnZUluZm8ge1xuICBuYW1lOiBzdHJpbmc7XG4gIG5wbVBhY2thZ2VKc29uOiBOcG1SZXBvc2l0b3J5UGFja2FnZUpzb247XG4gIGluc3RhbGxlZDogUGFja2FnZVZlcnNpb25JbmZvO1xuICB0YXJnZXQ/OiBQYWNrYWdlVmVyc2lvbkluZm87XG4gIHBhY2thZ2VKc29uUmFuZ2U6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFVwZGF0ZU1ldGFkYXRhIHtcbiAgcGFja2FnZUdyb3VwOiBzdHJpbmdbXTtcbiAgcmVxdWlyZW1lbnRzOiB7IFtwYWNrYWdlTmFtZTogc3RyaW5nXTogc3RyaW5nIH07XG4gIG1pZ3JhdGlvbnM/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIF91cGRhdGVQZWVyVmVyc2lvbihpbmZvTWFwOiBNYXA8c3RyaW5nLCBQYWNrYWdlSW5mbz4sIG5hbWU6IHN0cmluZywgcmFuZ2U6IHN0cmluZykge1xuICAvLyBSZXNvbHZlIHBhY2thZ2VHcm91cE5hbWUuXG4gIGNvbnN0IG1heWJlUGFja2FnZUluZm8gPSBpbmZvTWFwLmdldChuYW1lKTtcbiAgaWYgKCFtYXliZVBhY2thZ2VJbmZvKSB7XG4gICAgcmV0dXJuIHJhbmdlO1xuICB9XG4gIGlmIChtYXliZVBhY2thZ2VJbmZvLnRhcmdldCkge1xuICAgIG5hbWUgPSBtYXliZVBhY2thZ2VJbmZvLnRhcmdldC51cGRhdGVNZXRhZGF0YS5wYWNrYWdlR3JvdXBbMF0gfHwgbmFtZTtcbiAgfSBlbHNlIHtcbiAgICBuYW1lID0gbWF5YmVQYWNrYWdlSW5mby5pbnN0YWxsZWQudXBkYXRlTWV0YWRhdGEucGFja2FnZUdyb3VwWzBdIHx8IG5hbWU7XG4gIH1cblxuICBjb25zdCBtYXliZVRyYW5zZm9ybSA9IHBlZXJDb21wYXRpYmxlV2hpdGVsaXN0W25hbWVdO1xuICBpZiAobWF5YmVUcmFuc2Zvcm0pIHtcbiAgICBpZiAodHlwZW9mIG1heWJlVHJhbnNmb3JtID09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBtYXliZVRyYW5zZm9ybShyYW5nZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBtYXliZVRyYW5zZm9ybTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmFuZ2U7XG59XG5cbmZ1bmN0aW9uIF92YWxpZGF0ZUZvcndhcmRQZWVyRGVwZW5kZW5jaWVzKFxuICBuYW1lOiBzdHJpbmcsXG4gIGluZm9NYXA6IE1hcDxzdHJpbmcsIFBhY2thZ2VJbmZvPixcbiAgcGVlcnM6IHtbbmFtZTogc3RyaW5nXTogc3RyaW5nfSxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IGJvb2xlYW4ge1xuICBmb3IgKGNvbnN0IFtwZWVyLCByYW5nZV0gb2YgT2JqZWN0LmVudHJpZXMocGVlcnMpKSB7XG4gICAgbG9nZ2VyLmRlYnVnKGBDaGVja2luZyBmb3J3YXJkIHBlZXIgJHtwZWVyfS4uLmApO1xuICAgIGNvbnN0IG1heWJlUGVlckluZm8gPSBpbmZvTWFwLmdldChwZWVyKTtcbiAgICBpZiAoIW1heWJlUGVlckluZm8pIHtcbiAgICAgIGxvZ2dlci5lcnJvcihbXG4gICAgICAgIGBQYWNrYWdlICR7SlNPTi5zdHJpbmdpZnkobmFtZSl9IGhhcyBhIG1pc3NpbmcgcGVlciBkZXBlbmRlbmN5IG9mYCxcbiAgICAgICAgYCR7SlNPTi5zdHJpbmdpZnkocGVlcil9IEAgJHtKU09OLnN0cmluZ2lmeShyYW5nZSl9LmAsXG4gICAgICBdLmpvaW4oJyAnKSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGNvbnN0IHBlZXJWZXJzaW9uID0gbWF5YmVQZWVySW5mby50YXJnZXQgJiYgbWF5YmVQZWVySW5mby50YXJnZXQucGFja2FnZUpzb24udmVyc2lvblxuICAgICAgPyBtYXliZVBlZXJJbmZvLnRhcmdldC5wYWNrYWdlSnNvbi52ZXJzaW9uXG4gICAgICA6IG1heWJlUGVlckluZm8uaW5zdGFsbGVkLnZlcnNpb247XG5cbiAgICBsb2dnZXIuZGVidWcoYCAgUmFuZ2UgaW50ZXJzZWN0cygke3JhbmdlfSwgJHtwZWVyVmVyc2lvbn0pLi4uYCk7XG4gICAgaWYgKCFzZW12ZXIuc2F0aXNmaWVzKHBlZXJWZXJzaW9uLCByYW5nZSkpIHtcbiAgICAgIGxvZ2dlci5lcnJvcihbXG4gICAgICAgIGBQYWNrYWdlICR7SlNPTi5zdHJpbmdpZnkobmFtZSl9IGhhcyBhbiBpbmNvbXBhdGlibGUgcGVlciBkZXBlbmRlbmN5IHRvYCxcbiAgICAgICAgYCR7SlNPTi5zdHJpbmdpZnkocGVlcil9IChyZXF1aXJlcyAke0pTT04uc3RyaW5naWZ5KHJhbmdlKX0sYCxcbiAgICAgICAgYHdvdWxkIGluc3RhbGwgJHtKU09OLnN0cmluZ2lmeShwZWVyVmVyc2lvbil9KWAsXG4gICAgICBdLmpvaW4oJyAnKSk7XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn1cblxuXG5mdW5jdGlvbiBfdmFsaWRhdGVSZXZlcnNlUGVlckRlcGVuZGVuY2llcyhcbiAgbmFtZTogc3RyaW5nLFxuICB2ZXJzaW9uOiBzdHJpbmcsXG4gIGluZm9NYXA6IE1hcDxzdHJpbmcsIFBhY2thZ2VJbmZvPixcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbikge1xuICBmb3IgKGNvbnN0IFtpbnN0YWxsZWQsIGluc3RhbGxlZEluZm9dIG9mIGluZm9NYXAuZW50cmllcygpKSB7XG4gICAgY29uc3QgaW5zdGFsbGVkTG9nZ2VyID0gbG9nZ2VyLmNyZWF0ZUNoaWxkKGluc3RhbGxlZCk7XG4gICAgaW5zdGFsbGVkTG9nZ2VyLmRlYnVnKGAke2luc3RhbGxlZH0uLi5gKTtcbiAgICBjb25zdCBwZWVycyA9IChpbnN0YWxsZWRJbmZvLnRhcmdldCB8fCBpbnN0YWxsZWRJbmZvLmluc3RhbGxlZCkucGFja2FnZUpzb24ucGVlckRlcGVuZGVuY2llcztcblxuICAgIGZvciAobGV0IFtwZWVyLCByYW5nZV0gb2YgT2JqZWN0LmVudHJpZXMocGVlcnMgfHwge30pKSB7XG4gICAgICBpZiAocGVlciAhPSBuYW1lKSB7XG4gICAgICAgIC8vIE9ubHkgY2hlY2sgcGVlcnMgdG8gdGhlIHBhY2thZ2VzIHdlJ3JlIHVwZGF0aW5nLiBXZSBkb24ndCBjYXJlIGFib3V0IHBlZXJzXG4gICAgICAgIC8vIHRoYXQgYXJlIHVubWV0IGJ1dCB3ZSBoYXZlIG5vIGVmZmVjdCBvbi5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIC8vIE92ZXJyaWRlIHRoZSBwZWVyIHZlcnNpb24gcmFuZ2UgaWYgaXQncyB3aGl0ZWxpc3RlZC5cbiAgICAgIHJhbmdlID0gX3VwZGF0ZVBlZXJWZXJzaW9uKGluZm9NYXAsIHBlZXIsIHJhbmdlKTtcblxuICAgICAgaWYgKCFzZW12ZXIuc2F0aXNmaWVzKHZlcnNpb24sIHJhbmdlKSkge1xuICAgICAgICBsb2dnZXIuZXJyb3IoW1xuICAgICAgICAgIGBQYWNrYWdlICR7SlNPTi5zdHJpbmdpZnkoaW5zdGFsbGVkKX0gaGFzIGFuIGluY29tcGF0aWJsZSBwZWVyIGRlcGVuZGVuY3kgdG9gLFxuICAgICAgICAgIGAke0pTT04uc3RyaW5naWZ5KG5hbWUpfSAocmVxdWlyZXMgJHtKU09OLnN0cmluZ2lmeShyYW5nZSl9LGAsXG4gICAgICAgICAgYHdvdWxkIGluc3RhbGwgJHtKU09OLnN0cmluZ2lmeSh2ZXJzaW9uKX0pLmAsXG4gICAgICAgIF0uam9pbignICcpKTtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5cbmZ1bmN0aW9uIF92YWxpZGF0ZVVwZGF0ZVBhY2thZ2VzKFxuICBpbmZvTWFwOiBNYXA8c3RyaW5nLCBQYWNrYWdlSW5mbz4sXG4gIGZvcmNlOiBib29sZWFuLFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKTogdm9pZCB7XG4gIGxvZ2dlci5kZWJ1ZygnVXBkYXRpbmcgdGhlIGZvbGxvd2luZyBwYWNrYWdlczonKTtcbiAgaW5mb01hcC5mb3JFYWNoKGluZm8gPT4ge1xuICAgIGlmIChpbmZvLnRhcmdldCkge1xuICAgICAgbG9nZ2VyLmRlYnVnKGAgICR7aW5mby5uYW1lfSA9PiAke2luZm8udGFyZ2V0LnZlcnNpb259YCk7XG4gICAgfVxuICB9KTtcblxuICBsZXQgcGVlckVycm9ycyA9IGZhbHNlO1xuICBpbmZvTWFwLmZvckVhY2goaW5mbyA9PiB7XG4gICAgY29uc3Qge25hbWUsIHRhcmdldH0gPSBpbmZvO1xuICAgIGlmICghdGFyZ2V0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcGtnTG9nZ2VyID0gbG9nZ2VyLmNyZWF0ZUNoaWxkKG5hbWUpO1xuICAgIGxvZ2dlci5kZWJ1ZyhgJHtuYW1lfS4uLmApO1xuXG4gICAgY29uc3QgcGVlcnMgPSB0YXJnZXQucGFja2FnZUpzb24ucGVlckRlcGVuZGVuY2llcyB8fCB7fTtcbiAgICBwZWVyRXJyb3JzID0gX3ZhbGlkYXRlRm9yd2FyZFBlZXJEZXBlbmRlbmNpZXMobmFtZSwgaW5mb01hcCwgcGVlcnMsIHBrZ0xvZ2dlcikgfHwgcGVlckVycm9ycztcbiAgICBwZWVyRXJyb3JzXG4gICAgICA9IF92YWxpZGF0ZVJldmVyc2VQZWVyRGVwZW5kZW5jaWVzKG5hbWUsIHRhcmdldC52ZXJzaW9uLCBpbmZvTWFwLCBwa2dMb2dnZXIpXG4gICAgICB8fCBwZWVyRXJyb3JzO1xuICB9KTtcblxuICBpZiAoIWZvcmNlICYmIHBlZXJFcnJvcnMpIHtcbiAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgSW5jb21wYXRpYmxlIHBlZXIgZGVwZW5kZW5jaWVzIGZvdW5kLiBTZWUgYWJvdmUuYCk7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBfcGVyZm9ybVVwZGF0ZShcbiAgdHJlZTogVHJlZSxcbiAgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCxcbiAgaW5mb01hcDogTWFwPHN0cmluZywgUGFja2FnZUluZm8+LFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuICBtaWdyYXRlT25seTogYm9vbGVhbixcbik6IE9ic2VydmFibGU8dm9pZD4ge1xuICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSB0cmVlLnJlYWQoJy9wYWNrYWdlLmpzb24nKTtcbiAgaWYgKCFwYWNrYWdlSnNvbkNvbnRlbnQpIHtcbiAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignQ291bGQgbm90IGZpbmQgYSBwYWNrYWdlLmpzb24uIEFyZSB5b3UgaW4gYSBOb2RlIHByb2plY3Q/Jyk7XG4gIH1cblxuICBsZXQgcGFja2FnZUpzb246IEpzb25TY2hlbWFGb3JOcG1QYWNrYWdlSnNvbkZpbGVzO1xuICB0cnkge1xuICAgIHBhY2thZ2VKc29uID0gSlNPTi5wYXJzZShwYWNrYWdlSnNvbkNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvblNjaGVtYUZvck5wbVBhY2thZ2VKc29uRmlsZXM7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbigncGFja2FnZS5qc29uIGNvdWxkIG5vdCBiZSBwYXJzZWQ6ICcgKyBlLm1lc3NhZ2UpO1xuICB9XG5cbiAgY29uc3QgdG9JbnN0YWxsID0gWy4uLmluZm9NYXAudmFsdWVzKCldXG4gICAgICAubWFwKHggPT4gW3gubmFtZSwgeC50YXJnZXQsIHguaW5zdGFsbGVkXSlcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTpub24tbnVsbC1vcGVyYXRvclxuICAgICAgLmZpbHRlcigoW25hbWUsIHRhcmdldCwgaW5zdGFsbGVkXSkgPT4ge1xuICAgICAgICByZXR1cm4gISFuYW1lICYmICEhdGFyZ2V0ICYmICEhaW5zdGFsbGVkO1xuICAgICAgfSkgYXMgW3N0cmluZywgUGFja2FnZVZlcnNpb25JbmZvLCBQYWNrYWdlVmVyc2lvbkluZm9dW107XG5cbiAgdG9JbnN0YWxsLmZvckVhY2goKFtuYW1lLCB0YXJnZXQsIGluc3RhbGxlZF0pID0+IHtcbiAgICBsb2dnZXIuaW5mbyhcbiAgICAgIGBVcGRhdGluZyBwYWNrYWdlLmpzb24gd2l0aCBkZXBlbmRlbmN5ICR7bmFtZX0gYFxuICAgICAgKyBgQCAke0pTT04uc3RyaW5naWZ5KHRhcmdldC52ZXJzaW9uKX0gKHdhcyAke0pTT04uc3RyaW5naWZ5KGluc3RhbGxlZC52ZXJzaW9uKX0pLi4uYCxcbiAgICApO1xuXG4gICAgaWYgKHBhY2thZ2VKc29uLmRlcGVuZGVuY2llcyAmJiBwYWNrYWdlSnNvbi5kZXBlbmRlbmNpZXNbbmFtZV0pIHtcbiAgICAgIHBhY2thZ2VKc29uLmRlcGVuZGVuY2llc1tuYW1lXSA9IHRhcmdldC52ZXJzaW9uO1xuXG4gICAgICBpZiAocGFja2FnZUpzb24uZGV2RGVwZW5kZW5jaWVzICYmIHBhY2thZ2VKc29uLmRldkRlcGVuZGVuY2llc1tuYW1lXSkge1xuICAgICAgICBkZWxldGUgcGFja2FnZUpzb24uZGV2RGVwZW5kZW5jaWVzW25hbWVdO1xuICAgICAgfVxuICAgICAgaWYgKHBhY2thZ2VKc29uLnBlZXJEZXBlbmRlbmNpZXMgJiYgcGFja2FnZUpzb24ucGVlckRlcGVuZGVuY2llc1tuYW1lXSkge1xuICAgICAgICBkZWxldGUgcGFja2FnZUpzb24ucGVlckRlcGVuZGVuY2llc1tuYW1lXTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHBhY2thZ2VKc29uLmRldkRlcGVuZGVuY2llcyAmJiBwYWNrYWdlSnNvbi5kZXZEZXBlbmRlbmNpZXNbbmFtZV0pIHtcbiAgICAgIHBhY2thZ2VKc29uLmRldkRlcGVuZGVuY2llc1tuYW1lXSA9IHRhcmdldC52ZXJzaW9uO1xuXG4gICAgICBpZiAocGFja2FnZUpzb24ucGVlckRlcGVuZGVuY2llcyAmJiBwYWNrYWdlSnNvbi5wZWVyRGVwZW5kZW5jaWVzW25hbWVdKSB7XG4gICAgICAgIGRlbGV0ZSBwYWNrYWdlSnNvbi5wZWVyRGVwZW5kZW5jaWVzW25hbWVdO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocGFja2FnZUpzb24ucGVlckRlcGVuZGVuY2llcyAmJiBwYWNrYWdlSnNvbi5wZWVyRGVwZW5kZW5jaWVzW25hbWVdKSB7XG4gICAgICBwYWNrYWdlSnNvbi5wZWVyRGVwZW5kZW5jaWVzW25hbWVdID0gdGFyZ2V0LnZlcnNpb247XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKGBQYWNrYWdlICR7bmFtZX0gd2FzIG5vdCBmb3VuZCBpbiBkZXBlbmRlbmNpZXMuYCk7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBuZXdDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24sIG51bGwsIDIpO1xuICBpZiAocGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCkgIT0gbmV3Q29udGVudCB8fCBtaWdyYXRlT25seSkge1xuICAgIGxldCBpbnN0YWxsVGFzazogVGFza0lkW10gPSBbXTtcbiAgICBpZiAoIW1pZ3JhdGVPbmx5KSB7XG4gICAgICAvLyBJZiBzb21ldGhpbmcgY2hhbmdlZCwgYWxzbyBob29rIHVwIHRoZSB0YXNrLlxuICAgICAgdHJlZS5vdmVyd3JpdGUoJy9wYWNrYWdlLmpzb24nLCBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbiwgbnVsbCwgMikpO1xuICAgICAgaW5zdGFsbFRhc2sgPSBbY29udGV4dC5hZGRUYXNrKG5ldyBOb2RlUGFja2FnZUluc3RhbGxUYXNrKCkpXTtcbiAgICB9XG5cbiAgICAvLyBSdW4gdGhlIG1pZ3JhdGUgc2NoZW1hdGljcyB3aXRoIHRoZSBsaXN0IG9mIHBhY2thZ2VzIHRvIHVzZS4gVGhlIGNvbGxlY3Rpb24gY29udGFpbnNcbiAgICAvLyB2ZXJzaW9uIGluZm9ybWF0aW9uIGFuZCB3ZSBuZWVkIHRvIGRvIHRoaXMgcG9zdCBpbnN0YWxsYXRpb24uIFBsZWFzZSBub3RlIHRoYXQgdGhlXG4gICAgLy8gbWlncmF0aW9uIENPVUxEIGZhaWwgYW5kIGxlYXZlIHNpZGUgZWZmZWN0cyBvbiBkaXNrLlxuICAgIC8vIFJ1biB0aGUgc2NoZW1hdGljcyB0YXNrIG9mIHRob3NlIHBhY2thZ2VzLlxuICAgIHRvSW5zdGFsbC5mb3JFYWNoKChbbmFtZSwgdGFyZ2V0LCBpbnN0YWxsZWRdKSA9PiB7XG4gICAgICBpZiAoIXRhcmdldC51cGRhdGVNZXRhZGF0YS5taWdyYXRpb25zKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29sbGVjdGlvbiA9IChcbiAgICAgICAgdGFyZ2V0LnVwZGF0ZU1ldGFkYXRhLm1pZ3JhdGlvbnMubWF0Y2goL15bLi9dLylcbiAgICAgICAgPyBuYW1lICsgJy8nXG4gICAgICAgIDogJydcbiAgICAgICkgKyB0YXJnZXQudXBkYXRlTWV0YWRhdGEubWlncmF0aW9ucztcblxuICAgICAgY29udGV4dC5hZGRUYXNrKG5ldyBSdW5TY2hlbWF0aWNUYXNrKCdAc2NoZW1hdGljcy91cGRhdGUnLCAnbWlncmF0ZScsIHtcbiAgICAgICAgICBwYWNrYWdlOiBuYW1lLFxuICAgICAgICAgIGNvbGxlY3Rpb24sXG4gICAgICAgICAgZnJvbTogaW5zdGFsbGVkLnZlcnNpb24sXG4gICAgICAgICAgdG86IHRhcmdldC52ZXJzaW9uLFxuICAgICAgICB9KSxcbiAgICAgICAgaW5zdGFsbFRhc2ssXG4gICAgICApO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIG9mPHZvaWQ+KHVuZGVmaW5lZCk7XG59XG5cbmZ1bmN0aW9uIF9taWdyYXRlT25seShcbiAgaW5mbzogUGFja2FnZUluZm8gfCB1bmRlZmluZWQsXG4gIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQsXG4gIGZyb206IHN0cmluZyxcbiAgdG8/OiBzdHJpbmcsXG4pIHtcbiAgaWYgKCFpbmZvKSB7XG4gICAgcmV0dXJuIG9mPHZvaWQ+KCk7XG4gIH1cblxuICBjb25zdCB0YXJnZXQgPSBpbmZvLmluc3RhbGxlZDtcbiAgaWYgKCF0YXJnZXQgfHwgIXRhcmdldC51cGRhdGVNZXRhZGF0YS5taWdyYXRpb25zKSB7XG4gICAgcmV0dXJuIG9mPHZvaWQ+KHVuZGVmaW5lZCk7XG4gIH1cblxuICBjb25zdCBjb2xsZWN0aW9uID0gKFxuICAgIHRhcmdldC51cGRhdGVNZXRhZGF0YS5taWdyYXRpb25zLm1hdGNoKC9eWy4vXS8pXG4gICAgICA/IGluZm8ubmFtZSArICcvJ1xuICAgICAgOiAnJ1xuICApICsgdGFyZ2V0LnVwZGF0ZU1ldGFkYXRhLm1pZ3JhdGlvbnM7XG5cbiAgY29udGV4dC5hZGRUYXNrKG5ldyBSdW5TY2hlbWF0aWNUYXNrKCdAc2NoZW1hdGljcy91cGRhdGUnLCAnbWlncmF0ZScsIHtcbiAgICAgIHBhY2thZ2U6IGluZm8ubmFtZSxcbiAgICAgIGNvbGxlY3Rpb24sXG4gICAgICBmcm9tOiBmcm9tLFxuICAgICAgdG86IHRvIHx8IHRhcmdldC52ZXJzaW9uLFxuICAgIH0pLFxuICApO1xuXG4gIHJldHVybiBvZjx2b2lkPih1bmRlZmluZWQpO1xufVxuXG5mdW5jdGlvbiBfZ2V0VXBkYXRlTWV0YWRhdGEoXG4gIHBhY2thZ2VKc29uOiBKc29uU2NoZW1hRm9yTnBtUGFja2FnZUpzb25GaWxlcyxcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IFVwZGF0ZU1ldGFkYXRhIHtcbiAgY29uc3QgbWV0YWRhdGEgPSBwYWNrYWdlSnNvblsnbmctdXBkYXRlJ107XG5cbiAgY29uc3QgcmVzdWx0OiBVcGRhdGVNZXRhZGF0YSA9IHtcbiAgICBwYWNrYWdlR3JvdXA6IFtdLFxuICAgIHJlcXVpcmVtZW50czoge30sXG4gIH07XG5cbiAgaWYgKCFtZXRhZGF0YSB8fCB0eXBlb2YgbWV0YWRhdGEgIT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShtZXRhZGF0YSkpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgaWYgKG1ldGFkYXRhWydwYWNrYWdlR3JvdXAnXSkge1xuICAgIGNvbnN0IHBhY2thZ2VHcm91cCA9IG1ldGFkYXRhWydwYWNrYWdlR3JvdXAnXTtcbiAgICAvLyBWZXJpZnkgdGhhdCBwYWNrYWdlR3JvdXAgaXMgYW4gYXJyYXkgb2Ygc3RyaW5ncy4gVGhpcyBpcyBub3QgYW4gZXJyb3IgYnV0IHdlIHN0aWxsIHdhcm5cbiAgICAvLyB0aGUgdXNlciBhbmQgaWdub3JlIHRoZSBwYWNrYWdlR3JvdXAga2V5cy5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkocGFja2FnZUdyb3VwKSB8fCBwYWNrYWdlR3JvdXAuc29tZSh4ID0+IHR5cGVvZiB4ICE9ICdzdHJpbmcnKSkge1xuICAgICAgbG9nZ2VyLndhcm4oXG4gICAgICAgIGBwYWNrYWdlR3JvdXAgbWV0YWRhdGEgb2YgcGFja2FnZSAke3BhY2thZ2VKc29uLm5hbWV9IGlzIG1hbGZvcm1lZC4gSWdub3JpbmcuYCxcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5wYWNrYWdlR3JvdXAgPSBwYWNrYWdlR3JvdXA7XG4gICAgfVxuICB9XG5cbiAgaWYgKG1ldGFkYXRhWydyZXF1aXJlbWVudHMnXSkge1xuICAgIGNvbnN0IHJlcXVpcmVtZW50cyA9IG1ldGFkYXRhWydyZXF1aXJlbWVudHMnXTtcbiAgICAvLyBWZXJpZnkgdGhhdCByZXF1aXJlbWVudHMgYXJlXG4gICAgaWYgKHR5cGVvZiByZXF1aXJlbWVudHMgIT0gJ29iamVjdCdcbiAgICAgICAgfHwgQXJyYXkuaXNBcnJheShyZXF1aXJlbWVudHMpXG4gICAgICAgIHx8IE9iamVjdC5rZXlzKHJlcXVpcmVtZW50cykuc29tZShuYW1lID0+IHR5cGVvZiByZXF1aXJlbWVudHNbbmFtZV0gIT0gJ3N0cmluZycpKSB7XG4gICAgICBsb2dnZXIud2FybihcbiAgICAgICAgYHJlcXVpcmVtZW50cyBtZXRhZGF0YSBvZiBwYWNrYWdlICR7cGFja2FnZUpzb24ubmFtZX0gaXMgbWFsZm9ybWVkLiBJZ25vcmluZy5gLFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LnJlcXVpcmVtZW50cyA9IHJlcXVpcmVtZW50cztcbiAgICB9XG4gIH1cblxuICBpZiAobWV0YWRhdGFbJ21pZ3JhdGlvbnMnXSkge1xuICAgIGNvbnN0IG1pZ3JhdGlvbnMgPSBtZXRhZGF0YVsnbWlncmF0aW9ucyddO1xuICAgIGlmICh0eXBlb2YgbWlncmF0aW9ucyAhPSAnc3RyaW5nJykge1xuICAgICAgbG9nZ2VyLndhcm4oYG1pZ3JhdGlvbnMgbWV0YWRhdGEgb2YgcGFja2FnZSAke3BhY2thZ2VKc29uLm5hbWV9IGlzIG1hbGZvcm1lZC4gSWdub3JpbmcuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC5taWdyYXRpb25zID0gbWlncmF0aW9ucztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbmZ1bmN0aW9uIF91c2FnZU1lc3NhZ2UoXG4gIG9wdGlvbnM6IFVwZGF0ZVNjaGVtYSxcbiAgaW5mb01hcDogTWFwPHN0cmluZywgUGFja2FnZUluZm8+LFxuICBsb2dnZXI6IGxvZ2dpbmcuTG9nZ2VyQXBpLFxuKSB7XG4gIGNvbnN0IHBhY2thZ2VHcm91cHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICBjb25zdCBwYWNrYWdlc1RvVXBkYXRlID0gWy4uLmluZm9NYXAuZW50cmllcygpXVxuICAgIC5tYXAoKFtuYW1lLCBpbmZvXSkgPT4ge1xuICAgICAgY29uc3QgdGFnID0gb3B0aW9ucy5uZXh0XG4gICAgICAgID8gKGluZm8ubnBtUGFja2FnZUpzb25bJ2Rpc3QtdGFncyddWyduZXh0J10gPyAnbmV4dCcgOiAnbGF0ZXN0JykgOiAnbGF0ZXN0JztcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBpbmZvLm5wbVBhY2thZ2VKc29uWydkaXN0LXRhZ3MnXVt0YWddO1xuICAgICAgY29uc3QgdGFyZ2V0ID0gaW5mby5ucG1QYWNrYWdlSnNvbi52ZXJzaW9uc1t2ZXJzaW9uXTtcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgaW5mbyxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgICAgdGFnLFxuICAgICAgICB0YXJnZXQsXG4gICAgICB9O1xuICAgIH0pXG4gICAgLmZpbHRlcigoeyBuYW1lLCBpbmZvLCB2ZXJzaW9uLCB0YXJnZXQgfSkgPT4ge1xuICAgICAgcmV0dXJuICh0YXJnZXQgJiYgc2VtdmVyLmNvbXBhcmUoaW5mby5pbnN0YWxsZWQudmVyc2lvbiwgdmVyc2lvbikgPCAwKTtcbiAgICB9KVxuICAgIC5maWx0ZXIoKHsgdGFyZ2V0IH0pID0+IHtcbiAgICAgIHJldHVybiB0YXJnZXRbJ25nLXVwZGF0ZSddO1xuICAgIH0pXG4gICAgLm1hcCgoeyBuYW1lLCBpbmZvLCB2ZXJzaW9uLCB0YWcsIHRhcmdldCB9KSA9PiB7XG4gICAgICAvLyBMb29rIGZvciBwYWNrYWdlR3JvdXAuXG4gICAgICBpZiAodGFyZ2V0WyduZy11cGRhdGUnXSAmJiB0YXJnZXRbJ25nLXVwZGF0ZSddWydwYWNrYWdlR3JvdXAnXSkge1xuICAgICAgICBjb25zdCBwYWNrYWdlR3JvdXAgPSB0YXJnZXRbJ25nLXVwZGF0ZSddWydwYWNrYWdlR3JvdXAnXTtcbiAgICAgICAgY29uc3QgcGFja2FnZUdyb3VwTmFtZSA9IHRhcmdldFsnbmctdXBkYXRlJ11bJ3BhY2thZ2VHcm91cE5hbWUnXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfHwgdGFyZ2V0WyduZy11cGRhdGUnXVsncGFja2FnZUdyb3VwJ11bMF07XG4gICAgICAgIGlmIChwYWNrYWdlR3JvdXBOYW1lKSB7XG4gICAgICAgICAgaWYgKHBhY2thZ2VHcm91cHMuaGFzKG5hbWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBwYWNrYWdlR3JvdXAuZm9yRWFjaCgoeDogc3RyaW5nKSA9PiBwYWNrYWdlR3JvdXBzLnNldCh4LCBwYWNrYWdlR3JvdXBOYW1lKSk7XG4gICAgICAgICAgcGFja2FnZUdyb3Vwcy5zZXQocGFja2FnZUdyb3VwTmFtZSwgcGFja2FnZUdyb3VwTmFtZSk7XG4gICAgICAgICAgbmFtZSA9IHBhY2thZ2VHcm91cE5hbWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV0IGNvbW1hbmQgPSBgbmcgdXBkYXRlICR7bmFtZX1gO1xuICAgICAgaWYgKHRhZyA9PSAnbmV4dCcpIHtcbiAgICAgICAgY29tbWFuZCArPSAnIC0tbmV4dCc7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBbbmFtZSwgYCR7aW5mby5pbnN0YWxsZWQudmVyc2lvbn0gLT4gJHt2ZXJzaW9ufWAsIGNvbW1hbmRdO1xuICAgIH0pXG4gICAgLmZpbHRlcih4ID0+IHggIT09IG51bGwpXG4gICAgLnNvcnQoKGEsIGIpID0+IGEgJiYgYiA/IGFbMF0ubG9jYWxlQ29tcGFyZShiWzBdKSA6IDApO1xuXG4gIGlmIChwYWNrYWdlc1RvVXBkYXRlLmxlbmd0aCA9PSAwKSB7XG4gICAgbG9nZ2VyLmluZm8oJ1dlIGFuYWx5emVkIHlvdXIgcGFja2FnZS5qc29uIGFuZCBldmVyeXRoaW5nIHNlZW1zIHRvIGJlIGluIG9yZGVyLiBHb29kIHdvcmshJyk7XG5cbiAgICByZXR1cm4gb2Y8dm9pZD4odW5kZWZpbmVkKTtcbiAgfVxuXG4gIGxvZ2dlci5pbmZvKFxuICAgICdXZSBhbmFseXplZCB5b3VyIHBhY2thZ2UuanNvbiwgdGhlcmUgYXJlIHNvbWUgcGFja2FnZXMgdG8gdXBkYXRlOlxcbicsXG4gICk7XG5cbiAgLy8gRmluZCB0aGUgbGFyZ2VzdCBuYW1lIHRvIGtub3cgdGhlIHBhZGRpbmcgbmVlZGVkLlxuICBsZXQgbmFtZVBhZCA9IE1hdGgubWF4KC4uLlsuLi5pbmZvTWFwLmtleXMoKV0ubWFwKHggPT4geC5sZW5ndGgpKSArIDI7XG4gIGlmICghTnVtYmVyLmlzRmluaXRlKG5hbWVQYWQpKSB7XG4gICAgbmFtZVBhZCA9IDMwO1xuICB9XG4gIGNvbnN0IHBhZHMgPSBbbmFtZVBhZCwgMjUsIDBdO1xuXG4gIGxvZ2dlci5pbmZvKFxuICAgICcgICdcbiAgICArIFsnTmFtZScsICdWZXJzaW9uJywgJ0NvbW1hbmQgdG8gdXBkYXRlJ10ubWFwKCh4LCBpKSA9PiB4LnBhZEVuZChwYWRzW2ldKSkuam9pbignJyksXG4gICk7XG4gIGxvZ2dlci5pbmZvKCcgJyArICctJy5yZXBlYXQocGFkcy5yZWR1Y2UoKHMsIHgpID0+IHMgKz0geCwgMCkgKyAyMCkpO1xuXG4gIHBhY2thZ2VzVG9VcGRhdGUuZm9yRWFjaChmaWVsZHMgPT4ge1xuICAgIGlmICghZmllbGRzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbG9nZ2VyLmluZm8oJyAgJyArIGZpZWxkcy5tYXAoKHgsIGkpID0+IHgucGFkRW5kKHBhZHNbaV0pKS5qb2luKCcnKSk7XG4gIH0pO1xuXG4gIGxvZ2dlci5pbmZvKCdcXG4nKTtcbiAgbG9nZ2VyLmluZm8oJ1RoZXJlIG1pZ2h0IGJlIGFkZGl0aW9uYWwgcGFja2FnZXMgdGhhdCBhcmUgb3V0ZGF0ZWQuJyk7XG4gIGxvZ2dlci5pbmZvKCdPciBydW4gbmcgdXBkYXRlIC0tYWxsIHRvIHRyeSB0byB1cGRhdGUgYWxsIGF0IHRoZSBzYW1lIHRpbWUuXFxuJyk7XG5cbiAgcmV0dXJuIG9mPHZvaWQ+KHVuZGVmaW5lZCk7XG59XG5cblxuZnVuY3Rpb24gX2J1aWxkUGFja2FnZUluZm8oXG4gIHRyZWU6IFRyZWUsXG4gIHBhY2thZ2VzOiBNYXA8c3RyaW5nLCBWZXJzaW9uUmFuZ2U+LFxuICBhbGxEZXBlbmRlbmNpZXM6IE1hcDxzdHJpbmcsIFZlcnNpb25SYW5nZT4sXG4gIG5wbVBhY2thZ2VKc29uOiBOcG1SZXBvc2l0b3J5UGFja2FnZUpzb24sXG4gIGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiBQYWNrYWdlSW5mbyB7XG4gIGNvbnN0IG5hbWUgPSBucG1QYWNrYWdlSnNvbi5uYW1lO1xuICBjb25zdCBwYWNrYWdlSnNvblJhbmdlID0gYWxsRGVwZW5kZW5jaWVzLmdldChuYW1lKTtcbiAgaWYgKCFwYWNrYWdlSnNvblJhbmdlKSB7XG4gICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oXG4gICAgICBgUGFja2FnZSAke0pTT04uc3RyaW5naWZ5KG5hbWUpfSB3YXMgbm90IGZvdW5kIGluIHBhY2thZ2UuanNvbi5gLFxuICAgICk7XG4gIH1cblxuICAvLyBGaW5kIG91dCB0aGUgY3VycmVudGx5IGluc3RhbGxlZCB2ZXJzaW9uLiBFaXRoZXIgZnJvbSB0aGUgcGFja2FnZS5qc29uIG9yIHRoZSBub2RlX21vZHVsZXMvXG4gIC8vIFRPRE86IGZpZ3VyZSBvdXQgYSB3YXkgdG8gcmVhZCBwYWNrYWdlLWxvY2suanNvbiBhbmQvb3IgeWFybi5sb2NrLlxuICBsZXQgaW5zdGFsbGVkVmVyc2lvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICBjb25zdCBwYWNrYWdlQ29udGVudCA9IHRyZWUucmVhZChgL25vZGVfbW9kdWxlcy8ke25hbWV9L3BhY2thZ2UuanNvbmApO1xuICBpZiAocGFja2FnZUNvbnRlbnQpIHtcbiAgICBjb25zdCBjb250ZW50ID0gSlNPTi5wYXJzZShwYWNrYWdlQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uU2NoZW1hRm9yTnBtUGFja2FnZUpzb25GaWxlcztcbiAgICBpbnN0YWxsZWRWZXJzaW9uID0gY29udGVudC52ZXJzaW9uO1xuICB9XG4gIGlmICghaW5zdGFsbGVkVmVyc2lvbikge1xuICAgIC8vIEZpbmQgdGhlIHZlcnNpb24gZnJvbSBOUE0gdGhhdCBmaXRzIHRoZSByYW5nZSB0byBtYXguXG4gICAgaW5zdGFsbGVkVmVyc2lvbiA9IHNlbXZlci5tYXhTYXRpc2Z5aW5nKFxuICAgICAgT2JqZWN0LmtleXMobnBtUGFja2FnZUpzb24udmVyc2lvbnMpLFxuICAgICAgcGFja2FnZUpzb25SYW5nZSxcbiAgICApO1xuICB9XG5cbiAgY29uc3QgaW5zdGFsbGVkUGFja2FnZUpzb24gPSBucG1QYWNrYWdlSnNvbi52ZXJzaW9uc1tpbnN0YWxsZWRWZXJzaW9uXSB8fCBwYWNrYWdlQ29udGVudDtcbiAgaWYgKCFpbnN0YWxsZWRQYWNrYWdlSnNvbikge1xuICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKFxuICAgICAgYEFuIHVuZXhwZWN0ZWQgZXJyb3IgaGFwcGVuZWQ7IHBhY2thZ2UgJHtuYW1lfSBoYXMgbm8gdmVyc2lvbiAke2luc3RhbGxlZFZlcnNpb259LmAsXG4gICAgKTtcbiAgfVxuXG4gIGxldCB0YXJnZXRWZXJzaW9uOiBWZXJzaW9uUmFuZ2UgfCB1bmRlZmluZWQgPSBwYWNrYWdlcy5nZXQobmFtZSk7XG4gIGlmICh0YXJnZXRWZXJzaW9uKSB7XG4gICAgaWYgKG5wbVBhY2thZ2VKc29uWydkaXN0LXRhZ3MnXVt0YXJnZXRWZXJzaW9uXSkge1xuICAgICAgdGFyZ2V0VmVyc2lvbiA9IG5wbVBhY2thZ2VKc29uWydkaXN0LXRhZ3MnXVt0YXJnZXRWZXJzaW9uXSBhcyBWZXJzaW9uUmFuZ2U7XG4gICAgfSBlbHNlIGlmICh0YXJnZXRWZXJzaW9uID09ICduZXh0Jykge1xuICAgICAgdGFyZ2V0VmVyc2lvbiA9IG5wbVBhY2thZ2VKc29uWydkaXN0LXRhZ3MnXVsnbGF0ZXN0J10gYXMgVmVyc2lvblJhbmdlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRWZXJzaW9uID0gc2VtdmVyLm1heFNhdGlzZnlpbmcoXG4gICAgICAgIE9iamVjdC5rZXlzKG5wbVBhY2thZ2VKc29uLnZlcnNpb25zKSxcbiAgICAgICAgdGFyZ2V0VmVyc2lvbixcbiAgICAgICkgYXMgVmVyc2lvblJhbmdlO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0YXJnZXRWZXJzaW9uICYmIHNlbXZlci5sdGUodGFyZ2V0VmVyc2lvbiwgaW5zdGFsbGVkVmVyc2lvbikpIHtcbiAgICBsb2dnZXIuZGVidWcoYFBhY2thZ2UgJHtuYW1lfSBhbHJlYWR5IHNhdGlzZmllZCBieSBwYWNrYWdlLmpzb24gKCR7cGFja2FnZUpzb25SYW5nZX0pLmApO1xuICAgIHRhcmdldFZlcnNpb24gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCB0YXJnZXQ6IFBhY2thZ2VWZXJzaW9uSW5mbyB8IHVuZGVmaW5lZCA9IHRhcmdldFZlcnNpb25cbiAgICA/IHtcbiAgICAgIHZlcnNpb246IHRhcmdldFZlcnNpb24sXG4gICAgICBwYWNrYWdlSnNvbjogbnBtUGFja2FnZUpzb24udmVyc2lvbnNbdGFyZ2V0VmVyc2lvbl0sXG4gICAgICB1cGRhdGVNZXRhZGF0YTogX2dldFVwZGF0ZU1ldGFkYXRhKG5wbVBhY2thZ2VKc29uLnZlcnNpb25zW3RhcmdldFZlcnNpb25dLCBsb2dnZXIpLFxuICAgIH1cbiAgICA6IHVuZGVmaW5lZDtcblxuICAvLyBDaGVjayBpZiB0aGVyZSdzIGFuIGluc3RhbGxlZCB2ZXJzaW9uLlxuICByZXR1cm4ge1xuICAgIG5hbWUsXG4gICAgbnBtUGFja2FnZUpzb24sXG4gICAgaW5zdGFsbGVkOiB7XG4gICAgICB2ZXJzaW9uOiBpbnN0YWxsZWRWZXJzaW9uIGFzIFZlcnNpb25SYW5nZSxcbiAgICAgIHBhY2thZ2VKc29uOiBpbnN0YWxsZWRQYWNrYWdlSnNvbixcbiAgICAgIHVwZGF0ZU1ldGFkYXRhOiBfZ2V0VXBkYXRlTWV0YWRhdGEoaW5zdGFsbGVkUGFja2FnZUpzb24sIGxvZ2dlciksXG4gICAgfSxcbiAgICB0YXJnZXQsXG4gICAgcGFja2FnZUpzb25SYW5nZSxcbiAgfTtcbn1cblxuXG5mdW5jdGlvbiBfYnVpbGRQYWNrYWdlTGlzdChcbiAgb3B0aW9uczogVXBkYXRlU2NoZW1hLFxuICBwcm9qZWN0RGVwczogTWFwPHN0cmluZywgVmVyc2lvblJhbmdlPixcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IE1hcDxzdHJpbmcsIFZlcnNpb25SYW5nZT4ge1xuICAvLyBQYXJzZSB0aGUgcGFja2FnZXMgb3B0aW9ucyB0byBzZXQgdGhlIHRhcmdldGVkIHZlcnNpb24uXG4gIGNvbnN0IHBhY2thZ2VzID0gbmV3IE1hcDxzdHJpbmcsIFZlcnNpb25SYW5nZT4oKTtcbiAgY29uc3QgY29tbWFuZExpbmVQYWNrYWdlcyA9XG4gICAgKG9wdGlvbnMucGFja2FnZXMgJiYgb3B0aW9ucy5wYWNrYWdlcy5sZW5ndGggPiAwKVxuICAgID8gb3B0aW9ucy5wYWNrYWdlc1xuICAgIDogKG9wdGlvbnMuYWxsID8gcHJvamVjdERlcHMua2V5cygpIDogW10pO1xuXG4gIGZvciAoY29uc3QgcGtnIG9mIGNvbW1hbmRMaW5lUGFja2FnZXMpIHtcbiAgICAvLyBTcGxpdCB0aGUgdmVyc2lvbiBhc2tlZCBvbiBjb21tYW5kIGxpbmUuXG4gICAgY29uc3QgbSA9IHBrZy5tYXRjaCgvXigoPzpAW14vXXsxLDEwMH1cXC8pP1teQF17MSwxMDB9KSg/OkAoLnsxLDEwMH0pKT8kLyk7XG4gICAgaWYgKCFtKSB7XG4gICAgICBsb2dnZXIud2FybihgSW52YWxpZCBwYWNrYWdlIGFyZ3VtZW50OiAke0pTT04uc3RyaW5naWZ5KHBrZyl9LiBTa2lwcGluZy5gKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGNvbnN0IFssIG5wbU5hbWUsIG1heWJlVmVyc2lvbl0gPSBtO1xuXG4gICAgY29uc3QgdmVyc2lvbiA9IHByb2plY3REZXBzLmdldChucG1OYW1lKTtcbiAgICBpZiAoIXZlcnNpb24pIHtcbiAgICAgIGxvZ2dlci53YXJuKGBQYWNrYWdlIG5vdCBpbnN0YWxsZWQ6ICR7SlNPTi5zdHJpbmdpZnkobnBtTmFtZSl9LiBTa2lwcGluZy5gKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIFZlcmlmeSB0aGF0IHBlb3BsZSBoYXZlIGFuIGFjdHVhbCB2ZXJzaW9uIGluIHRoZSBwYWNrYWdlLmpzb24sIG90aGVyd2lzZSAobGFiZWwgb3IgVVJMIG9yXG4gICAgLy8gZ2lzdCBvciAuLi4pIHdlIGRvbid0IHVwZGF0ZSBpdC5cbiAgICBpZiAoXG4gICAgICB2ZXJzaW9uLnN0YXJ0c1dpdGgoJ2h0dHA6JykgIC8vIEhUVFBcbiAgICAgIHx8IHZlcnNpb24uc3RhcnRzV2l0aCgnZmlsZTonKSAgLy8gTG9jYWwgZm9sZGVyXG4gICAgICB8fCB2ZXJzaW9uLnN0YXJ0c1dpdGgoJ2dpdDonKSAgLy8gR0lUIHVybFxuICAgICAgfHwgdmVyc2lvbi5tYXRjaCgvXlxcd3sxLDEwMH1cXC9cXHd7MSwxMDB9LykgIC8vIEdpdEh1YidzIFwidXNlci9yZXBvXCJcbiAgICAgIHx8IHZlcnNpb24ubWF0Y2goL14oPzpcXC57MCwyfVxcLylcXHd7MSwxMDB9LykgIC8vIExvY2FsIGZvbGRlciwgbWF5YmUgcmVsYXRpdmUuXG4gICAgKSB7XG4gICAgICAvLyBXZSBvbmx5IGRvIHRoYXQgZm9yIC0tYWxsLiBPdGhlcndpc2Ugd2UgaGF2ZSB0aGUgaW5zdGFsbGVkIHZlcnNpb24gYW5kIHRoZSB1c2VyIHNwZWNpZmllZFxuICAgICAgLy8gaXQgb24gdGhlIGNvbW1hbmQgbGluZS5cbiAgICAgIGlmIChvcHRpb25zLmFsbCkge1xuICAgICAgICBsb2dnZXIud2FybihcbiAgICAgICAgICBgUGFja2FnZSAke0pTT04uc3RyaW5naWZ5KG5wbU5hbWUpfSBoYXMgYSBjdXN0b20gdmVyc2lvbjogYFxuICAgICAgICAgICsgYCR7SlNPTi5zdHJpbmdpZnkodmVyc2lvbil9LiBTa2lwcGluZy5gLFxuICAgICAgICApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBwYWNrYWdlcy5zZXQobnBtTmFtZSwgKG1heWJlVmVyc2lvbiB8fCAob3B0aW9ucy5uZXh0ID8gJ25leHQnIDogJ2xhdGVzdCcpKSBhcyBWZXJzaW9uUmFuZ2UpO1xuICB9XG5cbiAgcmV0dXJuIHBhY2thZ2VzO1xufVxuXG5cbmZ1bmN0aW9uIF9hZGRQYWNrYWdlR3JvdXAoXG4gIHBhY2thZ2VzOiBNYXA8c3RyaW5nLCBWZXJzaW9uUmFuZ2U+LFxuICBhbGxEZXBlbmRlbmNpZXM6IFJlYWRvbmx5TWFwPHN0cmluZywgc3RyaW5nPixcbiAgbnBtUGFja2FnZUpzb246IE5wbVJlcG9zaXRvcnlQYWNrYWdlSnNvbixcbiAgbG9nZ2VyOiBsb2dnaW5nLkxvZ2dlckFwaSxcbik6IHZvaWQge1xuICBjb25zdCBtYXliZVBhY2thZ2UgPSBwYWNrYWdlcy5nZXQobnBtUGFja2FnZUpzb24ubmFtZSk7XG4gIGlmICghbWF5YmVQYWNrYWdlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgdmVyc2lvbiA9IG5wbVBhY2thZ2VKc29uWydkaXN0LXRhZ3MnXVttYXliZVBhY2thZ2VdIHx8IG1heWJlUGFja2FnZTtcbiAgaWYgKCFucG1QYWNrYWdlSnNvbi52ZXJzaW9uc1t2ZXJzaW9uXSkge1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBuZ1VwZGF0ZU1ldGFkYXRhID0gbnBtUGFja2FnZUpzb24udmVyc2lvbnNbdmVyc2lvbl1bJ25nLXVwZGF0ZSddO1xuICBpZiAoIW5nVXBkYXRlTWV0YWRhdGEpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBwYWNrYWdlR3JvdXAgPSBuZ1VwZGF0ZU1ldGFkYXRhWydwYWNrYWdlR3JvdXAnXTtcbiAgaWYgKCFwYWNrYWdlR3JvdXApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCFBcnJheS5pc0FycmF5KHBhY2thZ2VHcm91cCkgfHwgcGFja2FnZUdyb3VwLnNvbWUoeCA9PiB0eXBlb2YgeCAhPSAnc3RyaW5nJykpIHtcbiAgICBsb2dnZXIud2FybihgcGFja2FnZUdyb3VwIG1ldGFkYXRhIG9mIHBhY2thZ2UgJHtucG1QYWNrYWdlSnNvbi5uYW1lfSBpcyBtYWxmb3JtZWQuYCk7XG5cbiAgICByZXR1cm47XG4gIH1cblxuICBwYWNrYWdlR3JvdXBcbiAgICAuZmlsdGVyKG5hbWUgPT4gIXBhY2thZ2VzLmhhcyhuYW1lKSkgIC8vIERvbid0IG92ZXJyaWRlIG5hbWVzIGZyb20gdGhlIGNvbW1hbmQgbGluZS5cbiAgICAuZmlsdGVyKG5hbWUgPT4gYWxsRGVwZW5kZW5jaWVzLmhhcyhuYW1lKSkgIC8vIFJlbW92ZSBwYWNrYWdlcyB0aGF0IGFyZW4ndCBpbnN0YWxsZWQuXG4gICAgLmZvckVhY2gobmFtZSA9PiB7XG4gICAgcGFja2FnZXMuc2V0KG5hbWUsIG1heWJlUGFja2FnZSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIEFkZCBwZWVyIGRlcGVuZGVuY2llcyBvZiBwYWNrYWdlcyBvbiB0aGUgY29tbWFuZCBsaW5lIHRvIHRoZSBsaXN0IG9mIHBhY2thZ2VzIHRvIHVwZGF0ZS5cbiAqIFdlIGRvbid0IGRvIHZlcmlmaWNhdGlvbiBvZiB0aGUgdmVyc2lvbnMgaGVyZSBhcyB0aGlzIHdpbGwgYmUgZG9uZSBieSBhIGxhdGVyIHN0ZXAgKGFuZCBjYW5cbiAqIGJlIGlnbm9yZWQgYnkgdGhlIC0tZm9yY2UgZmxhZykuXG4gKiBAcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBfYWRkUGVlckRlcGVuZGVuY2llcyhcbiAgcGFja2FnZXM6IE1hcDxzdHJpbmcsIFZlcnNpb25SYW5nZT4sXG4gIF9hbGxEZXBlbmRlbmNpZXM6IFJlYWRvbmx5TWFwPHN0cmluZywgc3RyaW5nPixcbiAgbnBtUGFja2FnZUpzb246IE5wbVJlcG9zaXRvcnlQYWNrYWdlSnNvbixcbiAgX2xvZ2dlcjogbG9nZ2luZy5Mb2dnZXJBcGksXG4pOiB2b2lkIHtcbiAgY29uc3QgbWF5YmVQYWNrYWdlID0gcGFja2FnZXMuZ2V0KG5wbVBhY2thZ2VKc29uLm5hbWUpO1xuICBpZiAoIW1heWJlUGFja2FnZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IHZlcnNpb24gPSBucG1QYWNrYWdlSnNvblsnZGlzdC10YWdzJ11bbWF5YmVQYWNrYWdlXSB8fCBtYXliZVBhY2thZ2U7XG4gIGlmICghbnBtUGFja2FnZUpzb24udmVyc2lvbnNbdmVyc2lvbl0pIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBwYWNrYWdlSnNvbiA9IG5wbVBhY2thZ2VKc29uLnZlcnNpb25zW3ZlcnNpb25dO1xuICBjb25zdCBlcnJvciA9IGZhbHNlO1xuXG4gIGZvciAoY29uc3QgW3BlZXIsIHJhbmdlXSBvZiBPYmplY3QuZW50cmllcyhwYWNrYWdlSnNvbi5wZWVyRGVwZW5kZW5jaWVzIHx8IHt9KSkge1xuICAgIGlmICghcGFja2FnZXMuaGFzKHBlZXIpKSB7XG4gICAgICBwYWNrYWdlcy5zZXQocGVlciwgcmFuZ2UgYXMgVmVyc2lvblJhbmdlKTtcbiAgICB9XG4gIH1cblxuICBpZiAoZXJyb3IpIHtcbiAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignQW4gZXJyb3Igb2NjdXJlZCwgc2VlIGFib3ZlLicpO1xuICB9XG59XG5cblxuZnVuY3Rpb24gX2dldEFsbERlcGVuZGVuY2llcyh0cmVlOiBUcmVlKTogTWFwPHN0cmluZywgVmVyc2lvblJhbmdlPiB7XG4gIGNvbnN0IHBhY2thZ2VKc29uQ29udGVudCA9IHRyZWUucmVhZCgnL3BhY2thZ2UuanNvbicpO1xuICBpZiAoIXBhY2thZ2VKc29uQ29udGVudCkge1xuICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdDb3VsZCBub3QgZmluZCBhIHBhY2thZ2UuanNvbi4gQXJlIHlvdSBpbiBhIE5vZGUgcHJvamVjdD8nKTtcbiAgfVxuXG4gIGxldCBwYWNrYWdlSnNvbjogSnNvblNjaGVtYUZvck5wbVBhY2thZ2VKc29uRmlsZXM7XG4gIHRyeSB7XG4gICAgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKHBhY2thZ2VKc29uQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uU2NoZW1hRm9yTnBtUGFja2FnZUpzb25GaWxlcztcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdwYWNrYWdlLmpzb24gY291bGQgbm90IGJlIHBhcnNlZDogJyArIGUubWVzc2FnZSk7XG4gIH1cblxuICByZXR1cm4gbmV3IE1hcDxzdHJpbmcsIFZlcnNpb25SYW5nZT4oW1xuICAgIC4uLk9iamVjdC5lbnRyaWVzKHBhY2thZ2VKc29uLnBlZXJEZXBlbmRlbmNpZXMgfHwge30pLFxuICAgIC4uLk9iamVjdC5lbnRyaWVzKHBhY2thZ2VKc29uLmRldkRlcGVuZGVuY2llcyB8fCB7fSksXG4gICAgLi4uT2JqZWN0LmVudHJpZXMocGFja2FnZUpzb24uZGVwZW5kZW5jaWVzIHx8IHt9KSxcbiAgXSBhcyBbc3RyaW5nLCBWZXJzaW9uUmFuZ2VdW10pO1xufVxuXG5mdW5jdGlvbiBfZm9ybWF0VmVyc2lvbih2ZXJzaW9uOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcbiAgaWYgKHZlcnNpb24gPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBpZiAoIXZlcnNpb24ubWF0Y2goL15cXGR7MSwzMH1cXC5cXGR7MSwzMH1cXC5cXGR7MSwzMH0vKSkge1xuICAgIHZlcnNpb24gKz0gJy4wJztcbiAgfVxuICBpZiAoIXZlcnNpb24ubWF0Y2goL15cXGR7MSwzMH1cXC5cXGR7MSwzMH1cXC5cXGR7MSwzMH0vKSkge1xuICAgIHZlcnNpb24gKz0gJy4wJztcbiAgfVxuICBpZiAoIXNlbXZlci52YWxpZCh2ZXJzaW9uKSkge1xuICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBJbnZhbGlkIG1pZ3JhdGlvbiB2ZXJzaW9uOiAke0pTT04uc3RyaW5naWZ5KHZlcnNpb24pfWApO1xuICB9XG5cbiAgcmV0dXJuIHZlcnNpb247XG59XG5cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogVXBkYXRlU2NoZW1hKTogUnVsZSB7XG4gIGlmICghb3B0aW9ucy5wYWNrYWdlcykge1xuICAgIC8vIFdlIGNhbm5vdCBqdXN0IHJldHVybiB0aGlzIGJlY2F1c2Ugd2UgbmVlZCB0byBmZXRjaCB0aGUgcGFja2FnZXMgZnJvbSBOUE0gc3RpbGwgZm9yIHRoZVxuICAgIC8vIGhlbHAvZ3VpZGUgdG8gc2hvdy5cbiAgICBvcHRpb25zLnBhY2thZ2VzID0gW107XG4gIH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMucGFja2FnZXMgPT0gJ3N0cmluZycpIHtcbiAgICAvLyBJZiBhIHN0cmluZywgdGhlbiB3ZSBzaG91bGQgc3BsaXQgaXQgYW5kIG1ha2UgaXQgYW4gYXJyYXkuXG4gICAgb3B0aW9ucy5wYWNrYWdlcyA9IG9wdGlvbnMucGFja2FnZXMuc3BsaXQoLywvZyk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5taWdyYXRlT25seSAmJiBvcHRpb25zLmZyb20pIHtcbiAgICBpZiAob3B0aW9ucy5wYWNrYWdlcy5sZW5ndGggIT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCctLWZyb20gcmVxdWlyZXMgdGhhdCBvbmx5IGEgc2luZ2xlIHBhY2thZ2UgYmUgcGFzc2VkLicpO1xuICAgIH1cbiAgfVxuXG4gIG9wdGlvbnMuZnJvbSA9IF9mb3JtYXRWZXJzaW9uKG9wdGlvbnMuZnJvbSk7XG4gIG9wdGlvbnMudG8gPSBfZm9ybWF0VmVyc2lvbihvcHRpb25zLnRvKTtcblxuICByZXR1cm4gKHRyZWU6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBsb2dnZXIgPSBjb250ZXh0LmxvZ2dlcjtcbiAgICBjb25zdCBhbGxEZXBlbmRlbmNpZXMgPSBfZ2V0QWxsRGVwZW5kZW5jaWVzKHRyZWUpO1xuICAgIGNvbnN0IHBhY2thZ2VzID0gX2J1aWxkUGFja2FnZUxpc3Qob3B0aW9ucywgYWxsRGVwZW5kZW5jaWVzLCBsb2dnZXIpO1xuXG4gICAgcmV0dXJuIG9ic2VydmFibGVGcm9tKFsuLi5hbGxEZXBlbmRlbmNpZXMua2V5cygpXSkucGlwZShcbiAgICAgIC8vIEdyYWIgYWxsIHBhY2thZ2UuanNvbiBmcm9tIHRoZSBucG0gcmVwb3NpdG9yeS4gVGhpcyByZXF1aXJlcyBhIGxvdCBvZiBIVFRQIGNhbGxzIHNvIHdlXG4gICAgICAvLyB0cnkgdG8gcGFyYWxsZWxpemUgYXMgbWFueSBhcyBwb3NzaWJsZS5cbiAgICAgIG1lcmdlTWFwKGRlcE5hbWUgPT4gZ2V0TnBtUGFja2FnZUpzb24oZGVwTmFtZSwgb3B0aW9ucy5yZWdpc3RyeSwgbG9nZ2VyKSksXG5cbiAgICAgIC8vIEJ1aWxkIGEgbWFwIG9mIGFsbCBkZXBlbmRlbmNpZXMgYW5kIHRoZWlyIHBhY2thZ2VKc29uLlxuICAgICAgcmVkdWNlPE5wbVJlcG9zaXRvcnlQYWNrYWdlSnNvbiwgTWFwPHN0cmluZywgTnBtUmVwb3NpdG9yeVBhY2thZ2VKc29uPj4oXG4gICAgICAgIChhY2MsIG5wbVBhY2thZ2VKc29uKSA9PiB7XG4gICAgICAgICAgLy8gSWYgdGhlIHBhY2thZ2Ugd2FzIG5vdCBmb3VuZCBvbiB0aGUgcmVnaXN0cnkuIEl0IGNvdWxkIGJlIHByaXZhdGUsIHNvIHdlIHdpbGwganVzdFxuICAgICAgICAgIC8vIGlnbm9yZS4gSWYgdGhlIHBhY2thZ2Ugd2FzIHBhcnQgb2YgdGhlIGxpc3QsIHdlIHdpbGwgZXJyb3Igb3V0LCBidXQgd2lsbCBzaW1wbHkgaWdub3JlXG4gICAgICAgICAgLy8gaWYgaXQncyBlaXRoZXIgbm90IHJlcXVlc3RlZCAoc28ganVzdCBwYXJ0IG9mIHBhY2thZ2UuanNvbi4gc2lsZW50bHkpIG9yIGlmIGl0J3MgYVxuICAgICAgICAgIC8vIGAtLWFsbGAgc2l0dWF0aW9uLiBUaGVyZSBpcyBhbiBlZGdlIGNhc2UgaGVyZSB3aGVyZSBhIHB1YmxpYyBwYWNrYWdlIHBlZXIgZGVwZW5kcyBvbiBhXG4gICAgICAgICAgLy8gcHJpdmF0ZSBvbmUsIGJ1dCBpdCdzIHJhcmUgZW5vdWdoLlxuICAgICAgICAgIGlmICghbnBtUGFja2FnZUpzb24ubmFtZSkge1xuICAgICAgICAgICAgaWYgKHBhY2thZ2VzLmhhcyhucG1QYWNrYWdlSnNvbi5yZXF1ZXN0ZWROYW1lKSkge1xuICAgICAgICAgICAgICBpZiAob3B0aW9ucy5hbGwpIHtcbiAgICAgICAgICAgICAgICBsb2dnZXIud2FybihgUGFja2FnZSAke0pTT04uc3RyaW5naWZ5KG5wbVBhY2thZ2VKc29uLnJlcXVlc3RlZE5hbWUpfSB3YXMgbm90IGBcbiAgICAgICAgICAgICAgICAgICsgJ2ZvdW5kIG9uIHRoZSByZWdpc3RyeS4gU2tpcHBpbmcuJyk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oXG4gICAgICAgICAgICAgICAgICBgUGFja2FnZSAke0pTT04uc3RyaW5naWZ5KG5wbVBhY2thZ2VKc29uLnJlcXVlc3RlZE5hbWUpfSB3YXMgbm90IGZvdW5kIG9uIHRoZSBgXG4gICAgICAgICAgICAgICAgICArICdyZWdpc3RyeS4gQ2Fubm90IGNvbnRpbnVlIGFzIHRoaXMgbWF5IGJlIGFuIGVycm9yLicpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFjYy5zZXQobnBtUGFja2FnZUpzb24ubmFtZSwgbnBtUGFja2FnZUpzb24pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIH0sXG4gICAgICAgIG5ldyBNYXA8c3RyaW5nLCBOcG1SZXBvc2l0b3J5UGFja2FnZUpzb24+KCksXG4gICAgICApLFxuXG4gICAgICBtYXAobnBtUGFja2FnZUpzb25NYXAgPT4ge1xuICAgICAgICAvLyBBdWdtZW50IHRoZSBjb21tYW5kIGxpbmUgcGFja2FnZSBsaXN0IHdpdGggcGFja2FnZUdyb3VwcyBhbmQgZm9yd2FyZCBwZWVyIGRlcGVuZGVuY2llcy5cbiAgICAgICAgbnBtUGFja2FnZUpzb25NYXAuZm9yRWFjaCgobnBtUGFja2FnZUpzb24pID0+IHtcbiAgICAgICAgICBfYWRkUGFja2FnZUdyb3VwKHBhY2thZ2VzLCBhbGxEZXBlbmRlbmNpZXMsIG5wbVBhY2thZ2VKc29uLCBsb2dnZXIpO1xuICAgICAgICAgIF9hZGRQZWVyRGVwZW5kZW5jaWVzKHBhY2thZ2VzLCBhbGxEZXBlbmRlbmNpZXMsIG5wbVBhY2thZ2VKc29uLCBsb2dnZXIpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBCdWlsZCB0aGUgUGFja2FnZUluZm8gZm9yIGVhY2ggbW9kdWxlLlxuICAgICAgICBjb25zdCBwYWNrYWdlSW5mb01hcCA9IG5ldyBNYXA8c3RyaW5nLCBQYWNrYWdlSW5mbz4oKTtcbiAgICAgICAgbnBtUGFja2FnZUpzb25NYXAuZm9yRWFjaCgobnBtUGFja2FnZUpzb24pID0+IHtcbiAgICAgICAgICBwYWNrYWdlSW5mb01hcC5zZXQoXG4gICAgICAgICAgICBucG1QYWNrYWdlSnNvbi5uYW1lLFxuICAgICAgICAgICAgX2J1aWxkUGFja2FnZUluZm8odHJlZSwgcGFja2FnZXMsIGFsbERlcGVuZGVuY2llcywgbnBtUGFja2FnZUpzb24sIGxvZ2dlciksXG4gICAgICAgICAgKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHBhY2thZ2VJbmZvTWFwO1xuICAgICAgfSksXG5cbiAgICAgIHN3aXRjaE1hcChpbmZvTWFwID0+IHtcbiAgICAgICAgLy8gTm93IHRoYXQgd2UgaGF2ZSBhbGwgdGhlIGluZm9ybWF0aW9uLCBjaGVjayB0aGUgZmxhZ3MuXG4gICAgICAgIGlmIChwYWNrYWdlcy5zaXplID4gMCkge1xuICAgICAgICAgIGlmIChvcHRpb25zLm1pZ3JhdGVPbmx5ICYmIG9wdGlvbnMuZnJvbSAmJiBvcHRpb25zLnBhY2thZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gX21pZ3JhdGVPbmx5KFxuICAgICAgICAgICAgICBpbmZvTWFwLmdldChvcHRpb25zLnBhY2thZ2VzWzBdKSxcbiAgICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgICAgb3B0aW9ucy5mcm9tLFxuICAgICAgICAgICAgICBvcHRpb25zLnRvLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBzdWJsb2cgPSBuZXcgbG9nZ2luZy5MZXZlbENhcExvZ2dlcihcbiAgICAgICAgICAgICd2YWxpZGF0aW9uJyxcbiAgICAgICAgICAgIGxvZ2dlci5jcmVhdGVDaGlsZCgnJyksXG4gICAgICAgICAgICAnd2FybicsXG4gICAgICAgICAgKTtcbiAgICAgICAgICBfdmFsaWRhdGVVcGRhdGVQYWNrYWdlcyhpbmZvTWFwLCBvcHRpb25zLmZvcmNlLCBzdWJsb2cpO1xuXG4gICAgICAgICAgcmV0dXJuIF9wZXJmb3JtVXBkYXRlKHRyZWUsIGNvbnRleHQsIGluZm9NYXAsIGxvZ2dlciwgb3B0aW9ucy5taWdyYXRlT25seSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIF91c2FnZU1lc3NhZ2Uob3B0aW9ucywgaW5mb01hcCwgbG9nZ2VyKTtcbiAgICAgICAgfVxuICAgICAgfSksXG5cbiAgICAgIHN3aXRjaE1hcCgoKSA9PiBvZih0cmVlKSksXG4gICAgKTtcbiAgfTtcbn1cbiJdfQ==