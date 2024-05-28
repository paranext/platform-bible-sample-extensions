import papi, { logger } from '@papi/backend';
import {
  ExecutionActivationContext,
  GetWebViewOptions,
  IWebViewProvider,
  SavedWebViewDefinition,
  WebViewDefinition,
} from '@papi/core';
import verseRefWebView from './verse-ref.web-view?inline';
import { getWebViewTitle } from './utils';

const verseRefWebViewType = 'verseRefView.webView';

interface VerseRefViewOptions extends GetWebViewOptions {
  projectId: string | undefined;
}

/**
 * Function to prompt for a project and open it in the verse ref view. Registered as a command
 * handler.
 */
async function openVerseRefView(projectId: string | undefined): Promise<string | undefined> {
  let projectIdForWebView = projectId;
  if (!projectIdForWebView) {
    projectIdForWebView = await papi.dialogs.selectProject({
      title: 'Select Project to open with Verse Ref View',
      prompt: 'Choose the project to open with Verse Ref View:',
      includeProjectTypes: '^ParatextStandard$',
    });
  }
  if (projectIdForWebView) {
    const options: VerseRefViewOptions = { projectId: projectIdForWebView };
    return papi.webViews.getWebView(verseRefWebViewType, undefined, options);
  }
  return undefined;
}

/** Simple web view provider that provides verse ref web views when papi requests them */
const verseRefWebViewProvider: IWebViewProvider = {
  async getWebView(
    savedWebView: SavedWebViewDefinition,
    getWebViewOptions: VerseRefViewOptions,
  ): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== verseRefWebViewType)
      throw new Error(
        `${verseRefWebViewType} provider received request to provide a ${savedWebView.webViewType} web view`,
      );

    // We know that the projectId (if present in the state) will be a string.
    const projectId = getWebViewOptions.projectId || savedWebView.projectId || undefined;
    const projectsMetadata = projectId
      ? await papi.projectLookup.getMetadataForProject(projectId)
      : undefined;
    return {
      title: getWebViewTitle(projectsMetadata?.name),
      ...savedWebView,
      content: verseRefWebView,
      projectId,
    };
  },
};

export async function activate(context: ExecutionActivationContext): Promise<void> {
  logger.info('verse-ref-view is activating!');

  const openVerseRefViewPromise = papi.commands.registerCommand(
    'verseRefView.open',
    openVerseRefView,
  );

  const verseRefWebViewProviderPromise = papi.webViewProviders.register(
    verseRefWebViewType,
    verseRefWebViewProvider,
  );

  // Await the registration promises at the end so we don't hold everything else up
  context.registrations.add(await verseRefWebViewProviderPromise, await openVerseRefViewPromise);

  logger.info('verse-ref-view is finished activating!');
}

export async function deactivate() {
  logger.info('verse-ref-view is deactivating!');
  return true;
}
