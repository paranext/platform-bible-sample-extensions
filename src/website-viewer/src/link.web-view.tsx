import { WebViewProps } from '@papi/core';
import { useLocalizedStrings } from '@papi/frontend/react';
import { LocalizeKey } from 'platform-bible-utils';

// misusing the title to pass around the url, because I cannot come up with an easy way to get it in
global.webViewComponent = function LinkWebView({ title }: WebViewProps) {
  const descriptionTextL10nKey = '%websiteViewerMenu_clickLink%';
  const localizedStringKeys: LocalizeKey[] = [descriptionTextL10nKey];
  const [{ [descriptionTextL10nKey]: descriptionTextLocalized }] =
    useLocalizedStrings(localizedStringKeys);
  return (
    <div>
      <p>{descriptionTextLocalized}</p>
      <a href={title} target="_blank" rel="noreferrer">
        {title}
      </a>
    </div>
  );
};
