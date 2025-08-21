import { logger } from '@papi/backend';
import { Canon, SerializedVerseRef } from '@sillsdev/scripture';
import type { CommandHandlers } from 'papi-shared-types';
import { formatScrRef } from 'platform-bible-utils';

export enum RefChange {
  DoNotWatch,
  WatchBookChange,
  WatchChapterChange,
  WatchVerseChange,
}
export interface WebsiteViewerOptions {
  getUrl: (scrRef: SerializedVerseRef, interfaceLanguage: string[]) => string;
  // TODO: could be improved by passing in another parameter with the selected text of the active tab
  // (e.g. for a lexicon or Marble to scroll to / highlight a word)
  // for demo purpose this text could for now come from a setting, where users can copy it into
  // alternatively an input on the main toolbar - if extensions can do a thing like adding controls to the main toolbar
  websiteName: string;
  watchRefChange: RefChange;
}

// satisfy typescript, although we do not expect these to appear
export const DEFAULT_WEBSITE_VIEWER_OPTIONS: WebsiteViewerOptions = {
  getUrl: () => '',
  websiteName: '',
  watchRefChange: RefChange.DoNotWatch,
};

/**
 * Creates a list of integers starting from the _start_ number up to the _end_ number
 *
 * @param start The first number
 * @param end The last number
 * @returns An array of numbers
 */
function createRange(start: number, end: number) {
  if (start > end)
    logger.warn(`website-viewer: range(${start}, ${end}) is invalid. End must be after the start.`);
  return [...Array(end + 1).keys()].filter((i) => i >= start);
}

function getEnglishBookNameUrlParamForMarble(scrRef: SerializedVerseRef) {
  return formatScrRef(scrRef, 'English').replace(/^((\d\s)?\w+).*$/, '$1'); // e.g. 1 Corinthians
}
function getEnglishBookNameUrlParamForOtn(scrRef: SerializedVerseRef) {
  return formatScrRef(scrRef, 'English').replace(/^((\d)\s)?(\w+).*$/, '$3$1'); // e.g. Corinthians1
}

export function getWebsiteOptions(): Map<keyof CommandHandlers, WebsiteViewerOptions> {
  const usfmDocsOptions: WebsiteViewerOptions = {
    getUrl: () => 'https://docs.usfm.bible/usfm/3.1/index.html',
    websiteName: 'Usfm Docs',
    watchRefChange: RefChange.DoNotWatch,
  };

  const otnOptions: WebsiteViewerOptions = {
    getUrl: (scrRef: SerializedVerseRef) => {
      const bookNum: number = Canon.bookIdToNumber(scrRef.book);

      const otNtUrlParam = bookNum < 40 ? 'The_Old_Testament' : 'The_New_Testament';
      const availableOtnBooks = [
        6,
        8,
        17,
        20,
        27,
        28,
        33,
        39,
        ...createRange(40, 46),
        ...createRange(48, 66),
      ]; // with added books this may be outdated soon
      const hasEnglishBookName = [40, ...createRange(42, 53), 56, 45, ...createRange(59, 61), 65];
      let bookName = hasEnglishBookName.includes(bookNum)
        ? getEnglishBookNameUrlParamForOtn(scrRef)
        : scrRef.book;
      if (scrRef.book === 'EST') bookName = 'eth';
      if (scrRef.book === '1TI') bookName = 'tim1';
      if (scrRef.book === '2TI') bookName = 'tim2';
      if (scrRef.book === 'HEB') bookName = 'hebrew';
      if (scrRef.book === '1JN') bookName = 'jn1';
      if (scrRef.book === '2JN') bookName = 'jn2';
      if (scrRef.book === '3JN') bookName = 'jn3';

      if (availableOtnBooks.includes(bookNum))
        return `https://opentn.bible/search/?testament=${otNtUrlParam}&book=${bookName.toLowerCase()}`;

      logger.warn(
        `website-viewer: OTN: ${scrRef.book} not available on the open translator notes website, routing to the main page`,
      );
      return 'https://opentn.bible/';
    },
    websiteName: 'SIL OTN',
    watchRefChange: RefChange.WatchBookChange,
  };

  const marbleOptions: WebsiteViewerOptions = {
    getUrl: (scrRef: SerializedVerseRef) => {
      const bookNum = Canon.bookIdToNumber(scrRef.book);
      let bookName = getEnglishBookNameUrlParamForMarble(scrRef);
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
      bookName = otherBookNames[bookNum] ?? bookName;
      return `https://marble.bible/text?book=${bookName}&chapter=${scrRef.chapterNum}&verse=${scrRef.verseNum}`;
    },
    websiteName: 'UBS Marble',
    watchRefChange: RefChange.WatchVerseChange,
  };

  const wiBiLexOptions: WebsiteViewerOptions = {
    getUrl: () => 'https://www.die-bibel.de/ressourcen/wibilex',
    websiteName: 'GBS WiBiLex',
    watchRefChange: RefChange.DoNotWatch,
  };

  const stepBibleOptions: WebsiteViewerOptions = {
    getUrl: (scrRef: SerializedVerseRef) => {
      const books = [
        'Gen',
        'Exod',
        'Lev',
        'Num',
        'Deut',
        'Josh',
        'Judg',
        'Ruth',
        '1Sam',
        '2Sam',
        '1Kngs',
        '2Kngs',
        '1Chr',
        '2Chr',
        'Ezra',
        'Neh',
        'Esth',
        'Job',
        'Psalm',
        'Prov',
        'Eccl',
        'Song',
        'Isa',
        'Jer',
        'Lam',
        'Ezek',
        'Dan',
        'Hosea',
        'Joel',
        'Amos',
        'Obad',
        'Jonah',
        'Micah',
        'Nahum',
        'Hab',
        'Zeph',
        'Hag',
        'Zech',
        'Mal',
        'Matt',
        'Mark',
        'Luke',
        'John',
        'Acts',
        'Rom',
        '1Cor',
        '2Cor',
        'Gal',
        'Eph',
        'Phil',
        'Col',
        '1Thess',
        '2Thess',
        '1Tim',
        '2Tim',
        'Titus',
        'Phlm',
        'Heb',
        'James',
        '1Pet',
        '2Pet',
        '1John',
        '2John',
        '3John',
        'Jude',
        'Rev',
      ];
      const bookNum: number = Canon.bookIdToNumber(scrRef.book);
      let reference = `${books[bookNum - 1]}.${scrRef.chapterNum}`;
      // books with only 1 chapter do not use the chapter number and would interpret it as the verse number
      if (
        books[bookNum - 1] === 'Obad' ||
        books[bookNum - 1] === 'Phlm' ||
        books[bookNum - 1] === '2John' ||
        books[bookNum - 1] === '3John' ||
        books[bookNum - 1] === 'Jude'
      )
        reference = books[bookNum - 1];
      return `https://www.stepbible.org/?q=reference=${reference}`;
    },
    websiteName: 'STEP Bible',
    watchRefChange: RefChange.WatchChapterChange,
  };

  const unicodeExplorerOptions: WebsiteViewerOptions = {
    getUrl: () => 'https://unicode-explorer.com/c/200B',
    websiteName: 'Unicode Explorer',
    watchRefChange: RefChange.DoNotWatch,
  };

  return new Map<keyof CommandHandlers, WebsiteViewerOptions>([
    ['websiteViewer.openUsfmDocs', usfmDocsOptions],
    ['websiteViewer.openOTN', otnOptions],
    ['websiteViewer.openMarble', marbleOptions],
    ['websiteViewer.openWiBiLex', wiBiLexOptions],
    ['websiteViewer.openStepBible', stepBibleOptions],
    ['websiteViewer.openUnicodeExplorer', unicodeExplorerOptions],
  ]);
}
