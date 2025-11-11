interface VSCodeApi {
    postMessage(message: any): void;
    setState(state: any): void;
    getState(): any;
}

declare function acquireVsCodeApi(): VSCodeApi;

interface Window {
    acquireVsCodeApi(): VSCodeApi;
}