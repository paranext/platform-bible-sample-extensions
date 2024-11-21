import { logger } from '@papi/backend';
import { VerseRef } from '@sillsdev/scripture';
import { CommandHandlers } from 'papi-shared-types';
import { formatScrRef, ScriptureReference } from 'platform-bible-utils';

export interface WebViewerOptions {
  getUrl: (scrRef: ScriptureReference, langCode: string) => string;
  webResourceName: string;
  watchRefChange?: RefChange;
}

// satisfy typescript, although we do not expect these to appear
export const SATISFY_TS_KEY: keyof CommandHandlers = 'dummy.dummy';
export const SATISFY_TS_OPTIONS: WebViewerOptions = {
  getUrl: () => '',
  webResourceName: '',
};

export enum RefChange {
  DO_NOT_WATCH,
  WATCH_BOOK_CHANGE,
  WATCH_CHAPTER_CHANGE,
  WATCH_VERSE_CHANGE,
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

export function getResourceOptions(): Map<keyof CommandHandlers, WebViewerOptions> {
  const sandboxWebViewerOptions: WebViewerOptions = {
    getUrl: () => 'https://sykc6v-3000.csb.app/',
    webResourceName: 'CodeSandbox Settings UI mockup',
  };

  const pt9VideoOptions: WebViewerOptions = {
    getUrl: () =>
      'https://player.vimeo.com/video/472226946?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479',

    webResourceName: 'PT9 Video',
  };

  const pt9VHelpOptions: WebViewerOptions = {
    getUrl: () => 'https://paratext.org/videos/en/paratext-9/',
    webResourceName: 'PT9 Help',
  };

  const usfmDocsOptions: WebViewerOptions = {
    getUrl: () => 'https://docs.usfm.bible/usfm/3.1/index.html',
    webResourceName: 'Usfm Docs',
  };

  const availableOtnBooks = [6, 8, 17, 20, 27, 28, 33, 39, ...range(40, 46), ...range(48, 66)]; // with added books this may be outdated soon
  const otnOptions: WebViewerOptions = {
    getUrl: (scrRef: ScriptureReference) => {
      const otNtUrlParam = scrRef.bookNum < 40 ? 'The_Old_Testament' : 'The_New_Testament';
      const verseRef = new VerseRef(scrRef.bookNum, scrRef.chapterNum, scrRef.verseNum, undefined);
      const hasEnglishBookName = [40, ...range(42, 53), 56, 45, ...range(59, 61), 65];
      let bookName = hasEnglishBookName.includes(scrRef.bookNum)
        ? englishBookNameOtn(scrRef)
        : verseRef.book;
      if (verseRef.book === 'EST') bookName = 'eth'; // different key for Esther
      if (verseRef.book === '1TI') bookName = 'tim1';
      if (verseRef.book === '2TI') bookName = 'tim2';
      if (verseRef.book === 'HEB') bookName = 'hebrew';
      if (verseRef.book === '1JN') bookName = 'jn1';
      if (verseRef.book === '2JN') bookName = 'jn2';
      if (verseRef.book === '3JN') bookName = 'jn3';
      if (availableOtnBooks.includes(scrRef.bookNum))
        return `https://opentn.bible/search/?testament=${otNtUrlParam}&book=${bookName.toLowerCase()}`;

      logger.warn(
        `web-viewer: OTN: ${verseRef.book} not available in OTN, routing to the main page`,
      );
      return 'https://opentn.bible/';
    },
    webResourceName: 'SIL OTN',
    watchRefChange: RefChange.WATCH_BOOK_CHANGE,
  };

  const marbleOptions: WebViewerOptions = {
    getUrl: (scrRef: ScriptureReference) => {
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
    },
    webResourceName: 'UBS Marble',
    watchRefChange: RefChange.WATCH_CHAPTER_CHANGE,
  };

  const wiBiLexOptions: WebViewerOptions = {
    getUrl: () => 'https://www.die-bibel.de/ressourcen/wibilex',
    webResourceName: 'GBS WiBiLex',
  };

  return new Map<keyof CommandHandlers, WebViewerOptions>([
    ['webViewer.openCodeSandbox', sandboxWebViewerOptions],
    ['webViewer.openPT9Video', pt9VideoOptions],
    ['webViewer.openPT9Help', pt9VHelpOptions],
    ['webViewer.openUsfmDocs', usfmDocsOptions],
    ['webViewer.openOTN', otnOptions],
    ['webViewer.openMarble', marbleOptions],
    ['webViewer.openWiBiLex', wiBiLexOptions],
  ]);
}
