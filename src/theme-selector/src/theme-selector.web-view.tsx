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
  const [points, setPoints] = useState({ x: 0, y: 0 });
  const [showForm, setShowForm] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeDefinitionExpanded | null>(null);
  const [selectedCssVariable, setSelectedCssVariable] = useState<{
    key: string;
    value: string;
  } | null>(null);

  useEffect(() => {
    console.log('ThemeSelector mounted');
    return () => console.log('ThemeSelector unmounted');
  }, []);

  useEffect(() => {
    const handleClick = () => setClicked(false);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

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

  // resolveCssVariable function updated slightly:
  const resolveCssVariable = (cssVar: string, element: HTMLElement = document.body): string => {
    // If it's already HSL, wrap it
    const hslMatch = cssVar.match(/^([\d.]+)\s+([\d.]+%)\s+([\d.]+%)$/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      return `hsl(${h}, ${s}, ${l})`;
    }

    // If it's already RGB
    const rgbMatch = cssVar.match(/^(\d{1,3})\s*,?\s*(\d{1,3})\s*,?\s*(\d{1,3})$/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `rgb(${r}, ${g}, ${b})`;
    }

    // If it’s a real CSS variable (like var(--foo)), resolve it
    if (cssVar.startsWith('var(')) {
      const match = cssVar.match(/var\((--[^),\s]+)(?:,[^)]+)?\)/);
      if (match) {
        const varName = match[1];
        const value = getComputedStyle(document.body).getPropertyValue(varName).trim();
        return value || cssVar;
      }
    }

    // Otherwise just return it as-is
    return cssVar;
  };

  const handleCssVariableClick = (key: string, value: string) => {
    const resolved = resolveCssVariable(value);
    logger.info(`Clicked CSS Variable: ${key} = ${value}, resolved to: ${resolved}`);
    setSelectedCssVariable({ key, value });
  };

  return (
    <div>
      <div>{titleLocalized}</div>
      <div>
        {Object.entries(allThemes).map(([themeFamilyId, themeFamily]) => (
          <div key={themeFamilyId} style={{ marginBottom: '0.5rem' }}>
            {Object.entries(themeFamily ?? {}).map(([type, themeToDisplay]) => {
              const isSelected = theme.id === themeToDisplay?.id;
              const localizedLabel =
                localizedStrings[themeToDisplay?.label] ??
                themeToDisplay?.label ??
                '(Unnamed Theme)';
              const suffix =
                themeToDisplay && themeFamilyId.startsWith(papi.themes.USER_THEME_FAMILY_PREFIX)
                  ? ' ' + themeFamilyId.substring(papi.themes.USER_THEME_FAMILY_PREFIX.length)
                  : '';

              return (
                <Button
                  key={`${themeFamilyId}-${type}`}
                  disabled={!setCurrentTheme}
                  onClick={() => {
                    try {
                      if (!themeToDisplay) throw new Error('Invalid themeToDisplay');
                      console.log('themeToDisplay.cssVariables:', themeToDisplay.cssVariables);
                      setCurrentTheme?.({ themeFamilyId, type });
                      logger.info('themeToDisplay: ', themeToDisplay);
                      setSelectedTheme(themeToDisplay);
                      setSelectedCssVariable(null);
                      logger.info(themeToDisplay.cssVariables);
                    } catch (e) {
                      logger.warn(
                        `Failed to set theme to ${themeFamilyId} ${type}: ${getErrorMessage(e)}`,
                      );
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    logger.info('Right Click: x - ', e.pageX, 'y - ', e.pageY);
                    setClicked(true);
                    setPoints({ x: e.pageX, y: e.pageY });
                  }}
                  variant={isSelected ? 'outline' : 'default'}
                  style={{ marginRight: '0.5rem', marginBottom: '0.5rem' }}
                >
                  {localizedLabel}
                  {suffix}
                </Button>
              );
            })}
          </div>
        ))}
      </div>
      <div>
        {shouldMatchSystemLabel}
        <Checkbox
          disabled={isLoadingShouldMatchSystem}
          checked={shouldMatchSystem}
          onCheckedChange={(isChecked) => setShouldMatchSystem?.(!!isChecked)}
        />
      </div>
      {selectedTheme &&
        selectedTheme.cssVariables &&
        Object.keys(selectedTheme.cssVariables).length > 0 && (
          <div
            style={{
              marginTop: '1rem',
              background: '#f9f9f9',
              padding: '1rem',
              borderRadius: '8px',
            }}
          >
            <h3 style={{ marginBottom: '0.75rem' }}>
              CSS Variables for{' '}
              <span style={{ color: '#333' }}>
                {localizedStrings[selectedTheme.label] || selectedTheme.label || '(unknown theme)'}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(selectedTheme.cssVariables).map(([key, value]) => {
                const resolved = resolveCssVariable(value);
                const swatchColor = resolved && resolved !== value ? resolved : '#ccc';

                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem',
                      border: '1px dashed #ccc',
                      borderRadius: '4px',
                      backgroundColor: '#fff',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: swatchColor,
                        border: '1px solid #999',
                        borderRadius: '4px',
                        flexShrink: 0,
                      }}
                      title={swatchColor}
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

      {selectedCssVariable && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f4f4f4',
            borderRadius: '8px',
            border: '1px solid #ddd',
          }}
        >
          <h4 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
            {selectedCssVariable.key}:{' '}
            <span style={{ fontFamily: 'monospace' }}>{selectedCssVariable.value}</span>
          </h4>

          <div
            style={{
              width: '100px',
              height: '40px',
              backgroundColor: resolveCssVariable(selectedCssVariable.value) || '#ccc',
              border: '1px solid #ccc',
              borderRadius: '4px',
              marginBottom: '0.5rem',
            }}
            title={resolveCssVariable(selectedCssVariable.value)}
          />

          <div style={{ color: '#666', fontFamily: 'monospace' }}>
            Resolved: {resolveCssVariable(selectedCssVariable.value)}
          </div>
        </div>
      )}
    </div>
  );
};
