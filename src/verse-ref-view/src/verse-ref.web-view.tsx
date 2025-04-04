import { WebViewProps } from '@papi/core';
import papi, { logger } from '@papi/frontend';
import { useLocalizedStrings, useProjectData } from '@papi/frontend/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  usePromise,
} from 'platform-bible-react';
import { useCallback } from 'react';
import { LocalizeKey } from 'platform-bible-utils';
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

const titleFormatKey = '%verseRefView_title_format%';
const localizedStringKeys: LocalizeKey[] = [titleFormatKey];

global.webViewComponent = function VerseRefView({
  projectId,
  title,
  updateWebViewDefinition,
  useWebViewScrollGroupScrRef,
}: WebViewProps) {
  const [{ [titleFormatKey]: titleFormatString }] = useLocalizedStrings(localizedStringKeys);

  const [projects] = usePromise(
    useCallback(async () => {
      const projectsMetadata = await papi.projectLookup.getMetadataForAllProjects({
        includeProjectInterfaces: 'platformScripture.USFM_Verse',
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
      // If localization hasn't come in, just don't set the project id yet
      if (titleFormatString === titleFormatKey) {
        logger.warn(
          `Verse Ref Web View: Localization has not come in yet, so skipping setting project id to ${pId}`,
        );
        return;
      }

      const projectName = projects?.find((project) => project.id === pId)?.name;
      updateWebViewDefinition({
        title: projectName ? getWebViewTitle(titleFormatString, projectName) : title,
        projectId: pId,
      });
    },
    [updateWebViewDefinition, projects, title, titleFormatString],
  );

  // Get current verse reference
  const [scrRef] = useWebViewScrollGroupScrRef();

  // Get the current verse from the project
  const [verse] = useProjectData('platformScripture.USFM_Verse', projectId).VerseUSFM(scrRef, '');

  return (
    <div className="tw-m-4">
      <div className="tw-flex tw-items-center">
        <div className="tw-flex-shrink-0 tw-me-4">{`${scrRef.book} ${scrRef.chapterNum}:${scrRef.verseNum}`}</div>
        <Select
          // Don't allow setting the project id if localization hasn't come in
          disabled={titleFormatString === titleFormatKey}
          value={projectId}
          onValueChange={(pId) => setProjectId(pId)}
        >
          <SelectTrigger className="tw-w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {projects?.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>{stripUSFM(verse)}</div>
    </div>
  );
};
