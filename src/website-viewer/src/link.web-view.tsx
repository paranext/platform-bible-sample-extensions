import { WebViewProps } from '@papi/core';
import { useLocalizedStrings } from '@papi/frontend/react';
import { LocalizeKey } from 'platform-bible-utils';

const descriptionTextL10nKey = '%websiteViewerMenu_clickLink%';
const localizedStringKeys: LocalizeKey[] = [descriptionTextL10nKey];

global.webViewComponent = function LinkWebView({ useWebViewState }: WebViewProps) {
  const [{ [descriptionTextL10nKey]: descriptionTextLocalized }] =
    useLocalizedStrings(localizedStringKeys);
  const [url] = useWebViewState('url', '');
  return (
    <div>
      <p>{descriptionTextLocalized}</p>
      <a href={url} target="_blank" rel="noreferrer">
        {url}
      </a>
    </div>
  );
};
