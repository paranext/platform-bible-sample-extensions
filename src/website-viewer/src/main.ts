import papi, { logger } from '@papi/backend';
import {
  ExecutionActivationContext,
  ExecutionToken,
  GetWebViewOptions,
  IWebViewProvider,
  SavedWebViewDefinition,
  ScrollGroupScrRef,
  WebViewDefinition,
} from '@papi/core';
import { SerializedVerseRef } from '@sillsdev/scripture';
import type { CommandHandlers } from 'papi-shared-types';
import { compareScrRefs } from 'platform-bible-utils';
import { getWebViewTitle } from './utils';
import {
  DEFAULT_WEBSITE_VIEWER_OPTIONS as DEFAULT_OPTIONS,
  getWebsiteOptions,
  RefChange,
  WebsiteViewerOptions,
} from './websiteViewerOptions';

interface BasicWebsiteViewerOptions extends GetWebViewOptions {
  openWebsiteCommand: keyof CommandHandlers;
}

interface ScrollGroupInfo {
  scrollGroupScrRef: ScrollGroupScrRef | undefined;
  scrRef: SerializedVerseRef;
}

const WEBSITE_VIEWER_WEBVIEW_TYPE = 'website-viewer.webView';
const USER_DATA_KEY = 'webViewTypeById_';
const SCR_REF_TO_TRIGGER_UPDATE: SerializedVerseRef = {
  book: '',
  chapterNum: -1,
  verseNum: -1,
};
let executionToken: ExecutionToken;
let interfaceLanguage: string[];

let websiteOptions: Map<keyof CommandHandlers, WebsiteViewerOptions>;
const commandByWebViewId = new Map<string, keyof CommandHandlers>();
const scrollGroupInfoByWebViewId = new Map<string, ScrollGroupInfo>();

/** Function to open a Website Viewer. Registered as a command handler. */
async function openWebsiteViewerByType({
  openWebsiteCommand,
}: BasicWebsiteViewerOptions): Promise<string | undefined> {
  logger.info(`website-viewer: retrieved command to open a Website`);
  const webViewOptions = {
    openWebsiteCommand,
    // use existing id to open only 1 instance of a web view type.
    // reverse lookup of the web view id in the map. This should be undefined or a unique id.
    existingId: Array.from(commandByWebViewId.entries()).find(
      ([, command]) => command === openWebsiteCommand,
    )?.[0],
  };

  return papi.webViews.openWebView(WEBSITE_VIEWER_WEBVIEW_TYPE, undefined, webViewOptions);
}

/** Function to reopen a Website Viewer of the stored type by web view id */
function reopenWebsiteViewerByExistingId(existingWebViewId: string) {
  // get webView by existingId (without the possibility to pass WebsiteViewer specific options)
  return papi.webViews.openWebView(WEBSITE_VIEWER_WEBVIEW_TYPE, undefined, {
    existingId: existingWebViewId,
  });
}

/** Simple web view provider that provides Website Viewer web views when papi requests them */
const websiteViewerWebViewProvider: IWebViewProvider = {
  async getWebView(
    savedWebView: SavedWebViewDefinition,
    basicOptions: BasicWebsiteViewerOptions,
  ): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== WEBSITE_VIEWER_WEBVIEW_TYPE) {
      throw new Error(
        `${WEBSITE_VIEWER_WEBVIEW_TYPE} provider received request to provide a ${savedWebView.webViewType} web view`,
      );
    }

    // get current scripture reference for granular change detection
    const currentScriptureReference: SerializedVerseRef = await getCurrentScriptureReference(
      savedWebView.scrollGroupScrRef,
    );
    // store current scrollGroupScrRef for later comparison if it changed
    scrollGroupInfoByWebViewId.set(savedWebView.id, {
      scrollGroupScrRef: savedWebView.scrollGroupScrRef,
      scrRef: currentScriptureReference,
    });

    const userDataKey = `${USER_DATA_KEY}${savedWebView.id}`;
    if (basicOptions.openWebsiteCommand) {
      // store command by web view id to be able get options only based on the web view id
      commandByWebViewId.set(savedWebView.id, basicOptions.openWebsiteCommand);
      // persist to user data to survive app restart
      papi.storage.writeUserData(executionToken, userDataKey, basicOptions.openWebsiteCommand);
    }
    const command =
      basicOptions.openWebsiteCommand ??
      commandByWebViewId.get(savedWebView.id) ?? // read from in-memory map when not called via a command
      (await papi.storage.readUserData(executionToken, userDataKey)); // read from persisted user data after app restart
    if (!commandByWebViewId.get(savedWebView.id)) {
      // repopulate in-memory map after reading from persisted user data to enable scripture reference change watching
      commandByWebViewId.set(savedWebView.id, command);
    }

    const options: WebsiteViewerOptions = websiteOptions.get(command) || DEFAULT_OPTIONS;

    const url = options.getUrl(currentScriptureReference, interfaceLanguage);
    logger.log(`website-viewer is opening url ${url}, options: ${JSON.stringify(options)}`);

    const titleFormatString = await papi.localization.getLocalizedString({
      localizeKey: '%websiteViewer_title_format%',
    });

    return {
      ...savedWebView,
      content: url,
      contentType: 'url',
      title: getWebViewTitle(titleFormatString, options.websiteName),
      allowScripts: true,
      allowPopups: true,
      shouldShowToolbar: options.watchRefChange !== RefChange.DoNotWatch,
    };
  },
};

/**
 * ScrollGroupScrRef can hold a scroll group or a scripture reference. Either get the scripture
 * reference from the scroll group, or just return the scripture reference.
 */
async function getCurrentScriptureReference(
  scrollGroupRef: ScrollGroupScrRef | undefined,
): Promise<SerializedVerseRef> {
  if (!scrollGroupRef || typeof scrollGroupRef === 'number')
    return papi.scrollGroups.getScrRef(scrollGroupRef);

  return Promise.resolve(scrollGroupRef);
}

function registerOpenWebsiteCommandHandlers() {
  websiteOptions = getWebsiteOptions();

  return Array.from(websiteOptions.entries()).map(([command, options]) => {
    return papi.commands.registerCommand(command, () =>
      openWebsiteViewerByType({ ...options, openWebsiteCommand: command }),
    );
  });
}

function shouldUpdateOnScriptureRefChange(
  commandKey: keyof CommandHandlers,
  oldRef: SerializedVerseRef,
  newRef: SerializedVerseRef,
) {
  const watchRefChange = websiteOptions.get(commandKey)?.watchRefChange;

  if (!watchRefChange) return false;

  const bookChanged: boolean = newRef.book !== oldRef.book;
  const chapterChanged: boolean = newRef.chapterNum !== oldRef.chapterNum;
  const verseChanged: boolean = newRef.verseNum !== oldRef.verseNum;

  switch (watchRefChange) {
    case RefChange.WatchBookChange:
      return bookChanged;
    case RefChange.WatchChapterChange:
      return chapterChanged || bookChanged;
    case RefChange.WatchVerseChange:
      return chapterChanged || bookChanged || verseChanged;
    default:
      return false;
  }
}

function isScrRef(scrollRef: ScrollGroupScrRef | undefined) {
  return typeof scrollRef === 'object';
}

function hasScrollGroupChanged(
  oldRef: ScrollGroupScrRef | undefined,
  newRef: ScrollGroupScrRef | undefined,
): boolean {
  // not sure if/when this will actually happen...
  if (oldRef === undefined && newRef === undefined) return false;
  // scroll group change
  if (typeof oldRef === 'number' && typeof newRef === 'number') return oldRef !== newRef;
  // both no scroll group, need to detect object difference
  if (isScrRef(oldRef) && isScrRef(newRef)) return compareScrRefs(oldRef, newRef) !== 0;

  // mixed types, means a change
  return true;
}

async function getInterfaceLanguage(): Promise<string[]> {
  return papi.settings.get('platform.interfaceLanguage');
}

function getUrlForWebView(webViewId: string): string {
  const command = commandByWebViewId.get(webViewId);
  if (!command) return ''; // this should not happen;
  const options: WebsiteViewerOptions = websiteOptions.get(command) || DEFAULT_OPTIONS;
  const currentScrollGroupInfo = scrollGroupInfoByWebViewId.get(webViewId);
  const currentScriptureReference = currentScrollGroupInfo
    ? currentScrollGroupInfo.scrRef
    : SCR_REF_TO_TRIGGER_UPDATE; // this should not happen
  if (!currentScrollGroupInfo) {
    logger.warn('website-viewer: scroll group could not be found, copied url might be unexpected');
  }
  return options.getUrl(currentScriptureReference, interfaceLanguage);
}

export async function activate(context: ExecutionActivationContext): Promise<void> {
  logger.info('website-viewer is activating!');

  executionToken = context.executionToken;
  // note that like this it won't update until platform is restarted
  interfaceLanguage = await getInterfaceLanguage();

  // When the scripture reference changes, re-render the last web view of type "websiteViewerWebViewType"
  // This is not fired in case of "no scroll group", this is handled inside the scroll group change code
  const scrollGroupUpdateUnsubscriber = papi.scrollGroups.onDidUpdateScrRef(
    (scrollGroupUpdateInfo) => {
      logger.debug(
        `website-viewer: ScriptureRef changed for scrollGroup ${scrollGroupUpdateInfo.scrollGroupId}: ${commandByWebViewId.size} Website Viewer web views in memory`,
      );
      const updateWebViewPromises = Array.from(commandByWebViewId.entries())
        // filter web views of a type that is listening for ref changes
        .filter(([webViewId, commandKey]) =>
          shouldUpdateOnScriptureRefChange(
            commandKey,
            scrollGroupInfoByWebViewId.get(webViewId)?.scrRef || SCR_REF_TO_TRIGGER_UPDATE,
            scrollGroupUpdateInfo.scrRef,
          ),
        )
        .map(([webViewId]) => {
          logger.debug(
            `website-viewer: Updating web view with id: ${webViewId}, command: ${commandByWebViewId.get(webViewId)}`,
          );
          return reopenWebsiteViewerByExistingId(webViewId);
        });

      return Promise.all(updateWebViewPromises);
    },
  );

  // listen to scroll group changes for Website Viewer web views
  const webViewUpdateUnsubscriber = papi.webViews.onDidUpdateWebView((updateWebViewEvent) => {
    const webViewId = updateWebViewEvent.webView.id;
    if (!commandByWebViewId.has(webViewId)) return;

    const command = commandByWebViewId.get(webViewId);
    if (!command) return; // this should not happen
    const options: WebsiteViewerOptions = websiteOptions.get(command) || DEFAULT_OPTIONS;

    if (options.watchRefChange === RefChange.DoNotWatch) return;

    const oldScrollGroupInfo = scrollGroupInfoByWebViewId.get(webViewId);
    const newScrollRef = updateWebViewEvent.webView.scrollGroupScrRef;
    const refChanged = hasScrollGroupChanged(oldScrollGroupInfo?.scrollGroupScrRef, newScrollRef);
    const shouldUpdate =
      !isScrRef(newScrollRef) ||
      // check granular updates for "no scroll group"
      shouldUpdateOnScriptureRefChange(
        command,
        oldScrollGroupInfo?.scrRef || SCR_REF_TO_TRIGGER_UPDATE,
        newScrollRef,
      );

    if (refChanged && shouldUpdate) {
      // rerender to get new ref from the changed scroll group
      logger.debug(
        `scrollGroupRef changed - old: ${JSON.stringify(scrollGroupInfoByWebViewId.get(updateWebViewEvent.webView.id))},
        new: ${JSON.stringify(updateWebViewEvent.webView.scrollGroupScrRef)}`,
      );
      reopenWebsiteViewerByExistingId(updateWebViewEvent.webView.id);
    }
  });

  // clean up webviews from the map, so that no unexpected empty tabs appear on changing ref after closing tabs
  const webViewCloseUnsubscriber = papi.webViews.onDidCloseWebView((closeWebViewEvent) => {
    const webViewId = closeWebViewEvent.webView.id;
    if (commandByWebViewId.has(webViewId)) {
      commandByWebViewId.delete(webViewId);
      scrollGroupInfoByWebViewId.delete(webViewId);

      const userDataKey = `${USER_DATA_KEY}${webViewId}`;
      papi.storage.deleteUserData(executionToken, userDataKey);
    }
  });

  const websiteViewerWebViewProviderPromise = papi.webViewProviders.registerWebViewProvider(
    WEBSITE_VIEWER_WEBVIEW_TYPE,
    websiteViewerWebViewProvider,
  );

  const openUrlWebViewPromise = papi.commands.registerCommand(
    'websiteViewer.openUrl',
    async (webViewId) => {
      const url = getUrlForWebView(webViewId);
      return papi.commands.sendCommand('platform.openWindow', url);
    },
  );

  const commandPromises = registerOpenWebsiteCommandHandlers();

  // Await the registration promises at the end so we don't hold everything else up
  context.registrations.add(
    scrollGroupUpdateUnsubscriber,
    webViewUpdateUnsubscriber,
    webViewCloseUnsubscriber,
    await websiteViewerWebViewProviderPromise,
    await openUrlWebViewPromise,
    ...(await Promise.all(commandPromises)),
  );

  logger.info('website-viewer is finished activating!');
}

export async function deactivate() {
  logger.info('website-viewer is deactivating!');
  return true;
}
