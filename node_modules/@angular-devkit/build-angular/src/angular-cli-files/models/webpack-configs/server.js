"use strict";
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Returns a partial specific to creating a bundle for node
 * @param wco Options which are include the build options and app config
 */
function getServerConfig(wco) {
    const config = {
        resolve: {
            mainFields: [
                ...(wco.supportES2015 ? ['es2015'] : []),
                'main', 'module',
            ],
        },
        target: 'node',
        output: {
            libraryTarget: 'commonjs'
        },
        node: false,
    };
    if (wco.buildOptions.bundleDependencies == 'none') {
        config.externals = [
            /^@angular/,
            (_, request, callback) => {
                // Absolute & Relative paths are not externals
                if (request.match(/^\.{0,2}\//)) {
                    return callback();
                }
                try {
                    // Attempt to resolve the module via Node
                    const e = require.resolve(request);
                    if (/node_modules/.test(e)) {
                        // It's a node_module
                        callback(null, request);
                    }
                    else {
                        // It's a system thing (.ie util, fs...)
                        callback();
                    }
                }
                catch (e) {
                    // Node couldn't find it, so it must be user-aliased
                    callback();
                }
            }
        ];
    }
    return config;
}
exports.getServerConfig = getServerConfig;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9tb2RlbHMvd2VicGFjay1jb25maWdzL3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsaUJBQWlCO0FBQ2pCLCtEQUErRDs7QUFJL0Q7OztHQUdHO0FBQ0gseUJBQWdDLEdBQXlCO0lBRXZELE1BQU0sTUFBTSxHQUFRO1FBQ2xCLE9BQU8sRUFBRTtZQUNQLFVBQVUsRUFBRTtnQkFDVixHQUFHLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO2dCQUN4QyxNQUFNLEVBQUUsUUFBUTthQUNqQjtTQUNGO1FBQ0QsTUFBTSxFQUFFLE1BQU07UUFDZCxNQUFNLEVBQUU7WUFDTixhQUFhLEVBQUUsVUFBVTtTQUMxQjtRQUNELElBQUksRUFBRSxLQUFLO0tBQ1osQ0FBQztJQUVGLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsa0JBQWtCLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNsRCxNQUFNLENBQUMsU0FBUyxHQUFHO1lBQ2pCLFdBQVc7WUFDWCxDQUFDLENBQU0sRUFBRSxPQUFZLEVBQUUsUUFBNkMsRUFBRSxFQUFFO2dCQUN0RSw4Q0FBOEM7Z0JBQzlDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNoQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ3BCLENBQUM7Z0JBRUQsSUFBSSxDQUFDO29CQUNILHlDQUF5QztvQkFDekMsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDbkMsRUFBRSxDQUFDLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQzNCLHFCQUFxQjt3QkFDckIsUUFBUSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztvQkFDMUIsQ0FBQztvQkFBQyxJQUFJLENBQUMsQ0FBQzt3QkFDTix3Q0FBd0M7d0JBQ3hDLFFBQVEsRUFBRSxDQUFDO29CQUNiLENBQUM7Z0JBQ0gsQ0FBQztnQkFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUNYLG9EQUFvRDtvQkFDcEQsUUFBUSxFQUFFLENBQUM7Z0JBQ2IsQ0FBQztZQUNILENBQUM7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQTVDRCwwQ0E0Q0MiLCJzb3VyY2VzQ29udGVudCI6WyIvLyB0c2xpbnQ6ZGlzYWJsZVxuLy8gVE9ETzogY2xlYW51cCB0aGlzIGZpbGUsIGl0J3MgY29waWVkIGFzIGlzIGZyb20gQW5ndWxhciBDTEkuXG5cbmltcG9ydCB7IFdlYnBhY2tDb25maWdPcHRpb25zIH0gZnJvbSAnLi4vYnVpbGQtb3B0aW9ucyc7XG5cbi8qKlxuICogUmV0dXJucyBhIHBhcnRpYWwgc3BlY2lmaWMgdG8gY3JlYXRpbmcgYSBidW5kbGUgZm9yIG5vZGVcbiAqIEBwYXJhbSB3Y28gT3B0aW9ucyB3aGljaCBhcmUgaW5jbHVkZSB0aGUgYnVpbGQgb3B0aW9ucyBhbmQgYXBwIGNvbmZpZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2VydmVyQ29uZmlnKHdjbzogV2VicGFja0NvbmZpZ09wdGlvbnMpIHtcblxuICBjb25zdCBjb25maWc6IGFueSA9IHtcbiAgICByZXNvbHZlOiB7XG4gICAgICBtYWluRmllbGRzOiBbXG4gICAgICAgIC4uLih3Y28uc3VwcG9ydEVTMjAxNSA/IFsnZXMyMDE1J10gOiBbXSksXG4gICAgICAgICdtYWluJywgJ21vZHVsZScsXG4gICAgICBdLFxuICAgIH0sXG4gICAgdGFyZ2V0OiAnbm9kZScsXG4gICAgb3V0cHV0OiB7XG4gICAgICBsaWJyYXJ5VGFyZ2V0OiAnY29tbW9uanMnXG4gICAgfSxcbiAgICBub2RlOiBmYWxzZSxcbiAgfTtcblxuICBpZiAod2NvLmJ1aWxkT3B0aW9ucy5idW5kbGVEZXBlbmRlbmNpZXMgPT0gJ25vbmUnKSB7XG4gICAgY29uZmlnLmV4dGVybmFscyA9IFtcbiAgICAgIC9eQGFuZ3VsYXIvLFxuICAgICAgKF86IGFueSwgcmVxdWVzdDogYW55LCBjYWxsYmFjazogKGVycm9yPzogYW55LCByZXN1bHQ/OiBhbnkpID0+IHZvaWQpID0+IHtcbiAgICAgICAgLy8gQWJzb2x1dGUgJiBSZWxhdGl2ZSBwYXRocyBhcmUgbm90IGV4dGVybmFsc1xuICAgICAgICBpZiAocmVxdWVzdC5tYXRjaCgvXlxcLnswLDJ9XFwvLykpIHtcbiAgICAgICAgICByZXR1cm4gY2FsbGJhY2soKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gQXR0ZW1wdCB0byByZXNvbHZlIHRoZSBtb2R1bGUgdmlhIE5vZGVcbiAgICAgICAgICBjb25zdCBlID0gcmVxdWlyZS5yZXNvbHZlKHJlcXVlc3QpO1xuICAgICAgICAgIGlmICgvbm9kZV9tb2R1bGVzLy50ZXN0KGUpKSB7XG4gICAgICAgICAgICAvLyBJdCdzIGEgbm9kZV9tb2R1bGVcbiAgICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlcXVlc3QpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBJdCdzIGEgc3lzdGVtIHRoaW5nICguaWUgdXRpbCwgZnMuLi4pXG4gICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIC8vIE5vZGUgY291bGRuJ3QgZmluZCBpdCwgc28gaXQgbXVzdCBiZSB1c2VyLWFsaWFzZWRcbiAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgXTtcbiAgfVxuXG4gIHJldHVybiBjb25maWc7XG59XG4iXX0=