import { formatReplacementString } from 'platform-bible-utils';

/**
 * Get the name of the web view based on the name of the project
 *
 * @param titleStringFormat String with `{projectName}` in it to be replaced with the project name
 *   e.g. `Verse Ref View: {projectName}`
 * @param projectName Should generally be the project's short name
 * @returns Web view title
 */
export function getWebViewTitle(titleStringFormat: string, projectName: string | undefined) {
  return formatReplacementString(titleStringFormat, { projectName });
}
