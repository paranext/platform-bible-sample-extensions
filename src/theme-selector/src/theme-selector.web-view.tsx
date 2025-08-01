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
  const [selectedTheme, setSelectedTheme] = useState<ThemeDefinitionExpanded | null>(undefined);
  const [selectedCssVariable, setSelectedCssVariable] = useState<{
    key: string;
    value: string;
  } | null>(null);

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
  var themeSelectedLabel;

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

  const handleCssVariableClick = (key: string, value: string) => {
    logger.info(`CSS Variable clicked: ${key} = ${value}`);
    // Add your logic here — e.g., open a form, copy to clipboard, etc.
    setSelectedCssVariable({ key, value });
  };
  const resolveCssVariable = (cssVar: string): string => {
    // If it's a CSS variable like "var(--something)"
    if (cssVar.startsWith('var(')) {
      const match = cssVar.match(/var\((--[^)]+)\)/);
      if (match) {
        return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
      }
    }
    return cssVar; // Fallback to raw value (e.g., #3366ff)
  };

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
                    logger.info('themeToDisplay: ', themeToDisplay);
                    themeSelectedLabel = themeToDisplay.label;
                    setSelectedTheme(themeToDisplay); // 👈 Set selected theme here
                    setSelectedCssVariable(null); // ✅ Reset preview
                    logger.info(themeToDisplay?.cssVariables);
                  } catch (e) {
                    logger.warn(
                      `Failed to set theme to ${themeFamilyId} ${type}: ${getErrorMessage(e)}`,
                    );
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault(); // prevent the default behaviour when right clicked
                  logger.info('Right Click: x - ', e.pageX, 'y - ', e.pageY);
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
      {selectedTheme && (
        <div style={{ marginTop: '1rem' }}>
          <h3>CSS Variables for {localizedStrings[selectedTheme.label]}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(selectedTheme.cssVariables).map(([key, value]) => {
              const resolved = resolveCssVariable(value);

              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: resolved,
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }}
                    title={resolved}
                  />
                  <Button variant="outline" onClick={() => handleCssVariableClick(key, value)}>
                    {key}
                  </Button>
                  <span style={{ fontFamily: 'monospace', color: '#666' }}>{resolved}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* ✅ Display Color Preview */}
      {selectedCssVariable && (
        <div style={{ marginTop: '1rem' }}>
          <h4>
            {selectedCssVariable.key}: {selectedCssVariable.value}
          </h4>
          <div
            style={{
              width: '100px',
              height: '40px',
              backgroundColor: selectedCssVariable.value,
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>
      )}
    </div>
  );
};
