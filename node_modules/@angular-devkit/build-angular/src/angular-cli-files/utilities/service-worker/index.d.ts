import { Path, virtualFs } from '@angular-devkit/core';
export declare const NEW_SW_VERSION = "5.0.0-rc.0";
export declare function usesServiceWorker(projectRoot: string): boolean;
export declare function augmentAppWithServiceWorker(host: virtualFs.Host, projectRoot: Path, appRoot: Path, outputPath: Path, baseHref: string, ngswConfigPath?: string): Promise<void>;
