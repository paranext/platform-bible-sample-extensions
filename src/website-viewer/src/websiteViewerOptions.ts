import { logger } from '@papi/backend';
import { VerseRef } from '@sillsdev/scripture';
import type { CommandHandlers } from 'papi-shared-types';
import { formatScrRef, ScriptureReference } from 'platform-bible-utils';

export interface WebsiteViewerOptions {
  getUrl: (scrRef: ScriptureReference, interfaceLanguage: string[]) => string;
  // TODO: could be improved by passing in another parameter with the selected text of the active tab
  // (e.g. for a lexicon or Marble to scroll to / highlight a word)
  // for demo purpose this text could for now come from a setting, where users can copy it into
  // alternatively an input on the main toolbar - if extensions can do a thing like adding controls to the main toolbar
  websiteName: string;
  watchRefChange?: RefChange;
}

// satisfy typescript, although we do not expect these to appear
export const DEFAULT_WEBSITE_VIEWER_OPTIONS: WebsiteViewerOptions = {
  getUrl: () => '',
  websiteName: '',
};

export enum RefChange {
  DoNotWatch,
  WatchBookChange,
  WatchChapterChange,
  WatchVerseChange,
}

function getFirstTwoLetterLanguageCode(interfaceLanguage: string[]): string {
  return interfaceLanguage.filter((language: string) => language.length === 2)?.[0];
}

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

function getEnglishBookNameUrlParamForMarble(scrRef: ScriptureReference) {
  return formatScrRef(scrRef, 'English').replace(/^((\d\s)?\w+).*$/, '$1'); // e.g. 1 Corinthians
}
function getEnglishBookNameUrlParamForOtn(scrRef: ScriptureReference) {
  return formatScrRef(scrRef, 'English').replace(/^((\d)\s)?(\w+).*$/, '$3$1'); // e.g. Corinthians1
}

export function getWebsiteOptions(): Map<keyof CommandHandlers, WebsiteViewerOptions> {
  const sandboxWebsiteViewerOptions: WebsiteViewerOptions = {
    getUrl: () => 'https://sykc6v-3000.csb.app/',
    websiteName: 'CodeSandbox Settings UI mockup',
  };

  const pt9VideoOptions: WebsiteViewerOptions = {
    getUrl: () =>
      'https://player.vimeo.com/video/472226946?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479',

    websiteName: 'PT9 Video',
  };

  const pt9VHelpOptions: WebsiteViewerOptions = {
    getUrl: () => 'https://paratext.org/videos/en/paratext-9/',
    websiteName: 'PT9 Help',
  };

  const usfmDocsOptions: WebsiteViewerOptions = {
    getUrl: () => 'https://docs.usfm.bible/usfm/3.1/index.html',
    websiteName: 'Usfm Docs',
  };

  const otnOptions: WebsiteViewerOptions = {
    getUrl: (scrRef: ScriptureReference) => {
      const otNtUrlParam = scrRef.bookNum < 40 ? 'The_Old_Testament' : 'The_New_Testament';
      const verseRef = new VerseRef(scrRef.bookNum, scrRef.chapterNum, scrRef.verseNum, undefined);
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
      let bookName = hasEnglishBookName.includes(scrRef.bookNum)
        ? getEnglishBookNameUrlParamForOtn(scrRef)
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
        `website-viewer: OTN: ${verseRef.book} not available on the open translator notes website, routing to the main page`,
      );
      return 'https://opentn.bible/';
    },
    websiteName: 'SIL OTN',
    watchRefChange: RefChange.WatchBookChange,
  };

  const marbleOptions: WebsiteViewerOptions = {
    getUrl: (scrRef: ScriptureReference) => {
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
      bookName = otherBookNames[scrRef.bookNum] ?? bookName;
      return `https://marble.bible/text?book=${bookName}&chapter=${scrRef.chapterNum}&verse=${scrRef.verseNum}`;
    },
    websiteName: 'UBS Marble',
    watchRefChange: RefChange.WatchVerseChange,
  };

  const wiBiLexOptions: WebsiteViewerOptions = {
    getUrl: () => 'https://www.die-bibel.de/ressourcen/wibilex',
    websiteName: 'GBS WiBiLex',
  };

  const youVersionVerseViewOptions: WebsiteViewerOptions = {
    getUrl: (scrRef: ScriptureReference) => {
      const verseRef = new VerseRef(scrRef.bookNum, scrRef.chapterNum, scrRef.verseNum, undefined);
      return `https://www.bible.com/en-GB/bible/1/${verseRef.book}.${scrRef.chapterNum}.${scrRef.verseNum}`;
    },
    websiteName: 'YouVersion',
    watchRefChange: RefChange.WatchVerseChange,
  };

  const stepBibleOptions: WebsiteViewerOptions = {
    getUrl: (scrRef: ScriptureReference, interfaceLanguage: string[]) => {
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
      const languageCode = getFirstTwoLetterLanguageCode(interfaceLanguage);
      const locale = languageCode ? `&lang=${languageCode[0]}` : '';
      let reference = `${books[scrRef.bookNum - 1]}.${scrRef.chapterNum}`;
      // books with only 1 chapter do not use the chapter number and would interpret it as the verse number
      if (
        books[scrRef.bookNum - 1] === 'Obad' ||
        books[scrRef.bookNum - 1] === 'Phlm' ||
        books[scrRef.bookNum - 1] === '2John' ||
        books[scrRef.bookNum - 1] === '3John' ||
        books[scrRef.bookNum - 1] === 'Jude'
      )
        reference = books[scrRef.bookNum - 1];
      return `https://www.stepbible.org/?q=reference=${reference}${locale}`;
    },
    websiteName: 'STEP Bible',
    watchRefChange: RefChange.WatchChapterChange,
  };

  return new Map<keyof CommandHandlers, WebsiteViewerOptions>([
    ['websiteViewer.openCodeSandbox', sandboxWebsiteViewerOptions],
    ['websiteViewer.openPT9Video', pt9VideoOptions],
    ['websiteViewer.openPT9Help', pt9VHelpOptions],
    ['websiteViewer.openUsfmDocs', usfmDocsOptions],
    ['websiteViewer.openOTN', otnOptions],
    ['websiteViewer.openMarble', marbleOptions],
    ['websiteViewer.openWiBiLex', wiBiLexOptions],
    ['websiteViewer.openYouVersionVerse', youVersionVerseViewOptions],
    ['websiteViewer.openStepBible', stepBibleOptions],
  ]);
}
