export declare class KarmaWebpackFailureCb {
    private callback;
    constructor(callback: () => void);
    apply(compiler: any): void;
}
