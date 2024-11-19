import papi, { logger } from '@papi/backend';
import {
  ExecutionActivationContext,
  ExecutionToken,
  GetWebViewOptions,
  IWebViewProvider,
  SavedWebViewDefinition,
  WebViewContentType,
  WebViewDefinition,
} from '@papi/core';

import { VerseRef } from '@sillsdev/scripture';
import { formatScrRef, ScriptureReference } from 'platform-bible-utils';
import { getWebViewTitle } from './utils';
import { ScrollGroupUpdateInfo } from 'shared/services/scroll-group.service-model';
import { CommandHandlers } from 'papi-shared-types';
import { log } from 'console';
import { UpdateWebViewEvent } from 'shared/services/web-view.service-model';

const WEB_VIEWER_WEBVIEW_TYPE = 'webViewer.webView';
const USER_SETTING_KEY = 'webViewIds';
let executionToken: ExecutionToken;
let oldRef: ScriptureReference;

let resourceOptions: Map<keyof CommandHandlers, WebViewerOptionsForMap>;
const commandByWebViewId = new Map<string, keyof CommandHandlers>();

const SATISFY_TS_KEY: keyof CommandHandlers = 'dummy.dummy';
const SATISFY_TS_OPTIONS: WebViewerOptionsForMap = {
  getUrl: resolveUrl(''),
  webResourceName: '',
};

enum RefChange {
  DO_NOT_WATCH,
  WATCH_BOOK_CHANGE,
  WATCH_CHAPTER_CHANGE,
  WATCH_VERSE_CHANGE,
}

interface WebViewerOptionsForMap {
  getUrl: () => Promise<string>;
  webResourceName: string;
  watchRefChange?: RefChange;
}

interface BasicWebViewerOptions extends GetWebViewOptions {
  openResourceCommand: keyof CommandHandlers;
}

/** Function to open a Web Viewer. Registered as a command handler. */
async function openWebViewer({
  openResourceCommand,
}: BasicWebViewerOptions): Promise<string | undefined> {
  logger.info(`web-viewer: retrieved command to open a web viewer`);
  const webViewOptions = {
    openResourceCommand,
    // use existing id to open only 1 instance of a resource type.
    // reverse lookup in the map, that should be unique as well
    existingId: Array.from(commandByWebViewId.entries()).find(
      ([, command]) => command === openResourceCommand,
    )?.[0],
  };

  return papi.webViews.getWebView(WEB_VIEWER_WEBVIEW_TYPE, undefined, webViewOptions);
}

/** Simple web view provider that provides Web Viewer views when papi requests them */
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

    if (basicOptions.openResourceCommand) {
      commandByWebViewId.set(savedWebView.id, basicOptions.openResourceCommand);
      logger.warn(`basicOptions.openResourceCommand ${basicOptions.openResourceCommand}`);
    }
    const command = basicOptions.openResourceCommand ?? commandByWebViewId.get(savedWebView.id);
    logger.warn(`command ${command}`);
    const options: WebViewerOptionsForMap = resourceOptions.get(command) || SATISFY_TS_OPTIONS;
    logger.warn(`options ${JSON.stringify(options)}`);

    /*     const key = `${USER_SETTING_KEY}+${getWebViewOptions.webResourceName}`;
    const value = {...getWebViewOptions, existingId: savedWebView.id};
    if (getWebViewOptions) {
      papi.storage.writeUserData(executionToken, key, JSON.stringify(value))
    } else {
      await papi.storage.readUserData(executionToken, key).then((value: string) => {
        webViewIds.set()
        getWebViewOptions = JSON.parse(value);
      });
    } */

    const url = await options.getUrl();

    const titleFormatString = await papi.localization.getLocalizedString({
      localizeKey: '%webViewer_title_format%',
    });

    logger.error(`web-viewer is opening url ${url}, options: ${JSON.stringify(options)}`);

    return {
      ...savedWebView,
      // TODO: When using the WebviewService (e.g. on startup) the options are not passed and so no url is undefined
      content: url,
      // work around for bad enum export in papi
      // eslint-disable-next-line no-type-assertion/no-type-assertion
      contentType: 'url' as WebViewContentType.URL,
      title: getWebViewTitle(titleFormatString, options.webResourceName),
      allowScripts: true,
    };
  },
};

function shouldUpdateOnRefChange(
  commandKey: keyof CommandHandlers | undefined,
  ref: ScriptureReference,
) {
  const watchRefChange = resourceOptions.get(commandKey || SATISFY_TS_KEY)?.watchRefChange;

  if (!watchRefChange) return false;

  const bookChanged: boolean = ref.bookNum !== oldRef.bookNum;
  const chapterChanged: boolean = ref.chapterNum !== oldRef.chapterNum;
  const verseChanged: boolean = ref.verseNum !== oldRef.verseNum;

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

function range(start: number, end: number) {
  return [...Array(start).keys()].filter((i) => i >= end);
}

function resolveUrl(url: string) {
  return () => Promise.resolve(url);
}

export async function activate(context: ExecutionActivationContext): Promise<void> {
  logger.info('web-viewer is activating!');

  //executionToken = context.executionToken;

  const sandboxWebViewerOptions: WebViewerOptionsForMap = {
    getUrl: resolveUrl('https://sykc6v-3000.csb.app/'),
    webResourceName: 'codesandbox Settings UI mockup',
  };
  const pt9VideoOptions: WebViewerOptionsForMap = {
    getUrl: resolveUrl(
      'https://player.vimeo.com/video/472226946?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479',
    ),
    webResourceName: 'PT9 Video',
  };
  const pt9VHelpOptions: WebViewerOptionsForMap = {
    getUrl: resolveUrl('https://paratext.org/videos/en/paratext-9/'),
    webResourceName: 'PT9 Help',
  };
  const usfmDocsOptions: WebViewerOptionsForMap = {
    getUrl: resolveUrl('https://docs.usfm.bible/usfm/3.1/index.html'),
    webResourceName: 'Usfm Docs',
  };
  const availableOtnBooks = [8, 17, 20, 27, 28, 33, 39, 41, 43, ...range(45, 57), ...range(59, 66)];
  const otnOptions: WebViewerOptionsForMap = {
    getUrl: () =>
      papi.scrollGroups.getScrRef().then((scrRef: ScriptureReference) => {
        const otNtUrlParam = scrRef.bookNum < 40 ? 'The_Old_Testament' : 'The_New_Testament';
        const verseRef = new VerseRef(
          scrRef.bookNum,
          scrRef.chapterNum,
          scrRef.verseNum,
          undefined,
        );
        let bookName = verseRef.book.toLowerCase();
        if (bookName === 'est') bookName = 'eth'; // different key for Esther
        return availableOtnBooks.includes(scrRef.bookNum)
          ? `https://opentn.bible/search/?testament=${otNtUrlParam}&book=${bookName}`
          : 'https://opentn.bible/';
      }),
    webResourceName: 'SIL OTN',
    watchRefChange: RefChange.WATCH_CHAPTER_CHANGE,
  };
  const marbleOptions: WebViewerOptionsForMap = {
    getUrl: () =>
      papi.scrollGroups.getScrRef().then((scrRef: ScriptureReference) => {
        let bookName = formatScrRef(scrRef, 'English').replace(/^((\d\s)?\w+).*$/, '$1');
        if (scrRef.bookNum === 22) bookName = 'Song of Solomon'; // differently named here
        return `https://marble.bible/text?book=${bookName}&chapter=${scrRef.chapterNum}&verse=${scrRef.verseNum}`;
      }),
    webResourceName: 'UBS Marble',
    watchRefChange: RefChange.WATCH_CHAPTER_CHANGE,
  };
  const wiBiLexOptions: WebViewerOptionsForMap = {
    getUrl: resolveUrl('https://www.die-bibel.de/ressourcen/wibilex'),
    webResourceName: 'GBS WiBiLex',
  };

  resourceOptions = new Map<keyof CommandHandlers, WebViewerOptionsForMap>([
    ['webViewer.opencodesandbox', sandboxWebViewerOptions], // TODO SL: remove, this is for testing purpose
    ['webViewer.openPT9Video', pt9VideoOptions],
    ['webViewer.openPT9Help', pt9VHelpOptions],
    ['webViewer.openUsfmDocs', usfmDocsOptions],
    ['webViewer.openOTN', otnOptions],
    ['webViewer.openMarble', marbleOptions],
    ['webViewer.openWiBiLex', wiBiLexOptions],
  ]);

  const commandPromises = Array.from(resourceOptions.entries()).map(([command, options]) => {
    return papi.commands.registerCommand(command, () =>
      openWebViewer({ ...options, openResourceCommand: command }),
    );
  });

  // When the scripture reference changes, re-render the last webview of type "webViewerWebViewType"
  // TODO: this would re-open closed webviews on every ref change!
  papi.scrollGroups.onDidUpdateScrRef((scrollGroupUpdateInfo: ScrollGroupUpdateInfo) => {
    const updateWebViewPromises = Array.from(commandByWebViewId.entries())
      // filter web views of a type that is listening for ref changes
      .filter(([, commandKey]) => shouldUpdateOnRefChange(commandKey, scrollGroupUpdateInfo.scrRef))
      .map(([id]) =>
        papi.webViews.getWebView(
          WEB_VIEWER_WEBVIEW_TYPE,
          undefined,
          { existingId: id }, // get webView by existingId (without the possibility to pass additional options)
        ),
      );

    oldRef = scrollGroupUpdateInfo.scrRef;

    return Promise.all(updateWebViewPromises);
  });

  // initialize scripture reference for granular change detection
  await papi.scrollGroups
    .getScrRef()
    // eslint-disable-next-line no-return-assign
    .then((ref) => (oldRef = ref))
    .catch((e) => logger.warn('Could not set initial ref', e));

  const webViewerWebViewProviderPromise = papi.webViewProviders.register(
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
