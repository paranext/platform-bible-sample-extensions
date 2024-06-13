import { WebViewProps } from '@papi/core';
import papi from '@papi/frontend';
import { useProjectData, useSetting } from '@papi/frontend/react';
import { VerseRef } from '@sillsdev/scripture';
import { ScriptureReference, usePromise } from 'platform-bible-react';
import { useCallback, useMemo } from 'react';
import { getWebViewTitle } from './utils';

/**
 * Strips USFM markers out and such to transform USFM into plain text
 *
 * WARNING: This is not guaranteed to work perfectly. It's just a quick estimation for demonstration
 *
 * @param usfm USFM string
 * @returns Plain text string
 */
function stripUSFM(usfm: string | undefined) {
  if (!usfm) return '';

  return (
    usfm
      .replace(/\\x .*\\x\*/g, '')
      .replace(/\\fig .*\\fig\*/g, '')
      .replace(/\\f .*\\f\*/g, '')
      .replace(/\r?\n/g, ' ')
      .replace(/\\p\s+/g, '\n  ')
      .replace(/\\(?:id|h|toc\d|mt\d|c|ms\d|mr|s\d|q\d*)\s+/g, '\n')
      .replace(/\\\S+\s+/g, '')
      .trim()
      // Remove verse number at the start
      .replace(/\d+ /, '')
  );
}

/** Stable default ScriptureReference */
const defaultScrRef: ScriptureReference = { bookNum: 1, chapterNum: 1, verseNum: 1 };

global.webViewComponent = function VerseRefView({
  projectId,
  title,
  updateWebViewDefinition,
}: WebViewProps) {
  const [projects] = usePromise(
    useCallback(async () => {
      const projectsMetadata = await papi.projectLookup.getMetadataForAllProjects({
        includeProjectInterfaces: 'platformScripture.USFM_BookChapterVerse',
      });

      // Get project names
      const projectsMetadataDisplay = await Promise.all(
        projectsMetadata.map(async (projectMetadata) => {
          const pdp = await papi.projectDataProviders.get('platform.base', projectMetadata.id);

          const name = await pdp.getSetting('platform.name');

          return { ...projectMetadata, name };
        }),
      );
      return projectsMetadataDisplay;
    }, []),
    undefined,
  );

  const setProjectId = useCallback(
    (pId: string) => {
      const projectName = projects?.find((project) => project.id === pId)?.name;
      updateWebViewDefinition({
        title: projectName ? getWebViewTitle(projectName) : title,
        projectId: pId,
      });
    },
    [updateWebViewDefinition, projects, title],
  );

  // Get current verse reference
  const [scrRef] = useSetting('platform.verseRef', defaultScrRef);
  // Transform ScriptureReference to VerseRef for project data
  const verseRef = useMemo(
    () => new VerseRef(scrRef.bookNum, scrRef.chapterNum, scrRef.verseNum, undefined),
    [scrRef],
  );

  // Get the current verse from the project
  const [verse] = useProjectData('platformScripture.USFM_BookChapterVerse', projectId).VerseUSFM(
    verseRef,
    '',
  );

  return (
    <div className="top">
      <div>
        {verseRef.toString()}:{' '}
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects?.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <div>{stripUSFM(verse)}</div>
    </div>
  );
};
