import * as webpack from 'webpack';
import { WebpackConfigOptions } from '../build-options';
export declare function getStylesConfig(wco: WebpackConfigOptions): {
    loader: {
        stylus: {};
    };
    entry: {
        [key: string]: string[];
    };
    module: {
        rules: webpack.Rule[];
    };
    plugins: never[];
};
