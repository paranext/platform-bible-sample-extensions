declare module 'website-viewer' {}

declare module 'papi-shared-types' {
  export interface CommandHandlers {
    /**
     * Opens a new Website Viewer web view with a code sandbox mockup and returns the web view id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openCodeSandbox': () => Promise<string | undefined>;

    /**
     * Opens a new Website Viewer web view with a PT9 Video from Vimeo and returns the web view id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openPT9Video': () => Promise<string | undefined>;

    /**
     * Opens a new Website Viewer web view with the paratext.org help website and returns the web
     * view id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openPT9Help': () => Promise<string | undefined>;

    /**
     * Opens a new Website Viewer web view with the USFM Docs website and returns the web view id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openUsfmDocs': () => Promise<string | undefined>;

    /**
     * Opens a new Website Viewer web view for SIL Open Translator Notes and returns the web view id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openOTN': () => Promise<string | undefined>;

    /**
     * Opens a new Website Viewer web view for UBS Marble and returns the web view id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openMarble': () => Promise<string | undefined>;

    /**
     * Opens a new Website Viewer web view for German Bible Society WiBiLex and returns the web view
     * id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openWiBiLex': () => Promise<string | undefined>;

    /**
     * Opens a new Website Viewer web view with a YouVersion verse display and returns the web view
     * id
     *
     * @returns From return value of openWebView: Promise that resolves to the ID of the webview we
     *   got or undefined if the provider did not create a WebView for this request
     */
    'websiteViewer.openYouVersionVerse': () => Promise<string | undefined>;

    /**
     * Opens a new webview with a link to the url with which Platform opened the website. Clicking
     * that link will open the url in the default browser of the OS
     *
     * Note: this command is intended to work from the web view menu
     *
     * @param webViewId The web view id of the current web view to look up the type and get the url,
     *   provided by the web view menu
     * @returns From return value of openWebView: Promise that resolves to the id of the link web
     *   view or undefined if the provider did not create a link web view
     */
    'websiteViewer.showUrl': (webViewId: string) => Promise<string | undefined>;

    /**
     * Dummy to use in strictly typed Maps
     *
     * @returns
     */
    'dummy.dummy': () => Promise<string | undefined>;
  }
}
