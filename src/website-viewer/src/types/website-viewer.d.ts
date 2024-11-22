declare module 'website-viewer' {}

declare module 'papi-shared-types' {
  export interface CommandHandlers {
    /**
     * V0
     *
     * @returns WebView id for new WebView or `undefined` if the user canceled the dialog
     */
    'websiteViewer.openCodeSandbox': () => Promise<string | undefined>;

    /**
     * Opens a new Web Viewer Web View with a PT9 Video from Vimeo and returns the Web View id
     *
     * @returns WebView id for new WebView or `undefined` if the user canceled the dialog
     */
    'websiteViewer.openPT9Video': () => Promise<string | undefined>;

    /**
     * Opens a new Web Viewer Web View with the paratext.org Help website and returns the Web View
     * id
     *
     * @returns WebView id for new WebView or `undefined` if the user canceled the dialog
     */
    'websiteViewer.openPT9Help': () => Promise<string | undefined>;

    /**
     * Opens a new Web Viewer Web View with the USFM Docs website and returns the Web View id
     *
     * @returns WebView id for new WebView or `undefined` if the user canceled the dialog
     */
    'websiteViewer.openUsfmDocs': () => Promise<string | undefined>;

    /**
     * Opens a new Web Viewer Web View for SIL Open Translator Notes and returns the Web View id
     *
     * @returns WebView id for new WebView or `undefined` if the user canceled the dialog
     */
    'websiteViewer.openOTN': () => Promise<string | undefined>;

    /**
     * Opens a new Web Viewer Web View for UBS Marble and returns the Web View id
     *
     * @returns WebView id for new WebView or `undefined` if the user canceled the dialog
     */
    'websiteViewer.openMarble': () => Promise<string | undefined>;

    /**
     * Opens a new Web Viewer Web View for German Bible Society WiBiLex and returns the Web View id
     *
     * @returns WebView id for new WebView or `undefined` if the user canceled the dialog
     */
    'websiteViewer.openWiBiLex': () => Promise<string | undefined>;

    /**
     * Dummy to use in strictly typed Maps
     *
     * @returns
     */
    'dummy.dummy': () => Promise<string | undefined>;
  }
}
