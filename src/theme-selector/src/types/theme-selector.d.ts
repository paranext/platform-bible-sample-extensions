declare module 'theme-selector' {}

declare module 'papi-shared-types' {
  export interface CommandHandlers {
    /**
     * Opens a new Theme Selector WebView and returns the Web View id
     *
     * @param projectId Optional project ID of the project to open. Prompts the user to select a
     *   project if not provided
     * @returns WebView id for new Theme Selector WebView or `undefined` if the user canceled the
     *   dialog
     */
    'themeSelector.open': () => Promise<string | undefined>;
  }
}
