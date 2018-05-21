"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const fs_1 = require("fs");
const transform_javascript_1 = require("../helpers/transform-javascript");
const class_fold_1 = require("../transforms/class-fold");
const import_tslib_1 = require("../transforms/import-tslib");
const prefix_classes_1 = require("../transforms/prefix-classes");
const prefix_functions_1 = require("../transforms/prefix-functions");
const scrub_file_1 = require("../transforms/scrub-file");
const wrap_enums_1 = require("../transforms/wrap-enums");
// Angular packages are known to have no side effects.
const whitelistedAngularModules = [
    /[\\/]node_modules[\\/]@angular[\\/]animations[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]common[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]compiler[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]core[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]forms[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]http[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]platform-browser-dynamic[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]platform-browser[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]platform-webworker-dynamic[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]platform-webworker[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]router[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]upgrade[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]material[\\/]/,
    /[\\/]node_modules[\\/]@angular[\\/]cdk[\\/]/,
];
// TODO: this code is very fragile and should be reworked.
//       See: https://github.com/angular/devkit/issues/523
const es5AngularModules = [
    // Angular 4 packaging format has .es5.js as the extension.
    /\.es5\.js$/,
    // Angular 5 has esm5 folders.
    // Angular 6 has fesm5 folders.
    /[\\/]node_modules[\\/]@angular[\\/][^\\/]+[\\/]f?esm5[\\/]/,
    // All Angular versions have UMD with es5.
    /\.umd\.js$/,
];
// Factories created by AOT are known to have no side effects and contain es5 code.
// In Angular 2/4 the file path for factories can be `.ts`, but in Angular 5 it is `.js`.
const ngFactories = [
    /\.ngfactory\.[jt]s/,
    /\.ngstyle\.[jt]s/,
];
function isKnownSideEffectFree(filePath) {
    return ngFactories.some((re) => re.test(filePath)) || (whitelistedAngularModules.some((re) => re.test(filePath))
        && es5AngularModules.some((re) => re.test(filePath)));
}
function buildOptimizer(options) {
    const { inputFilePath } = options;
    let { originalFilePath, content } = options;
    if (!originalFilePath && inputFilePath) {
        originalFilePath = inputFilePath;
    }
    if (!inputFilePath && content === undefined) {
        throw new Error('Either filePath or content must be specified in options.');
    }
    if (content === undefined) {
        content = fs_1.readFileSync(inputFilePath, 'UTF-8');
    }
    if (!content) {
        return {
            content: null,
            sourceMap: null,
            emitSkipped: true,
        };
    }
    const isWebpackBundle = content.indexOf('__webpack_require__') !== -1;
    // Determine which transforms to apply.
    const getTransforms = [];
    let typeCheck = false;
    if (options.isSideEffectFree || originalFilePath && isKnownSideEffectFree(originalFilePath)) {
        getTransforms.push(
        // getPrefixFunctionsTransformer is rather dangerous, apply only to known pure es5 modules.
        // It will mark both `require()` calls and `console.log(stuff)` as pure.
        // We only apply it to whitelisted modules, since we know they are safe.
        // getPrefixFunctionsTransformer needs to be before getFoldFileTransformer.
        prefix_functions_1.getPrefixFunctionsTransformer, scrub_file_1.getScrubFileTransformer, class_fold_1.getFoldFileTransformer);
        typeCheck = true;
    }
    else if (scrub_file_1.testScrubFile(content)) {
        // Always test as these require the type checker
        getTransforms.push(scrub_file_1.getScrubFileTransformer, class_fold_1.getFoldFileTransformer);
        typeCheck = true;
    }
    // tests are not needed for fast path
    // usage will be expanded once transformers are verified safe
    const ignoreTest = !options.emitSourceMap && !typeCheck;
    if (prefix_classes_1.testPrefixClasses(content)) {
        getTransforms.unshift(prefix_classes_1.getPrefixClassesTransformer);
    }
    // This transform introduces import/require() calls, but this won't work properly on libraries
    // built with Webpack. These libraries use __webpack_require__() calls instead, which will break
    // with a new import that wasn't part of it's original module list.
    // We ignore this transform for such libraries.
    if (!isWebpackBundle && (ignoreTest || import_tslib_1.testImportTslib(content))) {
        getTransforms.unshift(import_tslib_1.getImportTslibTransformer);
    }
    if (wrap_enums_1.testWrapEnums(content)) {
        getTransforms.unshift(wrap_enums_1.getWrapEnumsTransformer);
    }
    const transformJavascriptOpts = {
        content: content,
        inputFilePath: options.inputFilePath,
        outputFilePath: options.outputFilePath,
        emitSourceMap: options.emitSourceMap,
        strict: options.strict,
        getTransforms,
        typeCheck,
    };
    return transform_javascript_1.transformJavascript(transformJavascriptOpts);
}
exports.buildOptimizer = buildOptimizer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVpbGQtb3B0aW1pemVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9vcHRpbWl6ZXIvc3JjL2J1aWxkLW9wdGltaXplci9idWlsZC1vcHRpbWl6ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7O0dBTUc7QUFDSCwyQkFBa0M7QUFDbEMsMEVBSXlDO0FBQ3pDLHlEQUFrRTtBQUNsRSw2REFBd0Y7QUFDeEYsaUVBQThGO0FBQzlGLHFFQUErRTtBQUMvRSx5REFBa0Y7QUFDbEYseURBQWtGO0FBR2xGLHNEQUFzRDtBQUN0RCxNQUFNLHlCQUF5QixHQUFHO0lBQ2hDLG9EQUFvRDtJQUNwRCxnREFBZ0Q7SUFDaEQsa0RBQWtEO0lBQ2xELDhDQUE4QztJQUM5QywrQ0FBK0M7SUFDL0MsOENBQThDO0lBQzlDLGtFQUFrRTtJQUNsRSwwREFBMEQ7SUFDMUQsb0VBQW9FO0lBQ3BFLDREQUE0RDtJQUM1RCxnREFBZ0Q7SUFDaEQsaURBQWlEO0lBQ2pELGtEQUFrRDtJQUNsRCw2Q0FBNkM7Q0FDOUMsQ0FBQztBQUVGLDBEQUEwRDtBQUMxRCwwREFBMEQ7QUFDMUQsTUFBTSxpQkFBaUIsR0FBRztJQUN4QiwyREFBMkQ7SUFDM0QsWUFBWTtJQUNaLDhCQUE4QjtJQUM5QiwrQkFBK0I7SUFDL0IsNERBQTREO0lBQzVELDBDQUEwQztJQUMxQyxZQUFZO0NBQ2IsQ0FBQztBQUVGLG1GQUFtRjtBQUNuRix5RkFBeUY7QUFDekYsTUFBTSxXQUFXLEdBQUc7SUFDbEIsb0JBQW9CO0lBQ3BCLGtCQUFrQjtDQUNuQixDQUFDO0FBRUYsK0JBQStCLFFBQWdCO0lBQzdDLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FDcEQseUJBQXlCLENBQUMsSUFBSSxDQUFDLENB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b0NBQXVCLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRUQsTUFBTSx1QkFBdUIsR0FBK0I7UUFDMUQsT0FBTyxFQUFFLE9BQU87UUFDaEIsYUFBYSxFQUFFLE9BQU8sQ0FBQyxhQUFhO1FBQ3BDLGNBQWMsRUFBRSxPQUFPLENBQUMsY0FBYztRQUN0QyxhQUFhLEVBQUUsT0FBTyxDQUFDLGFBQWE7UUFDcEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNO1FBQ3RCLGFBQWE7UUFDYixTQUFTO0tBQ1YsQ0FBQztJQUVGLE1BQU0sQ0FBQywwQ0FBbUIsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO0FBQ3RELENBQUM7QUFsRkQsd0NBa0ZDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHtcbiAgVHJhbnNmb3JtSmF2YXNjcmlwdE9wdGlvbnMsXG4gIFRyYW5zZm9ybUphdmFzY3JpcHRPdXRwdXQsXG4gIHRyYW5zZm9ybUphdmFzY3JpcHQsXG59IGZyb20gJy4uL2hlbHBlcnMvdHJhbnNmb3JtLWphdmFzY3JpcHQnO1xuaW1wb3J0IHsgZ2V0Rm9sZEZpbGVUcmFuc2Zvcm1lciB9IGZyb20gJy4uL3RyYW5zZm9ybXMvY2xhc3MtZm9sZCc7XG5pbXBvcnQgeyBnZXRJbXBvcnRUc2xpYlRyYW5zZm9ybWVyLCB0ZXN0SW1wb3J0VHNsaWIgfSBmcm9tICcuLi90cmFuc2Zvcm1zL2ltcG9ydC10c2xpYic7XG5pbXBvcnQgeyBnZXRQcmVmaXhDbGFzc2VzVHJhbnNmb3JtZXIsIHRlc3RQcmVmaXhDbGFzc2VzIH0gZnJvbSAnLi4vdHJhbnNmb3Jtcy9wcmVmaXgtY2xhc3Nlcyc7XG5pbXBvcnQgeyBnZXRQcmVmaXhGdW5jdGlvbnNUcmFuc2Zvcm1lciB9IGZyb20gJy4uL3RyYW5zZm9ybXMvcHJlZml4LWZ1bmN0aW9ucyc7XG5pbXBvcnQgeyBnZXRTY3J1YkZpbGVUcmFuc2Zvcm1lciwgdGVzdFNjcnViRmlsZSB9IGZyb20gJy4uL3RyYW5zZm9ybXMvc2NydWItZmlsZSc7XG5pbXBvcnQgeyBnZXRXcmFwRW51bXNUcmFuc2Zvcm1lciwgdGVzdFdyYXBFbnVtcyB9IGZyb20gJy4uL3RyYW5zZm9ybXMvd3JhcC1lbnVtcyc7XG5cblxuLy8gQW5ndWxhciBwYWNrYWdlcyBhcmUga25vd24gdG8gaGF2ZSBubyBzaWRlIGVmZmVjdHMuXG5jb25zdCB3aGl0ZWxpc3RlZEFuZ3VsYXJNb2R1bGVzID0gW1xuICAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL11hbmltYXRpb25zW1xcXFwvXS8sXG4gIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXWNvbW1vbltcXFxcL10vLFxuICAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL11jb21waWxlcltcXFxcL10vLFxuICAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL11jb3JlW1xcXFwvXS8sXG4gIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXWZvcm1zW1xcXFwvXS8sXG4gIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXWh0dHBbXFxcXC9dLyxcbiAgL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dcGxhdGZvcm0tYnJvd3Nlci1keW5hbWljW1xcXFwvXS8sXG4gIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXXBsYXRmb3JtLWJyb3dzZXJbXFxcXC9dLyxcbiAgL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dcGxhdGZvcm0td2Vid29ya2VyLWR5bmFtaWNbXFxcXC9dLyxcbiAgL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dcGxhdGZvcm0td2Vid29ya2VyW1xcXFwvXS8sXG4gIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXXJvdXRlcltcXFxcL10vLFxuICAvW1xcXFwvXW5vZGVfbW9kdWxlc1tcXFxcL11AYW5ndWxhcltcXFxcL111cGdyYWRlW1xcXFwvXS8sXG4gIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXW1hdGVyaWFsW1xcXFwvXS8sXG4gIC9bXFxcXC9dbm9kZV9tb2R1bGVzW1xcXFwvXUBhbmd1bGFyW1xcXFwvXWNka1tcXFxcL10vLFxuXTtcblxuLy8gVE9ETzogdGhpcyBjb2RlIGlzIHZlcnkgZnJhZ2lsZSBhbmQgc2hvdWxkIGJlIHJld29ya2VkLlxuLy8gICAgICAgU2VlOiBodHRwczovL2dpdGh1Yi5jb20vYW5ndWxhci9kZXZraXQvaXNzdWVzLzUyM1xuY29uc3QgZXM1QW5ndWxhck1vZHVsZXMgPSBbXG4gIC8vIEFuZ3VsYXIgNCBwYWNrYWdpbmcgZm9ybWF0IGhhcyAuZXM1LmpzIGFzIHRoZSBleHRlbnNpb24uXG4gIC9cXC5lczVcXC5qcyQvLCAvLyBBbmd1bGFyIDRcbiAgLy8gQW5ndWxhciA1IGhhcyBlc201IGZvbGRlcnMuXG4gIC8vIEFuZ3VsYXIgNiBoYXMgZmVzbTUgZm9sZGVycy5cbiAgL1tcXFxcL11ub2RlX21vZHVsZXNbXFxcXC9dQGFuZ3VsYXJbXFxcXC9dW15cXFxcL10rW1xcXFwvXWY/ZXNtNVtcXFxcL10vLFxuICAvLyBBbGwgQW5ndWxhciB2ZXJzaW9ucyBoYXZlIFVNRCB3aXRoIGVzNS5cbiAgL1xcLnVtZFxcLmpzJC8sXG5dO1xuXG4vLyBGYWN0b3JpZXMgY3JlYXRlZCBieSBBT1QgYXJlIGtub3duIHRvIGhhdmUgbm8gc2lkZSBlZmZlY3RzIGFuZCBjb250YWluIGVzNSBjb2RlLlxuLy8gSW4gQW5ndWxhciAyLzQgdGhlIGZpbGUgcGF0aCBmb3IgZmFjdG9yaWVzIGNhbiBiZSBgLnRzYCwgYnV0IGluIEFuZ3VsYXIgNSBpdCBpcyBgLmpzYC5cbmNvbnN0IG5nRmFjdG9yaWVzID0gW1xuICAvXFwubmdmYWN0b3J5XFwuW2p0XXMvLFxuICAvXFwubmdzdHlsZVxcLltqdF1zLyxcbl07XG5cbmZ1bmN0aW9uIGlzS25vd25TaWRlRWZmZWN0RnJlZShmaWxlUGF0aDogc3RyaW5nKSB7XG4gIHJldHVybiBuZ0ZhY3Rvcmllcy5zb21lKChyZSkgPT4gcmUudGVzdChmaWxlUGF0aCkpIHx8IChcbiAgICB3aGl0ZWxpc3RlZEFuZ3VsYXJNb2R1bGVzLnNvbWUoKHJlKSA9PiByZS50ZXN0KGZpbGVQYXRoKSlcbiAgICAmJiBlczVBbmd1bGFyTW9kdWxlcy5zb21lKChyZSkgPT4gcmUudGVzdChmaWxlUGF0aCkpXG4gICk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQnVpbGRPcHRpbWl6ZXJPcHRpb25zIHtcbiAgY29udGVudD86IHN0cmluZztcbiAgb3JpZ2luYWxGaWxlUGF0aD86IHN0cmluZztcbiAgaW5wdXRGaWxlUGF0aD86IHN0cmluZztcbiAgb3V0cHV0RmlsZVBhdGg/OiBzdHJpbmc7XG4gIGVtaXRTb3VyY2VNYXA/OiBib29sZWFuO1xuICBzdHJpY3Q/OiBib29sZWFuO1xuICBpc1NpZGVFZmZlY3RGcmVlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkT3B0aW1pemVyKG9wdGlvbnM6IEJ1aWxkT3B0aW1pemVyT3B0aW9ucyk6IFRyYW5zZm9ybUphdmFzY3JpcHRPdXRwdXQge1xuXG4gIGNvbnN0IHsgaW5wdXRGaWxlUGF0aCB9ID0gb3B0aW9ucztcbiAgbGV0IHsgb3JpZ2luYWxGaWxlUGF0aCwgY29udGVudCB9ID0gb3B0aW9ucztcblxuICBpZiAoIW9yaWdpbmFsRmlsZVBhdGggJiYgaW5wdXRGaWxlUGF0aCkge1xuICAgIG9yaWdpbmFsRmlsZVBhdGggPSBpbnB1dEZpbGVQYXRoO1xuICB9XG5cbiAgaWYgKCFpbnB1dEZpbGVQYXRoICYmIGNvbnRlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcignRWl0aGVyIGZpbGVQYXRoIG9yIGNvbnRlbnQgbXVzdCBiZSBzcGVjaWZpZWQgaW4gb3B0aW9ucy4nKTtcbiAgfVxuXG4gIGlmIChjb250ZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICBjb250ZW50ID0gcmVhZEZpbGVTeW5jKGlucHV0RmlsZVBhdGggYXMgc3RyaW5nLCAnVVRGLTgnKTtcbiAgfVxuXG4gIGlmICghY29udGVudCkge1xuICAgIHJldHVybiB7XG4gICAgICBjb250ZW50OiBudWxsLFxuICAgICAgc291cmNlTWFwOiBudWxsLFxuICAgICAgZW1pdFNraXBwZWQ6IHRydWUsXG4gICAgfTtcbiAgfVxuXG4gIGNvbnN0IGlzV2VicGFja0J1bmRsZSA9IGNvbnRlbnQuaW5kZXhPZignX193ZWJwYWNrX3JlcXVpcmVfXycpICE9PSAtMTtcblxuICAvLyBEZXRlcm1pbmUgd2hpY2ggdHJhbnNmb3JtcyB0byBhcHBseS5cbiAgY29uc3QgZ2V0VHJhbnNmb3JtcyA9IFtdO1xuXG4gIGxldCB0eXBlQ2hlY2sgPSBmYWxzZTtcbiAgaWYgKG9wdGlvbnMuaXNTaWRlRWZmZWN0RnJlZSB8fCBvcmlnaW5hbEZpbGVQYXRoICYmIGlzS25vd25TaWRlRWZmZWN0RnJlZShvcmlnaW5hbEZpbGVQYXRoKSkge1xuICAgIGdldFRyYW5zZm9ybXMucHVzaChcbiAgICAgIC8vIGdldFByZWZpeEZ1bmN0aW9uc1RyYW5zZm9ybWVyIGlzIHJhdGhlciBkYW5nZXJvdXMsIGFwcGx5IG9ubHkgdG8ga25vd24gcHVyZSBlczUgbW9kdWxlcy5cbiAgICAgIC8vIEl0IHdpbGwgbWFyayBib3RoIGByZXF1aXJlKClgIGNhbGxzIGFuZCBgY29uc29sZS5sb2coc3R1ZmYpYCBhcyBwdXJlLlxuICAgICAgLy8gV2Ugb25seSBhcHBseSBpdCB0byB3aGl0ZWxpc3RlZCBtb2R1bGVzLCBzaW5jZSB3ZSBrbm93IHRoZXkgYXJlIHNhZmUuXG4gICAgICAvLyBnZXRQcmVmaXhGdW5jdGlvbnNUcmFuc2Zvcm1lciBuZWVkcyB0byBiZSBiZWZvcmUgZ2V0Rm9sZEZpbGVUcmFuc2Zvcm1lci5cbiAgICAgIGdldFByZWZpeEZ1bmN0aW9uc1RyYW5zZm9ybWVyLFxuICAgICAgZ2V0U2NydWJGaWxlVHJhbnNmb3JtZXIsXG4gICAgICBnZXRGb2xkRmlsZVRyYW5zZm9ybWVyLFxuICAgICk7XG4gICAgdHlwZUNoZWNrID0gdHJ1ZTtcbiAgfSBlbHNlIGlmICh0ZXN0U2NydWJGaWxlKGNvbnRlbnQpKSB7XG4gICAgLy8gQWx3YXlzIHRlc3QgYXMgdGhlc2UgcmVxdWlyZSB0aGUgdHlwZSBjaGVja2VyXG4gICAgZ2V0VHJhbnNmb3Jtcy5wdXNoKFxuICAgICAgZ2V0U2NydWJGaWxlVHJhbnNmb3JtZXIsXG4gICAgICBnZXRGb2xkRmlsZVRyYW5zZm9ybWVyLFxuICAgICk7XG4gICAgdHlwZUNoZWNrID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIHRlc3RzIGFyZSBub3QgbmVlZGVkIGZvciBmYXN0IHBhdGhcbiAgLy8gdXNhZ2Ugd2lsbCBiZSBleHBhbmRlZCBvbmNlIHRyYW5zZm9ybWVycyBhcmUgdmVyaWZpZWQgc2FmZVxuICBjb25zdCBpZ25vcmVUZXN0ID0gIW9wdGlvbnMuZW1pdFNvdXJjZU1hcCAmJiAhdHlwZUNoZWNrO1xuXG4gIGlmICh0ZXN0UHJlZml4Q2xhc3Nlcyhjb250ZW50KSkge1xuICAgIGdldFRyYW5zZm9ybXMudW5zaGlmdChnZXRQcmVmaXhDbGFzc2VzVHJhbnNmb3JtZXIpO1xuICB9XG5cbiAgLy8gVGhpcyB0cmFuc2Zvcm0gaW50cm9kdWNlcyBpbXBvcnQvcmVxdWlyZSgpIGNhbGxzLCBidXQgdGhpcyB3b24ndCB3b3JrIHByb3Blcmx5IG9uIGxpYnJhcmllc1xuICAvLyBidWlsdCB3aXRoIFdlYnBhY2suIFRoZXNlIGxpYnJhcmllcyB1c2UgX193ZWJwYWNrX3JlcXVpcmVfXygpIGNhbGxzIGluc3RlYWQsIHdoaWNoIHdpbGwgYnJlYWtcbiAgLy8gd2l0aCBhIG5ldyBpbXBvcnQgdGhhdCB3YXNuJ3QgcGFydCBvZiBpdCdzIG9yaWdpbmFsIG1vZHVsZSBsaXN0LlxuICAvLyBXZSBpZ25vcmUgdGhpcyB0cmFuc2Zvcm0gZm9yIHN1Y2ggbGlicmFyaWVzLlxuICBpZiAoIWlzV2VicGFja0J1bmRsZSAmJiAoaWdub3JlVGVzdCB8fCB0ZXN0SW1wb3J0VHNsaWIoY29udGVudCkpKSB7XG4gICAgZ2V0VHJhbnNmb3Jtcy51bnNoaWZ0KGdldEltcG9ydFRzbGliVHJhbnNmb3JtZXIpO1xuICB9XG5cbiAgaWYgKHRlc3RXcmFwRW51bXMoY29udGVudCkpIHtcbiAgICBnZXRUcmFuc2Zvcm1zLnVuc2hpZnQoZ2V0V3JhcEVudW1zVHJhbnNmb3JtZXIpO1xuICB9XG5cbiAgY29uc3QgdHJhbnNmb3JtSmF2YXNjcmlwdE9wdHM6IFRyYW5zZm9ybUphdmFzY3JpcHRPcHRpb25zID0ge1xuICAgIGNvbnRlbnQ6IGNvbnRlbnQsXG4gICAgaW5wdXRGaWxlUGF0aDogb3B0aW9ucy5pbnB1dEZpbGVQYXRoLFxuICAgIG91dHB1dEZpbGVQYXRoOiBvcHRpb25zLm91dHB1dEZpbGVQYXRoLFxuICAgIGVtaXRTb3VyY2VNYXA6IG9wdGlvbnMuZW1pdFNvdXJjZU1hcCxcbiAgICBzdHJpY3Q6IG9wdGlvbnMuc3RyaWN0LFxuICAgIGdldFRyYW5zZm9ybXMsXG4gICAgdHlwZUNoZWNrLFxuICB9O1xuXG4gIHJldHVybiB0cmFuc2Zvcm1KYXZhc2NyaXB0KHRyYW5zZm9ybUphdmFzY3JpcHRPcHRzKTtcbn1cbiJdfQ==