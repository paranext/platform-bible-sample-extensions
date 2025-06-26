import { WebViewProps } from '@papi/core';
import papi, { logger } from '@papi/frontend';
import { useData, useDataProvider, useLocalizedStrings } from '@papi/frontend/react';
import { useState, useEffect } from 'react';

import {
  getErrorMessage,
  isPlatformError,
  LocalizeKey,
  ThemeDefinitionExpanded,
  ThemeFamiliesByIdExpanded,
} from 'platform-bible-utils';
import { useMemo } from 'react';
import { Button, Checkbox } from 'platform-bible-react';

import { ContextMenu } from './types/styles';

import MaterialDialog from './theme-selector.dialog';

/** Placeholder theme to detect when we are loading */
const DEFAULT_THEME_VALUE: ThemeDefinitionExpanded = {
  themeFamilyId: '',
  type: 'light',
  id: 'light',
  label: '%unused%',
  cssVariables: {},
};

const DEFAULT_ALL_THEMES: ThemeFamiliesByIdExpanded = {};

const DEFAULT_SHOULD_MATCH_SYSTEM = true;

globalThis.webViewComponent = function ThemeSelector({ title }: WebViewProps) {
  const [clicked, setClicked] = useState(false);
  const [points, setPoints] = useState({
    x: 0,
    y: 0,
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const handleClick = () => setClicked(false);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, []);

  // I know this is a LocalizeKey
  // eslint-disable-next-line no-type-assertion/no-type-assertion
  const titleKey = (title ?? '') as LocalizeKey;

  const handleMenuItemClick = (action: string) => {
    logger.info(`User selected: ${action}`);
    setShowForm(true);
  };

  const [
    {
      [titleKey]: titleLocalized,
      '%themeSelector_toggle_shouldMatchSystem_label%': shouldMatchSystemLabel,
    },
  ] = useLocalizedStrings(
    // ENHANCEMENT: Localize theme labels
    useMemo(() => [titleKey, '%themeSelector_toggle_shouldMatchSystem_label%'], [titleKey]),
  );

  const themeDataProvider = useDataProvider(papi.themes.dataProviderName);

  // ENHANCEMENT: update user-defined themes. Can pull `setAllThemes` from here
  const [allThemesPossiblyError] = useData<typeof papi.themes.dataProviderName>(
    themeDataProvider,
  ).AllThemes(undefined, DEFAULT_ALL_THEMES);

  const allThemes = useMemo(() => {
    if (isPlatformError(allThemesPossiblyError)) {
      logger.warn(
        `Theme Selector error on retrieving All Themes: ${getErrorMessage(allThemesPossiblyError)}`,
      );
      return DEFAULT_ALL_THEMES;
    }
    return allThemesPossiblyError;
  }, [allThemesPossiblyError]);

  const localizedKeys = useMemo(() => {
    const result: LocalizeKey[] = [];

    Object.entries(allThemes).forEach(([themeFamilyId, themeFamily]) => {
      if (themeFamily) {
        Object.entries(themeFamily).forEach(([type, themeToDisplay]) => {
          if (themeToDisplay) {
            result.push(themeToDisplay.label);
          }
        });
      }
    });

    return result;
  }, [allThemes]); // or [] if allThemes is static

  const [localizedStrings] = useLocalizedStrings(localizedKeys);

  const [shouldMatchSystemPossiblyError, setShouldMatchSystem, isLoadingShouldMatchSystem] =
    useData<typeof papi.themes.dataProviderName>(themeDataProvider).ShouldMatchSystem(
      undefined,
      DEFAULT_SHOULD_MATCH_SYSTEM,
    );

  const shouldMatchSystem = useMemo(() => {
    if (isPlatformError(shouldMatchSystemPossiblyError)) {
      logger.warn(
        `Theme Selector error on retrieving Should Match System: ${getErrorMessage(shouldMatchSystemPossiblyError)}`,
      );
      return DEFAULT_SHOULD_MATCH_SYSTEM;
    }
    return shouldMatchSystemPossiblyError;
  }, [shouldMatchSystemPossiblyError]);

  const [themePossiblyError, setCurrentTheme] = useData<typeof papi.themes.dataProviderName>(
    themeDataProvider,
  ).CurrentTheme(undefined, DEFAULT_THEME_VALUE);

  /** Get the theme on first load so we can show the right symbol on the toolbar */
  const theme = useMemo(() => {
    // Warn if the theme came back as a PlatformError. Will handle the PlatformError elsewhere too
    if (isPlatformError(themePossiblyError))
      logger.warn(`Error getting theme for toolbar button. ${getErrorMessage(theme)}`);

    return papi.themes.getCurrentThemeSync();
  }, [themePossiblyError]);

  return (
    <div>
      <div>{titleLocalized}</div>
      <div>
        {Object.entries(allThemes).map(([themeFamilyId, themeFamily]) => (
          <div key={themeFamilyId}>
            {Object.entries(themeFamily ?? {}).map(([type, themeToDisplay]) => (
              <Button
                key={type}
                disabled={!setCurrentTheme}
                onClick={() => {
                  try {
                    setCurrentTheme?.({ themeFamilyId, type });
                  } catch (e) {
                    logger.warn(
                      `Failed to set theme to ${themeFamilyId} ${type}: ${getErrorMessage(e)}`,
                    );
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault(); // prevent the default behaviour when right clicked
                  logger.info('Right Click');
                  setClicked(true);
                  setPoints({ x: e.pageX, y: e.pageY });
                }}
                variant={theme.id === themeToDisplay?.id ? 'outline' : 'default'}
              >
                {localizedStrings[themeToDisplay.label]}
                {themeToDisplay !== undefined &&
                themeFamilyId.indexOf(papi.themes.USER_THEME_FAMILY_PREFIX) === 0
                  ? ' ' + themeFamilyId.substring(papi.themes.USER_THEME_FAMILY_PREFIX.length)
                  : ''}
              </Button>
            ))}
          </div>
        ))}
        {clicked && (
          <ContextMenu top={points.y} left={points.x}>
            <ul>
              <li onClick={() => handleMenuItemClick('Edit')}>Edit</li>
            </ul>
          </ContextMenu>
        )}
        {showForm && <div style={{ background: 'yellow', padding: 20 }}></div>}
      </div>
      <div>
        {shouldMatchSystemLabel}
        <Checkbox
          disabled={isLoadingShouldMatchSystem}
          checked={shouldMatchSystem}
          onCheckedChange={(isChecked) => {
            setShouldMatchSystem?.(!!isChecked);
          }}
        />
      </div>
    </div>
  );
};
