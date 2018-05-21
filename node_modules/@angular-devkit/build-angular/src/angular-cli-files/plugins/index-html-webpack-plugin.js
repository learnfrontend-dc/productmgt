"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const crypto_1 = require("crypto");
const webpack_sources_1 = require("webpack-sources");
const parse5 = require('parse5');
function readFile(filename, compilation) {
    return new Promise((resolve, reject) => {
        compilation.inputFileSystem.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            let content;
            if (data.length >= 3 && data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
                // Strip UTF-8 BOM
                content = data.toString('utf8', 3);
            }
            else if (data.length >= 2 && data[0] === 0xFF && data[1] === 0xFE) {
                // Strip UTF-16 LE BOM
                content = data.toString('utf16le', 2);
            }
            else {
                content = data.toString();
            }
            resolve(content);
        });
    });
}
class IndexHtmlWebpackPlugin {
    constructor(options) {
        this._options = Object.assign({ input: 'index.html', output: 'index.html', entrypoints: ['polyfills', 'main'], sri: false }, options);
    }
    apply(compiler) {
        compiler.hooks.emit.tapPromise('index-html-webpack-plugin', (compilation) => __awaiter(this, void 0, void 0, function* () {
            // Get input html file
            const inputContent = yield readFile(this._options.input, compilation);
            compilation
                .fileDependencies.add(this._options.input);
            // Get all files for selected entrypoints
            let unfilteredSortedFiles = [];
            for (const entryName of this._options.entrypoints) {
                const entrypoint = compilation.entrypoints.get(entryName);
                if (entrypoint && entrypoint.getFiles) {
                    unfilteredSortedFiles = unfilteredSortedFiles.concat(entrypoint.getFiles() || []);
                }
            }
            // Filter files
            const existingFiles = new Set();
            const stylesheets = [];
            const scripts = [];
            for (const file of unfilteredSortedFiles) {
                if (existingFiles.has(file)) {
                    continue;
                }
                existingFiles.add(file);
                if (file.endsWith('.js')) {
                    scripts.push(file);
                }
                else if (file.endsWith('.css')) {
                    stylesheets.push(file);
                }
            }
            // Find the head and body elements
            const treeAdapter = parse5.treeAdapters.default;
            const document = parse5.parse(inputContent, { treeAdapter });
            let headElement;
            let bodyElement;
            for (const topNode of document.childNodes) {
                if (topNode.tagName === 'html') {
                    for (const htmlNode of topNode.childNodes) {
                        if (htmlNode.tagName === 'head') {
                            headElement = htmlNode;
                        }
                        if (htmlNode.tagName === 'body') {
                            bodyElement = htmlNode;
                        }
                    }
                }
            }
            // Inject into the html
            if (!headElement || !bodyElement) {
                throw new Error('Missing head and/or body elements');
            }
            for (const script of scripts) {
                const attrs = [
                    { name: 'type', value: 'text/javascript' },
                    { name: 'src', value: (this._options.deployUrl || '') + script },
                ];
                if (this._options.sri) {
                    const algo = 'sha384';
                    const hash = crypto_1.createHash(algo)
                        .update(compilation.assets[script].source(), 'utf8')
                        .digest('base64');
                    attrs.push({ name: 'integrity', value: `${algo}-${hash}` }, { name: 'crossorigin', value: 'anonymous' });
                }
                const element = treeAdapter.createElement('script', undefined, attrs);
                treeAdapter.appendChild(bodyElement, element);
            }
            // Adjust base href if specified
            if (this._options.baseHref != undefined) {
                let baseElement;
                for (const node of headElement.childNodes) {
                    if (node.tagName === 'base') {
                        baseElement = node;
                        break;
                    }
                }
                if (!baseElement) {
                    const element = treeAdapter.createElement('base', undefined, [
                        { name: 'href', value: this._options.baseHref },
                    ]);
                    treeAdapter.appendChild(headElement, element);
                }
                else {
                    let hrefAttribute;
                    for (const attribute of baseElement.attrs) {
                        if (attribute.name === 'href') {
                            hrefAttribute = attribute;
                        }
                    }
                    if (hrefAttribute) {
                        hrefAttribute.value = this._options.baseHref;
                    }
                    else {
                        baseElement.attrs.push({ name: 'href', value: this._options.baseHref });
                    }
                }
            }
            for (const stylesheet of stylesheets) {
                const element = treeAdapter.createElement('link', undefined, [
                    { name: 'rel', value: 'stylesheet' },
                    { name: 'href', value: (this._options.deployUrl || '') + stylesheet },
                ]);
                treeAdapter.appendChild(headElement, element);
            }
            // Add to compilation assets
            const outputContent = parse5.serialize(document, { treeAdapter });
            compilation.assets[this._options.output] = new webpack_sources_1.RawSource(outputContent);
        }));
    }
}
exports.IndexHtmlWebpackPlugin = IndexHtmlWebpackPlugin;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXgtaHRtbC13ZWJwYWNrLXBsdWdpbi5qcyIsInNvdXJjZVJvb3QiOiIuLyIsInNvdXJjZXMiOlsicGFja2FnZXMvYW5ndWxhcl9kZXZraXQvYnVpbGRfYW5ndWxhci9zcmMvYW5ndWxhci1jbGktZmlsZXMvcGx1Z2lucy9pbmRleC1odG1sLXdlYnBhY2stcGx1Z2luLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTs7Ozs7O0dBTUc7QUFDSCxtQ0FBb0M7QUFFcEMscURBQTRDO0FBRTVDLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQVdqQyxrQkFBa0IsUUFBZ0IsRUFBRSxXQUFvQztJQUN0RSxNQUFNLENBQUMsSUFBSSxPQUFPLENBQVMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDN0MsV0FBVyxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUMsR0FBVSxFQUFFLElBQVksRUFBRSxFQUFFO1lBQzFFLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ1IsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUVaLE1BQU0sQ0FBQztZQUNULENBQUM7WUFFRCxJQUFJLE9BQU8sQ0FBQztZQUNaLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDakYsa0JBQWtCO2dCQUNsQixPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDckMsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsSUFBSSxJQUFJ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QUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsR0FBRyxVQUFVLEVBQUU7aUJBQ3RFLENBQ0YsQ0FBQztnQkFDRixXQUFXLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNoRCxDQUFDO1lBRUQsNEJBQTRCO1lBQzVCLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztZQUNsRSxXQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSwyQkFBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzFFLENBQUMsQ0FBQSxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFuSkQsd0RBbUpDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgY3JlYXRlSGFzaCB9IGZyb20gJ2NyeXB0byc7XG5pbXBvcnQgeyBDb21waWxlciwgY29tcGlsYXRpb24gfSBmcm9tICd3ZWJwYWNrJztcbmltcG9ydCB7IFJhd1NvdXJjZSB9IGZyb20gJ3dlYnBhY2stc291cmNlcyc7XG5cbmNvbnN0IHBhcnNlNSA9IHJlcXVpcmUoJ3BhcnNlNScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIEluZGV4SHRtbFdlYnBhY2tQbHVnaW5PcHRpb25zIHtcbiAgaW5wdXQ6IHN0cmluZztcbiAgb3V0cHV0OiBzdHJpbmc7XG4gIGJhc2VIcmVmPzogc3RyaW5nO1xuICBlbnRyeXBvaW50czogc3RyaW5nW107XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgc3JpOiBib29sZWFuO1xufVxuXG5mdW5jdGlvbiByZWFkRmlsZShmaWxlbmFtZTogc3RyaW5nLCBjb21waWxhdGlvbjogY29tcGlsYXRpb24uQ29tcGlsYXRpb24pOiBQcm9taXNlPHN0cmluZz4ge1xuICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgY29tcGlsYXRpb24uaW5wdXRGaWxlU3lzdGVtLnJlYWRGaWxlKGZpbGVuYW1lLCAoZXJyOiBFcnJvciwgZGF0YTogQnVmZmVyKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJlamVjdChlcnIpO1xuXG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgbGV0IGNvbnRlbnQ7XG4gICAgICBpZiAoZGF0YS5sZW5ndGggPj0gMyAmJiBkYXRhWzBdID09PSAweEVGICYmIGRhdGFbMV0gPT09IDB4QkIgJiYgZGF0YVsyXSA9PT0gMHhCRikge1xuICAgICAgICAvLyBTdHJpcCBVVEYtOCBCT01cbiAgICAgICAgY29udGVudCA9IGRhdGEudG9TdHJpbmcoJ3V0ZjgnLCAzKTtcbiAgICAgIH0gZWxzZSBpZiAoZGF0YS5sZW5ndGggPj0gMiAmJiBkYXRhWzBdID09PSAweEZGICYmIGRhdGFbMV0gPT09IDB4RkUpIHtcbiAgICAgICAgLy8gU3RyaXAgVVRGLTE2IExFIEJPTVxuICAgICAgICBjb250ZW50ID0gZGF0YS50b1N0cmluZygndXRmMTZsZScsIDIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29udGVudCA9IGRhdGEudG9TdHJpbmcoKTtcbiAgICAgIH1cblxuICAgICAgcmVzb2x2ZShjb250ZW50KTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmV4cG9ydCBjbGFzcyBJbmRleEh0bWxXZWJwYWNrUGx1Z2luIHtcbiAgcHJpdmF0ZSBfb3B0aW9uczogSW5kZXhIdG1sV2VicGFja1BsdWdpbk9wdGlvbnM7XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucz86IFBhcnRpYWw8SW5kZXhIdG1sV2VicGFja1BsdWdpbk9wdGlvbnM+KSB7XG4gICAgdGhpcy5fb3B0aW9ucyA9IHtcbiAgICAgIGlucHV0OiAnaW5kZXguaHRtbCcsXG4gICAgICBvdXRwdXQ6ICdpbmRleC5odG1sJyxcbiAgICAgIGVudHJ5cG9pbnRzOiBbJ3BvbHlmaWxscycsICdtYWluJ10sXG4gICAgICBzcmk6IGZhbHNlLFxuICAgICAgLi4ub3B0aW9ucyxcbiAgICB9O1xuICB9XG5cbiAgYXBwbHkoY29tcGlsZXI6IENvbXBpbGVyKSB7XG4gICAgY29tcGlsZXIuaG9va3MuZW1pdC50YXBQcm9taXNlKCdpbmRleC1odG1sLXdlYnBhY2stcGx1Z2luJywgYXN5bmMgY29tcGlsYXRpb24gPT4ge1xuICAgICAgLy8gR2V0IGlucHV0IGh0bWwgZmlsZVxuICAgICAgY29uc3QgaW5wdXRDb250ZW50ID0gYXdhaXQgcmVhZEZpbGUodGhpcy5fb3B0aW9ucy5pbnB1dCwgY29tcGlsYXRpb24pO1xuICAgICAgKGNvbXBpbGF0aW9uIGFzIGNvbXBpbGF0aW9uLkNvbXBpbGF0aW9uICYgeyBmaWxlRGVwZW5kZW5jaWVzOiBTZXQ8c3RyaW5nPiB9KVxuICAgICAgICAuZmlsZURlcGVuZGVuY2llcy5hZGQodGhpcy5fb3B0aW9ucy5pbnB1dCk7XG5cblxuICAgICAgLy8gR2V0IGFsbCBmaWxlcyBmb3Igc2VsZWN0ZWQgZW50cnlwb2ludHNcbiAgICAgIGxldCB1bmZpbHRlcmVkU29ydGVkRmlsZXM6IHN0cmluZ1tdID0gW107XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5TmFtZSBvZiB0aGlzLl9vcHRpb25zLmVudHJ5cG9pbnRzKSB7XG4gICAgICAgIGNvbnN0IGVudHJ5cG9pbnQgPSBjb21waWxhdGlvbi5lbnRyeXBvaW50cy5nZXQoZW50cnlOYW1lKTtcbiAgICAgICAgaWYgKGVudHJ5cG9pbnQgJiYgZW50cnlwb2ludC5nZXRGaWxlcykge1xuICAgICAgICAgIHVuZmlsdGVyZWRTb3J0ZWRGaWxlcyA9IHVuZmlsdGVyZWRTb3J0ZWRGaWxlcy5jb25jYXQoZW50cnlwb2ludC5nZXRGaWxlcygpIHx8IFtdKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBGaWx0ZXIgZmlsZXNcbiAgICAgIGNvbnN0IGV4aXN0aW5nRmlsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICAgIGNvbnN0IHN0eWxlc2hlZXRzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgY29uc3Qgc2NyaXB0czogc3RyaW5nW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiB1bmZpbHRlcmVkU29ydGVkRmlsZXMpIHtcbiAgICAgICAgaWYgKGV4aXN0aW5nRmlsZXMuaGFzKGZpbGUpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgZXhpc3RpbmdGaWxlcy5hZGQoZmlsZSk7XG5cbiAgICAgICAgaWYgKGZpbGUuZW5kc1dpdGgoJy5qcycpKSB7XG4gICAgICAgICAgc2NyaXB0cy5wdXNoKGZpbGUpO1xuICAgICAgICB9IGVsc2UgaWYgKGZpbGUuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICAgIHN0eWxlc2hlZXRzLnB1c2goZmlsZSk7XG4gICAgICAgIH1cblxuICAgICAgfVxuXG4gICAgICAvLyBGaW5kIHRoZSBoZWFkIGFuZCBib2R5IGVsZW1lbnRzXG4gICAgICBjb25zdCB0cmVlQWRhcHRlciA9IHBhcnNlNS50cmVlQWRhcHRlcnMuZGVmYXVsdDtcbiAgICAgIGNvbnN0IGRvY3VtZW50ID0gcGFyc2U1LnBhcnNlKGlucHV0Q29udGVudCwgeyB0cmVlQWRhcHRlciB9KTtcbiAgICAgIGxldCBoZWFkRWxlbWVudDtcbiAgICAgIGxldCBib2R5RWxlbWVudDtcbiAgICAgIGZvciAoY29uc3QgdG9wTm9kZSBvZiBkb2N1bWVudC5jaGlsZE5vZGVzKSB7XG4gICAgICAgIGlmICh0b3BOb2RlLnRhZ05hbWUgPT09ICdodG1sJykge1xuICAgICAgICAgIGZvciAoY29uc3QgaHRtbE5vZGUgb2YgdG9wTm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAoaHRtbE5vZGUudGFnTmFtZSA9PT0gJ2hlYWQnKSB7XG4gICAgICAgICAgICAgIGhlYWRFbGVtZW50ID0gaHRtbE5vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaHRtbE5vZGUudGFnTmFtZSA9PT0gJ2JvZHknKSB7XG4gICAgICAgICAgICAgIGJvZHlFbGVtZW50ID0gaHRtbE5vZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEluamVjdCBpbnRvIHRoZSBodG1sXG5cbiAgICAgIGlmICghaGVhZEVsZW1lbnQgfHwgIWJvZHlFbGVtZW50KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2luZyBoZWFkIGFuZC9vciBib2R5IGVsZW1lbnRzJyk7XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3Qgc2NyaXB0IG9mIHNjcmlwdHMpIHtcbiAgICAgICAgY29uc3QgYXR0cnMgPSBbXG4gICAgICAgICAgeyBuYW1lOiAndHlwZScsIHZhbHVlOiAndGV4dC9qYXZhc2NyaXB0JyB9LFxuICAgICAgICAgIHsgbmFtZTogJ3NyYycsIHZhbHVlOiAodGhpcy5fb3B0aW9ucy5kZXBsb3lVcmwgfHwgJycpICsgc2NyaXB0IH0sXG4gICAgICAgIF07XG4gICAgICAgIGlmICh0aGlzLl9vcHRpb25zLnNyaSkge1xuICAgICAgICAgIGNvbnN0IGFsZ28gPSAnc2hhMzg0JztcbiAgICAgICAgICBjb25zdCBoYXNoID0gY3JlYXRlSGFzaChhbGdvKVxuICAgICAgICAgICAgLnVwZGF0ZShjb21waWxhdGlvbi5hc3NldHNbc2NyaXB0XS5zb3VyY2UoKSwgJ3V0ZjgnKVxuICAgICAgICAgICAgLmRpZ2VzdCgnYmFzZTY0Jyk7XG4gICAgICAgICAgYXR0cnMucHVzaChcbiAgICAgICAgICAgIHsgbmFtZTogJ2ludGVncml0eScsIHZhbHVlOiBgJHthbGdvfS0ke2hhc2h9YCB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnY3Jvc3NvcmlnaW4nLCB2YWx1ZTogJ2Fub255bW91cycgfSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZWxlbWVudCA9IHRyZWVBZGFwdGVyLmNyZWF0ZUVsZW1lbnQoXG4gICAgICAgICAgJ3NjcmlwdCcsXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgIGF0dHJzLFxuICAgICAgICApO1xuICAgICAgICB0cmVlQWRhcHRlci5hcHBlbmRDaGlsZChib2R5RWxlbWVudCwgZWxlbWVudCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkanVzdCBiYXNlIGhyZWYgaWYgc3BlY2lmaWVkXG4gICAgICBpZiAodGhpcy5fb3B0aW9ucy5iYXNlSHJlZiAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgbGV0IGJhc2VFbGVtZW50O1xuICAgICAgICBmb3IgKGNvbnN0IG5vZGUgb2YgaGVhZEVsZW1lbnQuY2hpbGROb2Rlcykge1xuICAgICAgICAgIGlmIChub2RlLnRhZ05hbWUgPT09ICdiYXNlJykge1xuICAgICAgICAgICAgYmFzZUVsZW1lbnQgPSBub2RlO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFiYXNlRWxlbWVudCkge1xuICAgICAgICAgIGNvbnN0IGVsZW1lbnQgPSB0cmVlQWRhcHRlci5jcmVhdGVFbGVtZW50KFxuICAgICAgICAgICAgJ2Jhc2UnLFxuICAgICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICB7IG5hbWU6ICdocmVmJywgdmFsdWU6IHRoaXMuX29wdGlvbnMuYmFzZUhyZWYgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgKTtcbiAgICAgICAgICB0cmVlQWRhcHRlci5hcHBlbmRDaGlsZChoZWFkRWxlbWVudCwgZWxlbWVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbGV0IGhyZWZBdHRyaWJ1dGU7XG4gICAgICAgICAgZm9yIChjb25zdCBhdHRyaWJ1dGUgb2YgYmFzZUVsZW1lbnQuYXR0cnMpIHtcbiAgICAgICAgICAgIGlmIChhdHRyaWJ1dGUubmFtZSA9PT0gJ2hyZWYnKSB7XG4gICAgICAgICAgICAgIGhyZWZBdHRyaWJ1dGUgPSBhdHRyaWJ1dGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChocmVmQXR0cmlidXRlKSB7XG4gICAgICAgICAgICBocmVmQXR0cmlidXRlLnZhbHVlID0gdGhpcy5fb3B0aW9ucy5iYXNlSHJlZjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYmFzZUVsZW1lbnQuYXR0cnMucHVzaCh7IG5hbWU6ICdocmVmJywgdmFsdWU6IHRoaXMuX29wdGlvbnMuYmFzZUhyZWYgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAoY29uc3Qgc3R5bGVzaGVldCBvZiBzdHlsZXNoZWV0cykge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gdHJlZUFkYXB0ZXIuY3JlYXRlRWxlbWVudChcbiAgICAgICAgICAnbGluaycsXG4gICAgICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgIFtcbiAgICAgICAgICAgIHsgbmFtZTogJ3JlbCcsIHZhbHVlOiAnc3R5bGVzaGVldCcgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2hyZWYnLCB2YWx1ZTogKHRoaXMuX29wdGlvbnMuZGVwbG95VXJsIHx8ICcnKSArIHN0eWxlc2hlZXQgfSxcbiAgICAgICAgICBdLFxuICAgICAgICApO1xuICAgICAgICB0cmVlQWRhcHRlci5hcHBlbmRDaGlsZChoZWFkRWxlbWVudCwgZWxlbWVudCk7XG4gICAgICB9XG5cbiAgICAgIC8vIEFkZCB0byBjb21waWxhdGlvbiBhc3NldHNcbiAgICAgIGNvbnN0IG91dHB1dENvbnRlbnQgPSBwYXJzZTUuc2VyaWFsaXplKGRvY3VtZW50LCB7IHRyZWVBZGFwdGVyIH0pO1xuICAgICAgY29tcGlsYXRpb24uYXNzZXRzW3RoaXMuX29wdGlvbnMub3V0cHV0XSA9IG5ldyBSYXdTb3VyY2Uob3V0cHV0Q29udGVudCk7XG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==