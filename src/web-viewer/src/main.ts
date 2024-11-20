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
import { CommandHandlers } from 'papi-shared-types';
import { formatScrRef, ScriptureReference } from 'platform-bible-utils';
import { ScrollGroupUpdateInfo } from 'shared/services/scroll-group.service-model';
import { CloseWebViewEvent } from 'shared/services/web-view.service-model';
import { getWebViewTitle } from './utils';

const WEB_VIEWER_WEBVIEW_TYPE = 'webViewer.webView';
const USER_DATA_KEY = 'webViewTypeById_';
let executionToken: ExecutionToken;
let oldRef: ScriptureReference;

let resourceOptions: Map<keyof CommandHandlers, WebViewerOptionsForMap>;
const commandByWebViewId = new Map<string, keyof CommandHandlers>();

// satisfy typescript, although we do not expect these to appear
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
    // use existing id to open only 1 instance of a web view type.
    // reverse lookup of the webview id in the map. This should be undefined or a unique id.
    existingId: Array.from(commandByWebViewId.entries()).find(
      ([, command]) => command === openResourceCommand,
    )?.[0],
  };

  return papi.webViews.openWebView(WEB_VIEWER_WEBVIEW_TYPE, undefined, webViewOptions);
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
    const options: WebViewerOptionsForMap = resourceOptions.get(command) || SATISFY_TS_OPTIONS;

    const url = await options.getUrl();
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

function resolveUrl(url: string) {
  return () => Promise.resolve(url);
}

function range(start: number, end: number) {
  if (start > end)
    logger.warn(`web-viewer: range(${start}, ${end}) is invalid. End must be after the start.`);
  return [...Array(end + 1).keys()].filter((i) => i >= start);
}

function englishBookNameMarble(scrRef: ScriptureReference) {
  return formatScrRef(scrRef, 'English').replace(/^((\d\s)?\w+).*$/, '$1'); // e.g. 1 Corinthians
}
function englishBookNameOtn(scrRef: ScriptureReference) {
  return formatScrRef(scrRef, 'English').replace(/^((\d)\s)?(\w+).*$/, '$3$1'); // e.g. Corinthians1
}

function registerCommandHandlers() {
  const sandboxWebViewerOptions: WebViewerOptionsForMap = {
    getUrl: resolveUrl('https://sykc6v-3000.csb.app/'),
    webResourceName: 'CodeSandbox Settings UI mockup',
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
  const availableOtnBooks = [6, 8, 17, 20, 27, 28, 33, 39, ...range(40, 46), ...range(48, 66)]; // with added books this may be outdated soon
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
        const hasEnglishBookName = [40, 42, ...range(44, 53), 56, 45, ...range(58, 61), 65];
        let bookName = hasEnglishBookName.includes(scrRef.bookNum)
          ? englishBookNameOtn(scrRef)
          : verseRef.book;
        if (verseRef.book === 'EST') bookName = 'eth'; // different key for Esther

        if (availableOtnBooks.includes(scrRef.bookNum))
          return `https://opentn.bible/search/?testament=${otNtUrlParam}&book=${bookName.toLowerCase()}`;

        logger.warn(
          `web-viewer: OTN: ${verseRef.book} not available in OTN, routing to the main page`,
        );
        return 'https://opentn.bible/';
      }),
    webResourceName: 'SIL OTN',
    watchRefChange: RefChange.WATCH_BOOK_CHANGE,
  };
  const marbleOptions: WebViewerOptionsForMap = {
    getUrl: () =>
      papi.scrollGroups.getScrRef().then((scrRef: ScriptureReference) => {
        let bookName = englishBookNameMarble(scrRef);
        const otherBookNames: Record<number, string> = {
          22: 'Song of Solomon',
          40: 'Matt',
          45: 'Rom',
          46: '1 Cor',
          47: '2 Cor',
          48: 'Gal',
          49: 'Eph',
          50: 'Phil',
          51: 'Col',
          52: '1 Thess',
          53: '2 Thess',
          54: '1 Tim',
          55: '2 Tim',
          57: 'Phlm',
          58: 'Heb',
          60: '1 Pet',
          61: '2 Pet',
          66: 'Rev',
        };
        bookName = otherBookNames[scrRef.bookNum] ?? bookName;
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
    ['webViewer.openCodeSandbox', sandboxWebViewerOptions],
    ['webViewer.openPT9Video', pt9VideoOptions],
    ['webViewer.openPT9Help', pt9VHelpOptions],
    ['webViewer.openUsfmDocs', usfmDocsOptions],
    ['webViewer.openOTN', otnOptions],
    ['webViewer.openMarble', marbleOptions],
    ['webViewer.openWiBiLex', wiBiLexOptions],
  ]);

  return Array.from(resourceOptions.entries()).map(([command, options]) => {
    return papi.commands.registerCommand(command, () =>
      openWebViewer({ ...options, openResourceCommand: command }),
    );
  });
}

export async function activate(context: ExecutionActivationContext): Promise<void> {
  logger.info('web-viewer is activating!');

  executionToken = context.executionToken;

  const commandPromises = registerCommandHandlers();

  // When the scripture reference changes, re-render the last webview of type "webViewerWebViewType"
  papi.scrollGroups.onDidUpdateScrRef((scrollGroupUpdateInfo: ScrollGroupUpdateInfo) => {
    logger.debug(
      `web-viewer: Scrollgroup update: ${scrollGroupUpdateInfo.scrRef.bookNum}, ${commandByWebViewId.size} web viewer webviews in memory`,
    );
    const updateWebViewPromises = Array.from(commandByWebViewId.entries())
      // filter web views of a type that is listening for ref changes
      .filter(([, commandKey]) => shouldUpdateOnRefChange(commandKey, scrollGroupUpdateInfo.scrRef))
      .map(([id]) => {
        logger.debug(
          `web-viewer: Updating webview with id: ${id}, command: ${commandByWebViewId.get(id)}`,
        );
        return papi.webViews.openWebView(
          WEB_VIEWER_WEBVIEW_TYPE,
          undefined,
          { existingId: id }, // get webView by existingId (without the possibility to pass additional options)
        );
      });

    oldRef = scrollGroupUpdateInfo.scrRef;

    return Promise.all(updateWebViewPromises);
  });

  // clean up webviews from the map, so that no unexpected empty tabs appear on changing ref after closing tabs
  papi.webViews.onDidCloseWebView((closeWebViewEvent: CloseWebViewEvent) => {
    if (commandByWebViewId.has(closeWebViewEvent.webView.id)) {
      commandByWebViewId.delete(closeWebViewEvent.webView.id);
    }
  });

  // initialize scripture reference for granular change detection
  await papi.scrollGroups
    .getScrRef()
    // eslint-disable-next-line no-return-assign
    .then((ref) => (oldRef = ref))
    .catch((e) => logger.warn('web-viewer: Could not set initial ref', e));

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
