import papi, { logger } from '@papi/backend';
import {
  ExecutionActivationContext,
  ExecutionToken,
  GetWebViewOptions,
  IWebViewProvider,
  SavedWebViewDefinition,
  ScrollGroupScrRef,
  WebViewContentType,
  WebViewDefinition,
} from '@papi/core';

import { CommandHandlers } from 'papi-shared-types';
import { deepEqual, ScriptureReference } from 'platform-bible-utils';
import { ScrollGroupUpdateInfo } from 'shared/services/scroll-group.service-model';
import { CloseWebViewEvent, UpdateWebViewEvent } from 'shared/services/web-view.service-model';
import { getWebViewTitle } from './utils';
import {
  getResourceOptions,
  RefChange,
  SATISFY_TS_KEY,
  SATISFY_TS_OPTIONS,
  WebViewerOptions,
} from './webViewerOptions';

interface BasicWebViewerOptions extends GetWebViewOptions {
  openResourceCommand: keyof CommandHandlers;
}

interface ScrollGroupInfo {
  scrollGroupScrRef: ScrollGroupScrRef | undefined;
  scrRef: ScriptureReference;
}

const WEB_VIEWER_WEBVIEW_TYPE = 'webViewer.webView';
const USER_DATA_KEY = 'webViewTypeById_';
const SCR_REF_TO_TRIGGER_UPDATE = {
  bookNum: -1,
  chapterNum: -1,
  verseNum: -1,
};
let executionToken: ExecutionToken;
let userLanguageCode: string;

let resourceOptions: Map<keyof CommandHandlers, WebViewerOptions>;
const commandByWebViewId = new Map<string, keyof CommandHandlers>();
const scrollGroupInfoByWebViewId = new Map<string, ScrollGroupInfo>();

/** Function to open a Web Viewer. Registered as a command handler. */
async function openWebViewerOfType({
  openResourceCommand,
}: BasicWebViewerOptions): Promise<string | undefined> {
  logger.info(`web-viewer: retrieved command to open a web viewer`);
  const webViewOptions = {
    openResourceCommand,
    // use existing id to open only 1 instance of a web view type.
    // reverse lookup of the webview id in the map. This should be undefined or a unique id.
    existingId: Array.from(commandByWebViewId.entries()).find(
      ([, command]) => command === openResourceCommand,
    )?.[0],
  };

  return papi.webViews.openWebView(WEB_VIEWER_WEBVIEW_TYPE, undefined, webViewOptions);
}

function reOpenWebViewerFromExistingId(existingWebViewId: string) {
  // get webView by existingId (without the possibility to pass WebViewer specific options)
  return papi.webViews.openWebView(WEB_VIEWER_WEBVIEW_TYPE, undefined, {
    existingId: existingWebViewId,
  });
}

/** Simple web view provider that provides Web Viewer web views when papi requests them */
const webViewerWebViewProvider: IWebViewProvider = {
  async getWebView(
    savedWebView: SavedWebViewDefinition,
    basicOptions: BasicWebViewerOptions,
  ): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== WEB_VIEWER_WEBVIEW_TYPE) {
      throw new Error(
        `${WEB_VIEWER_WEBVIEW_TYPE} provider received request to provide a ${savedWebView.webViewType} web view`,
      );
    }

    // get current scripture reference for granular change detection
    const currentScriptureReference: ScriptureReference = await getCurrentScriptureReference(
      savedWebView.scrollGroupScrRef,
    );
    // store current scrollGroupScrRef for later comparison if it changed
    scrollGroupInfoByWebViewId.set(savedWebView.id, {
      scrollGroupScrRef: savedWebView.scrollGroupScrRef,
      scrRef: currentScriptureReference,
    });

    const userDataKey = `${USER_DATA_KEY}${savedWebView.id}`;
    if (basicOptions.openResourceCommand) {
      // store command by webview id to be able get options only based on the webview id
      commandByWebViewId.set(savedWebView.id, basicOptions.openResourceCommand);
      // persist to user data to survive app restart
      papi.storage.writeUserData(executionToken, userDataKey, basicOptions.openResourceCommand);
    }
    const command =
      basicOptions.openResourceCommand ??
      commandByWebViewId.get(savedWebView.id) ?? // read from in-memory map when not called via a command
      (await papi.storage.readUserData(executionToken, userDataKey)); // read from persisted user data after app restart
    if (!commandByWebViewId.get(savedWebView.id)) {
      // repopulate in-memory map after reading from persisted user data to enable scripture reference change watching
      commandByWebViewId.set(savedWebView.id, command);
    }

    const options: WebViewerOptions = resourceOptions.get(command) || SATISFY_TS_OPTIONS;

    const url = await options.getUrl(currentScriptureReference, userLanguageCode);
    logger.log(`web-viewer is opening url ${url}, options: ${JSON.stringify(options)}`);

    const titleFormatString = await papi.localization.getLocalizedString({
      localizeKey: '%webViewer_title_format%',
    });

    return {
      ...savedWebView,
      content: url,
      // work around for bad enum export in papi
      // eslint-disable-next-line no-type-assertion/no-type-assertion
      contentType: 'url' as WebViewContentType.URL,
      title: getWebViewTitle(titleFormatString, options.webResourceName),
      allowScripts: true,
    };
  },
};

export async function getCurrentScriptureReference(
  scrollGroupRef: ScrollGroupScrRef | undefined,
): Promise<ScriptureReference> {
  if (scrollGroupRef === undefined) return papi.scrollGroups.getScrRef();

  if (typeof scrollGroupRef === 'number') return papi.scrollGroups.getScrRef(scrollGroupRef);

  return Promise.resolve(scrollGroupRef);
}

function registerCommandHandlers() {
  resourceOptions = getResourceOptions();

  return Array.from(resourceOptions.entries()).map(([command, options]) => {
    return papi.commands.registerCommand(command, () =>
      openWebViewerOfType({ ...options, openResourceCommand: command }),
    );
  });
}

function shouldUpdateOnScriptureRefChange(
  commandKey: keyof CommandHandlers | undefined,
  oldRef: ScriptureReference,
  newRef: ScriptureReference,
) {
  const watchRefChange = resourceOptions.get(commandKey || SATISFY_TS_KEY)?.watchRefChange;

  if (!watchRefChange) return false;

  const bookChanged: boolean = newRef.bookNum !== oldRef.bookNum;
  const chapterChanged: boolean = newRef.chapterNum !== oldRef.chapterNum;
  const verseChanged: boolean = newRef.verseNum !== oldRef.verseNum;

  switch (watchRefChange) {
    case RefChange.WATCH_BOOK_CHANGE:
      return bookChanged;
    case RefChange.WATCH_CHAPTER_CHANGE:
      return chapterChanged || bookChanged;
    case RefChange.WATCH_VERSE_CHANGE:
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
  if (isScrRef(oldRef) && isScrRef(newRef)) return !deepEqual(oldRef, newRef);

  // other mixed types, means a change
  return true;
}

async function getUserLanguageCode(): Promise<string> {
  // TODO: implement
  return 'NOT_YET_IMPLEMENTED';
}

export async function activate(context: ExecutionActivationContext): Promise<void> {
  logger.info('web-viewer is activating!');

  executionToken = context.executionToken;
  userLanguageCode = await getUserLanguageCode();

  const commandPromises = registerCommandHandlers();

  // When the scripture reference changes, re-render the last webview of type "webViewerWebViewType"
  // This is not fired in case of "no scroll group", this is handled inside the scroll group change code
  papi.scrollGroups.onDidUpdateScrRef((scrollGroupUpdateInfo: ScrollGroupUpdateInfo) => {
    logger.debug(
      `web-viewer: ScriptureRef changed for scrollGroup ${scrollGroupUpdateInfo.scrollGroupId}: ${commandByWebViewId.size} web viewer webviews in memory`,
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
          `web-viewer: Updating webview with id: ${webViewId}, command: ${commandByWebViewId.get(webViewId)}`,
        );
        return reOpenWebViewerFromExistingId(webViewId);
      });

    return Promise.all(updateWebViewPromises);
  });

  // listen to scroll group changes for web viewer web views
  papi.webViews.onDidUpdateWebView((updateWebViewEvent: UpdateWebViewEvent) => {
    const webViewId = updateWebViewEvent.webView.id;
    if (!commandByWebViewId.has(webViewId)) return;

    const command = commandByWebViewId.get(webViewId) || SATISFY_TS_KEY;
    const options: WebViewerOptions = resourceOptions.get(command) || SATISFY_TS_OPTIONS;

    if (options.watchRefChange === RefChange.DO_NOT_WATCH) return;

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
      reOpenWebViewerFromExistingId(updateWebViewEvent.webView.id);
    }
  });

  // clean up webviews from the map, so that no unexpected empty tabs appear on changing ref after closing tabs
  papi.webViews.onDidCloseWebView((closeWebViewEvent: CloseWebViewEvent) => {
    if (commandByWebViewId.has(closeWebViewEvent.webView.id)) {
      commandByWebViewId.delete(closeWebViewEvent.webView.id);
      scrollGroupInfoByWebViewId.delete(closeWebViewEvent.webView.id);
    }
  });

  const webViewerWebViewProviderPromise = papi.webViewProviders.registerWebViewProvider(
    WEB_VIEWER_WEBVIEW_TYPE,
    webViewerWebViewProvider,
  );

  // Await the registration promises at the end so we don't hold everything else up
  context.registrations.add(await webViewerWebViewProviderPromise);
  Promise.all(commandPromises)
    .then((arr) => context.registrations.add(...arr))
    .catch((e) => logger.error('Error loading command promises', e));

  logger.info('web-viewer is finished activating!');
}

export async function deactivate() {
  logger.info('web-viewer is deactivating!');
  return true;
}
