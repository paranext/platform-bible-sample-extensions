import { WebViewProps } from '@papi/core';
import papi, { logger } from '@papi/frontend';
import { useData, useDataProvider, useLocalizedStrings } from '@papi/frontend/react';
import { useState, useEffect, useMemo, Component, ReactNode } from 'react';
import { Button, Checkbox } from 'platform-bible-react';
import {
  getErrorMessage,
  isPlatformError,
  LocalizeKey,
  ThemeDefinitionExpanded,
  ThemeFamiliesByIdExpanded,
  ThemeFamiliesById,
} from 'platform-bible-utils';
import { getLuminance } from 'polished';

const DEFAULT_THEME_VALUE: ThemeDefinitionExpanded = {
  themeFamilyId: '',
  type: 'light',
  id: 'light',
  label: '%unused%',
  cssVariables: {},
};

const DEFAULT_ALL_THEMES: ThemeFamiliesByIdExpanded = {};

const DEFAULT_SHOULD_MATCH_SYSTEM = true;

class ErrorBoundary extends Component<{ children: ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error(`ErrorBoundary caught error: ${error.message}`, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please try again.</div>;
    }
    return this.props.children;
  }
}

globalThis.webViewComponent = function ThemeSelector({ title }: WebViewProps) {
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

  // custom hook to get access to the theme data provider's setAllThemes function
  const [allThemesPossiblyError, setAllThemes] = useData<typeof papi.themes.dataProviderName>(
    themeDataProvider,
  ).AllThemes(undefined, DEFAULT_ALL_THEMES);

  console.log('AllThemes hook ->', {
    allThemesPossiblyError,
    setAllThemes,
    setterType: typeof setAllThemes,
  });

  // re-run the function when its dependencies change
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

  // re-run the function when its dependencies change
  useEffect(() => {
    console.log('ThemeSelector mounted');
    return () => console.log('ThemeSelector unmounted');
  }, []);

  // re-run the function when its dependencies change
  useEffect(() => {
    const handleClick = () => {
      setPopoverColor(null);
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

  // caches or memoizes the "allThemes" variable
  const allThemes = useMemo(() => {
    console.log('allThemesPossiblyError:', allThemesPossiblyError);
    if (allThemesPossiblyError === undefined || allThemesPossiblyError === null) {
      logger.warn(
        'allThemesPossiblyError is undefined or null, falling back to DEFAULT_ALL_THEMES',
      );
      return DEFAULT_ALL_THEMES;
    }
    if (isPlatformError(allThemesPossiblyError)) {
      logger.warn(
        `Theme Selector error on retrieving All Themes: ${getErrorMessage(allThemesPossiblyError)}`,
      );
      return DEFAULT_ALL_THEMES;
    }
    return allThemesPossiblyError;
  }, [allThemesPossiblyError]);

  // caches, or memoizes, the localized keys variable
  const localizedKeys = useMemo(() => {
    console.log('Computing localizedKeys:', { allThemes });
    const result: LocalizeKey[] = [];
    Object.entries(allThemes).forEach(([themeFamilyId, themeFamily]) => {
      if (themeFamily) {
        Object.entries(themeFamily).forEach(([type, themeToDisplay]) => {
          if (themeToDisplay && themeToDisplay.label) {
            result.push(themeToDisplay.label);
          } else {
            logger.warn(`Invalid themeToDisplay in ${themeFamilyId}.${type}`, { themeToDisplay });
          }
        });
      }
    });
    return result;
  }, [allThemes]);

  // retrieve the localized strings
  const [localizedStrings] = useLocalizedStrings(localizedKeys);

  // custom hook meant to get the ShouldMatchSystem function on the theme data provider
  const [shouldMatchSystemPossiblyError, setShouldMatchSystem, isLoadingShouldMatchSystem] =
    useData<typeof papi.themes.dataProviderName>(themeDataProvider).ShouldMatchSystem(
      undefined,
      DEFAULT_SHOULD_MATCH_SYSTEM,
    );

  // caches the "shouldMatchSystem" variable - memoizes it
  const shouldMatchSystem = useMemo(() => {
    if (isPlatformError(shouldMatchSystemPossiblyError)) {
      logger.warn(
        `Theme Selector error on retrieving Should Match System: ${getErrorMessage(shouldMatchSystemPossiblyError)}`,
      );
      return DEFAULT_SHOULD_MATCH_SYSTEM;
    }
    return shouldMatchSystemPossiblyError;
  }, [shouldMatchSystemPossiblyError]);

  // a custom hook meant to get the theme data provider
  const [themePossiblyError, setCurrentTheme] = useData<typeof papi.themes.dataProviderName>(
    themeDataProvider,
  ).CurrentTheme(undefined, DEFAULT_THEME_VALUE);

  // caches the "theme" variable - memoizes it
  const theme = useMemo(() => {
    if (isPlatformError(themePossiblyError))
      logger.warn(`Error getting theme for toolbar button. ${getErrorMessage(theme)}`);
    return papi.themes.getCurrentThemeSync();
  }, [themePossiblyError]);

  // re-runs when the dependencies change
  useEffect(() => {
    if (theme && theme.themeFamilyId && theme.type) {
      const currentThemeFamily = allThemes[theme.themeFamilyId];
      const currentTheme = currentThemeFamily?.[theme.type];
      if (currentTheme && currentTheme !== selectedTheme) {
        console.log('Syncing selectedTheme with current theme:', {
          currentTheme,
          cssVariables: currentTheme.cssVariables,
        });
        setSelectedTheme({
          ...currentTheme,
          cssVariables: currentTheme.cssVariables || {},
        });
      }
    }
  }, [theme, allThemes]);

  // encode the css variable into the appropriate color format
  const resolveCssVariable = (cssVar: string): string => {
    const hslFullMatch = cssVar.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
    if (hslFullMatch) {
      const [, h, s, l] = hslFullMatch;
      return `hsl(${h}, ${s}%, ${l}%)`;
    }
    const hslMatch = cssVar.match(/^([\d.]+)\s+([\d.]+%)\s+([\d.]+%)$/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      return `hsl(${h}, ${s}, ${l})`;
    }
    const rgbMatch = cssVar.match(/^(\d{1,3})\s*,?\s*(\d{1,3})\s*,?\s*(\d{1,3})$/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `rgb(${r}, ${g}, ${b})`;
    }
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

  // callback function - when a css variable is clicked
  const handleCssVariableClick = (key: string, value: string) => {
    const resolved = resolveCssVariable(value);
    logger.info(`Clicked CSS Variable: ${key} = ${value}, resolved to: ${resolved}`);
    setSelectedCssVariable({ key, value });
  };

  // callback function - when a color swatch for a css variable is clicked
  const handleSwatchClick = (value: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const resolved = resolveCssVariable(value);
    setPopoverColor(resolved);
    setPopoverPosition({ x: event.clientX, y: event.clientY });
  };

  // synchronizes "selectedTheme" with "CurrentTheme" and papi backend AllThemes
  useEffect(() => {
    if (!selectedTheme || !setCurrentTheme) return;

    console.log('Syncing selectedTheme:', selectedTheme);

    // Step 1: Local UI update
    setCurrentTheme({
      themeFamilyId: selectedTheme.themeFamilyId,
      type: selectedTheme.type,
    });

    const updatedAllThemes: ThemeFamiliesById = {
      ...(isPlatformError(allThemesPossiblyError) ? {} : allThemesPossiblyError),
      [selectedTheme.themeFamilyId]: {
        ...(allThemesPossiblyError?.[selectedTheme.themeFamilyId] || {}),
        [selectedTheme.type]: {
          label: `%${selectedTheme.themeFamilyId}.${selectedTheme.type}%`,
          cssVariables: selectedTheme.cssVariables || {},
        },
      },
    };

    // Filter out all non-user themes before persisting
    const userThemesOnly: ThemeFamiliesById = {};
    for (const [themeFamilyId, themes] of Object.entries(updatedAllThemes)) {
      if (themeFamilyId.startsWith(papi.themes.USER_THEME_FAMILY_PREFIX)) {
        userThemesOnly[themeFamilyId] = themes;
      }
    }

    // Persist to backend (debounced or delayed to prevent rapid overwrites)
    const persist = async () => {
      try {
        await papi.themes.setAllThemes(userThemesOnly);
        console.log('✅ Theme changes persisted to backend');
      } catch (e) {
        logger.error(`❌ Failed to persist themes: ${getErrorMessage(e)}`);
      }
    };
    persist();
  }, [selectedTheme]); // 🔹 only run when selectedTheme changes

  // calculate the text color of the theme buttons using the polished library
  const getContrastTextColor = (backgroundColor: string): string => {
    // Fallback to black if backgroundColor is invalid
    if (!backgroundColor) return '#000';

    // Resolve CSS variables or color values using your existing function
    const resolvedColor = resolveCssVariable(backgroundColor);

    try {
      // Calculate luminance using polished
      const luminance = getLuminance(resolvedColor);

      // Return black for light backgrounds (luminance > 0.5), white for dark backgrounds
      return luminance > 0.5 ? '#000' : '#fff';
    } catch (e) {
      logger.warn(
        `Failed to calculate luminance for color ${resolvedColor}: ${getErrorMessage(e)}`,
      );
      return '#000'; // Fallback to black on error
    }
  };

  return (
    <ErrorBoundary>
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
                  // 1 button per theme
                  <Button
                    key={`${themeFamilyId}-${type}`}
                    disabled={!setCurrentTheme}
                    onClick={() => {
                      // callback function for mouse click event
                      try {
                        if (!themeToDisplay) throw new Error('Invalid themeToDisplay');
                        console.log('Setting selectedTheme:', {
                          themeToDisplay,
                          cssVariables: themeToDisplay.cssVariables,
                        });
                        if (!themeToDisplay.cssVariables) {
                          logger.warn(
                            `themeToDisplay.cssVariables is undefined for ${themeFamilyId}.${type}`,
                          );
                        }
                        setCurrentTheme?.({ themeFamilyId, type });
                        setSelectedTheme({
                          ...themeToDisplay,
                          cssVariables: themeToDisplay.cssVariables || {},
                        });
                        setSelectedCssVariable(null);
                        setPopoverColor(null);
                        logger.info('themeToDisplay.cssVariables:', themeToDisplay.cssVariables);
                      } catch (e) {
                        logger.warn(
                          `Failed to set theme to ${themeFamilyId} ${type}: ${getErrorMessage(e)}`,
                        );
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      logger.info('Right Click: x - ', e.pageX, 'y - ', e.pageY);
                    }}
                    variant={isSelected ? 'outline' : 'default'}
                    style={{
                      marginRight: '0.5rem',
                      marginBottom: '0.5rem',
                      // Set background color from theme or fallback
                      backgroundColor: isSelected
                        ? themeToDisplay?.cssVariables?.['--background-color'] || '#fff' // Selected: Use theme background or white
                        : themeToDisplay?.cssVariables?.['--background-color'] || '#000', // Unselected: Use theme background or black
                      // Set text color based on contrast
                      color: getContrastTextColor(
                        isSelected
                          ? themeToDisplay?.cssVariables?.['--background-color'] || '#fff'
                          : themeToDisplay?.cssVariables?.['--background-color'] || '#000',
                      ),
                      border: isSelected ? '2px solid #333' : '1px solid #ccc', // Optional: Enhance selected state
                    }}
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
          Object.keys(selectedTheme.cssVariables || {}).length > 0 && (
            <div
              style={{
                marginTop: '1rem',
                background: '#f9f9f9',
                padding: '1rem',
                borderRadius: '8px',
              }}
            >
              {console.log('Rendering CSS Variables:', {
                selectedTheme,
                cssVariables: selectedTheme.cssVariables,
              })}
              <h3 style={{ marginBottom: '0.75rem' }}>
                CSS Variables for{' '}
                <span style={{ color: '#333' }}>
                  {localizedStrings[selectedTheme.label] ||
                    selectedTheme.label ||
                    '(unknown theme)'}
                  {selectedTheme.themeFamilyId.startsWith(papi.themes.USER_THEME_FAMILY_PREFIX)
                    ? ' ' +
                      selectedTheme.themeFamilyId.substring(
                        papi.themes.USER_THEME_FAMILY_PREFIX.length,
                      )
                    : ''}
                </span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(selectedTheme.cssVariables || {}).map(([key, value]) => {
                  const swatchColor = resolveCssVariable(value);
                  return (
                    // 1 button (color swatch) for each css variable
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
                          handleCssVariableClick(key, value);
                          handleSwatchClick(value, e);
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
            {selectedTheme && hue !== null && (
              // hue slider
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
                    if (selectedCssVariable && selectedTheme) {
                      console.log('Before Hue Update:', {
                        selectedTheme,
                        cssVariables: selectedTheme.cssVariables,
                        selectedCssVariable,
                      });
                      const newHsl = `hsl(${newHue}, ${saturation ?? 0}%, ${lightness ?? 0}%)`;
                      setSelectedCssVariable({
                        key: selectedCssVariable.key,
                        value: newHsl,
                      });
                      const newCssVariables = {
                        ...(selectedTheme.cssVariables || {}),
                        [selectedCssVariable.key]: newHsl,
                      };
                      setSelectedTheme({
                        ...selectedTheme,
                        cssVariables: newCssVariables,
                      });
                      console.log('After Hue Update:', {
                        newHsl,
                        cssVariables: newCssVariables,
                      });
                    } else {
                      console.log('Hue Update Skipped:', { selectedCssVariable, selectedTheme });
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </label>
            )}
            {selectedTheme && saturation !== null && (
              // saturation slider
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
                    if (selectedCssVariable && selectedTheme) {
                      console.log('Before Saturation Update:', {
                        selectedTheme,
                        cssVariables: selectedTheme.cssVariables,
                        selectedCssVariable,
                      });
                      const newHsl = `hsl(${hue ?? 0}, ${newSaturation}%, ${lightness ?? 0}%)`;
                      setSelectedCssVariable({
                        key: selectedCssVariable.key,
                        value: newHsl,
                      });
                      const newCssVariables = {
                        ...(selectedTheme.cssVariables || {}),
                        [selectedCssVariable.key]: newHsl,
                      };
                      setSelectedTheme({
                        ...selectedTheme,
                        cssVariables: newCssVariables,
                      });
                      console.log('After Saturation Update:', {
                        newHsl,
                        cssVariables: newCssVariables,
                      });
                    } else {
                      console.log('Saturation Update Skipped:', {
                        selectedCssVariable,
                        selectedTheme,
                      });
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </label>
            )}
            {selectedTheme && lightness !== null && (
              // lightness slider
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
                    if (selectedCssVariable && selectedTheme) {
                      console.log('Before Lightness Update:', {
                        selectedTheme,
                        cssVariables: selectedTheme.cssVariables,
                        selectedCssVariable,
                      });
                      const newHsl = `hsl(${hue ?? 0}, ${saturation ?? 0}%, ${newLightness}%)`;
                      setSelectedCssVariable({
                        key: selectedCssVariable.key,
                        value: newHsl,
                      });
                      const newCssVariables = {
                        ...(selectedTheme.cssVariables || {}),
                        [selectedCssVariable.key]: newHsl,
                      };
                      setSelectedTheme({
                        ...selectedTheme,
                        cssVariables: newCssVariables,
                      });
                      console.log('After Lightness Update:', {
                        newHsl,
                        cssVariables: newCssVariables,
                      });
                    } else {
                      console.log('Lightness Update Skipped:', {
                        selectedCssVariable,
                        selectedTheme,
                      });
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
    </ErrorBoundary>
  );
};
