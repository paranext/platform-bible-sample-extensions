import papi, { logger } from '@papi/backend';
import {
  ExecutionActivationContext,
  IWebViewProvider,
  SavedWebViewDefinition,
  WebViewDefinition,
} from '@papi/core';
import themeSelectorWebView from './theme-selector.web-view?inline';
import tailwindStyles from './tailwind.css?inline';

type IWebViewProviderWithType = IWebViewProvider & { webViewType: string };

/** Theme selector WebView provider that provides WebViews when papi requests them */
const themeSelectorWebViewProvider: IWebViewProviderWithType = {
  webViewType: 'themeSelector.themeSelector',
  async getWebView(savedWebView: SavedWebViewDefinition): Promise<WebViewDefinition | undefined> {
    if (savedWebView.webViewType !== this.webViewType)
      throw new Error(
        `${this.webViewType} provider received request to provide a ${savedWebView.webViewType} web view`,
      );

    return {
      title: '%themeSelector_title%',
      ...savedWebView,
      content: themeSelectorWebView,
      styles: tailwindStyles,
    };
  },
};

export async function activate(context: ExecutionActivationContext) {
  logger.info('Theme Selector is activating!');

  const themeSelectorWebViewProviderPromise = papi.webViewProviders.registerWebViewProvider(
    themeSelectorWebViewProvider.webViewType,
    themeSelectorWebViewProvider,
  );

  const openThemeSelectorPromise = papi.commands.registerCommand('themeSelector.open', async () =>
    papi.webViews.openWebView(themeSelectorWebViewProvider.webViewType, {
      type: 'float',
      floatSize: { height: 300, width: 400 },
      position: 'center',
    }),
  );

  // Await the registration promises at the end so we don't hold everything else up
  context.registrations.add(
    await themeSelectorWebViewProviderPromise,
    await openThemeSelectorPromise,
  );
}

export async function deactivate() {
  logger.info('Theme Selector is deactivating!');
  return true;
}
