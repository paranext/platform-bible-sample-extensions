declare module 'verse-ref-view' {}

declare module 'papi-shared-types' {
  export interface CommandHandlers {
    /**
     * Opens a new Verse Ref Web View and returns the Web View id
     *
     * @param projectId Optional project ID of the project to open. Prompts the user to select a
     *   project if not provided
     * @returns WebView id for new Verse ref WebView or `undefined` if the user canceled the dialog
     */
    'verseRefView.open': (projectId: string | undefined) => Promise<string | undefined>;
  }
}
