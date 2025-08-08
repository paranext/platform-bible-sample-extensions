import { WebViewProps } from '@papi/core';
import papi, { logger } from '@papi/frontend';
import { useData, useDataProvider, useLocalizedStrings } from '@papi/frontend/react';
import { useState, useEffect } from 'react';
import { Button, Checkbox } from 'platform-bible-react';
import {
  getErrorMessage,
  isPlatformError,
  LocalizeKey,
  ThemeDefinitionExpanded,
  ThemeFamiliesByIdExpanded,
  ThemeFamiliesById,
} from 'platform-bible-utils';
import { useMemo } from 'react';

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
  const [popoverColor, setPopoverColor] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [hue, setHue] = useState<number | null>(null);
  const [saturation, setSaturation] = useState<number | null>(null);
  const [lightness, setLightness] = useState<number | null>(null);

  const themeDataProvider = useDataProvider(papi.themes.dataProviderName);

  const [allThemesPossiblyError, setAllThemes] = useData<typeof papi.themes.dataProviderName>(
    themeDataProvider,
  ).AllThemes(undefined, DEFAULT_ALL_THEMES);

  useEffect(() => {
    if (popoverColor?.startsWith('hsl')) {
      const hslRegex = /hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/;
      const match = popoverColor.match(hslRegex);
      if (match) {
        const [, h, s, l] = match;
        setHue(parseFloat(h));
        setSaturation(parseFloat(s));
        setLightness(parseFloat(l));
      }
    }
  }, [popoverColor]);

  useEffect(() => {
    console.log('ThemeSelector mounted');
    return () => console.log('ThemeSelector unmounted');
  }, []);

  useEffect(() => {
    const handleClick = () => {
      setClicked(false);
      setPopoverColor(null); // Close popover on global click
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const titleKey = (title ?? '') as LocalizeKey;

  const [
    {
      [titleKey]: titleLocalized,
      '%themeSelector_toggle_shouldMatchSystem_label%': shouldMatchSystemLabel,
    },
  ] = useLocalizedStrings(
    useMemo(() => [titleKey, '%themeSelector_toggle_shouldMatchSystem_label%'], [titleKey]),
  );

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
  }, [allThemes]);

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

  const theme = useMemo(() => {
    if (isPlatformError(themePossiblyError))
      logger.warn(`Error getting theme for toolbar button. ${getErrorMessage(theme)}`);
    return papi.themes.getCurrentThemeSync();
  }, [themePossiblyError]);

  const resolveCssVariable = (cssVar: string, element: HTMLElement = document.body): string => {
    // Handle hsl(h, s%, l%) format
    const hslFullMatch = cssVar.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
    if (hslFullMatch) {
      const [, h, s, l] = hslFullMatch;
      return `hsl(${h}, ${s}%, ${l}%)`;
    }

    // Handle space-separated HSL (e.g., 360 50% 50%)
    const hslMatch = cssVar.match(/^([\d.]+)\s+([\d.]+%)\s+([\d.]+%)$/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      return `hsl(${h}, ${s}, ${l})`;
    }

    // Handle RGB format
    const rgbMatch = cssVar.match(/^(\d{1,3})\s*,?\s*(\d{1,3})\s*,?\s*(\d{1,3})$/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `rgb(${r}, ${g}, ${b})`;
    }

    // Handle CSS variables
    if (cssVar.startsWith('var(')) {
      const match = cssVar.match(/var\((--[^),\s]+)(?:,[^)]+)?\)/);
      if (match) {
        const varName = match[1];
        const value = getComputedStyle(document.body).getPropertyValue(varName).trim();
        return value || cssVar;
      }
    }

    return cssVar;
  };

  const handleCssVariableClick = (key: string, value: string) => {
    const resolved = resolveCssVariable(value);
    logger.info(`Clicked CSS Variable: ${key} = ${value}, resolved to: ${resolved}`);
    setSelectedCssVariable({ key, value });
  };

  const handleSwatchClick = (value: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent global click handler from closing popover
    const resolved = resolveCssVariable(value);
    setPopoverColor(resolved);
    setPopoverPosition({ x: event.clientX, y: event.clientY });
  };

  // Sync selectedTheme with papi.themes
  useEffect(() => {
    if (selectedTheme && setCurrentTheme) {
      try {
        setCurrentTheme({
          themeFamilyId: selectedTheme.themeFamilyId,
          type: selectedTheme.type,
        });

        const themeFamiliesById: ThemeFamiliesById = {
          [selectedTheme.themeFamilyId]: {
            [selectedTheme.type]: {
              label: `%${selectedTheme.themeFamilyId}.${selectedTheme.type}%`,
              cssVariables: selectedTheme.cssVariables,
            },
          },
        };

        papi.themes.setAllThemes(themeFamiliesById);
      } catch (e) {
        logger.warn(`Failed to set theme: ${getErrorMessage(e)}`);
      }
    }
  }, [selectedTheme, setCurrentTheme]);

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
                      setPopoverColor(null); // Close popover on theme change
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
                {selectedTheme &&
                selectedTheme.themeFamilyId.startsWith(papi.themes.USER_THEME_FAMILY_PREFIX)
                  ? ' ' +
                    selectedTheme.themeFamilyId.substring(
                      papi.themes.USER_THEME_FAMILY_PREFIX.length,
                    )
                  : ''}
              </span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Object.entries(selectedTheme.cssVariables).map(([key, value]) => {
                const swatchColor = resolveCssVariable(value);

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
                    <Button
                      style={{
                        width: '20px',
                        height: '20px',
                        backgroundColor: swatchColor,
                        border: '1px solid #999',
                        borderRadius: '4px',
                        flexShrink: 0,
                        padding: 0,
                      }}
                      title={swatchColor}
                      onClick={(e) => {
                        handleCssVariableClick(key, value); // Call handleCssVariableClick
                        handleSwatchClick(value, e); // Call handleSwatchClick
                      }}
                    />
                    <input
                      type="text"
                      value={key}
                      readOnly
                      style={{
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '0.25rem',
                        fontFamily: 'monospace',
                        color: '#333',
                        backgroundColor: '#f5f5f5',
                        cursor: 'default',
                      }}
                    />
                    <span style={{ fontFamily: 'monospace', color: '#666' }}>{swatchColor}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      {popoverColor && popoverPosition && (
        <div
          style={{
            position: 'fixed',
            top: popoverPosition.y + 10,
            left: popoverPosition.x + 10,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '0.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: '100px',
              height: '50px',
              backgroundColor: `hsl(${hue ?? 0}, ${saturation ?? 0}%, ${lightness ?? 0}%)`,
              border: '1px solid #999',
              borderRadius: '4px',
              marginBottom: '0.5rem',
            }}
          />
          <div style={{ fontFamily: 'monospace', color: '#333', marginBottom: '0.5rem' }}>
            hsl({hue}, {saturation}%, {lightness}%)
          </div>

          {hue !== null && (
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Hue: {hue}
              <input
                type="range"
                min={0}
                max={360}
                value={hue}
                onChange={(e) => {
                  const newHue = Number(e.target.value);
                  setHue(newHue);
                  if (selectedCssVariable) {
                    const newHsl = `hsl(${newHue}, ${saturation ?? 0}%, ${lightness ?? 0}%)`;
                    setSelectedCssVariable({
                      key: selectedCssVariable.key,
                      value: newHsl,
                    });
                    if (selectedTheme) {
                      setSelectedTheme({
                        ...selectedTheme,
                        cssVariables: {
                          ...selectedTheme.cssVariables,
                          [selectedCssVariable.key]: newHsl,
                        },
                      });
                    }
                  }
                }}
                style={{ width: '100%' }}
              />
            </label>
          )}

          {saturation !== null && (
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>
              Saturation: {saturation}%
              <input
                type="range"
                min={0}
                max={100}
                value={saturation}
                onChange={(e) => {
                  const newSaturation = Number(e.target.value);
                  setSaturation(newSaturation);
                  if (selectedCssVariable) {
                    const newHsl = `hsl(${hue ?? 0}, ${newSaturation}%, ${lightness ?? 0}%)`;
                    setSelectedCssVariable({
                      key: selectedCssVariable.key,
                      value: newHsl,
                    });
                    if (selectedTheme) {
                      setSelectedTheme({
                        ...selectedTheme,
                        cssVariables: {
                          ...selectedTheme.cssVariables,
                          [selectedCssVariable.key]: newHsl,
                        },
                      });
                    }
                  }
                }}
                style={{ width: '100%' }}
              />
            </label>
          )}

          {lightness !== null && (
            <label style={{ display: 'block' }}>
              Lightness: {lightness}%
              <input
                type="range"
                min={0}
                max={100}
                value={lightness}
                onChange={(e) => {
                  const newLightness = Number(e.target.value);
                  setLightness(newLightness);
                  if (selectedCssVariable) {
                    const newHsl = `hsl(${hue ?? 0}, ${saturation ?? 0}%, ${newLightness}%)`;
                    setSelectedCssVariable({
                      key: selectedCssVariable.key,
                      value: newHsl,
                    });
                    if (selectedTheme) {
                      setSelectedTheme({
                        ...selectedTheme,
                        cssVariables: {
                          ...selectedTheme.cssVariables,
                          [selectedCssVariable.key]: newHsl,
                        },
                      });
                    }
                  }
                }}
                style={{ width: '100%' }}
              />
            </label>
          )}
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
