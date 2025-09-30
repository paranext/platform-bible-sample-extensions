import { WebViewProps } from '@papi/core';
import papi, { logger } from '@papi/frontend';
import { useData, useDataProvider, useLocalizedStrings } from '@papi/frontend/react';
import { useState, useEffect, useMemo } from 'react';
import {
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Button,
  Checkbox,
} from 'platform-bible-react';
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

const hslRegex = /hsl\(\s*([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/;

globalThis.webViewComponent = function ThemeSelector({ title }: WebViewProps) {
  const [selectedTheme, setSelectedTheme] = useState<ThemeDefinitionExpanded>(undefined);
  const [selectedCssVariable, setSelectedCssVariable] = useState<{
    key: string;
    value: string;
  }>(undefined);
  const [popoverColor, setPopoverColor] = useState<string>(undefined);
  const [popoverPosition, setPopoverPosition] = useState<{ x: number; y: number }>(undefined);
  const [hue, setHue] = useState<number>(undefined);
  const [saturation, setSaturation] = useState<number>(undefined);
  const [lightness, setLightness] = useState<number>(undefined);
  const [themeToCopyFrom, setThemeToCopyFrom] = useState<string>('');
  const [hoverBg, setHoverBg] = useState<string>(undefined);

  const dropdownBg = selectedTheme?.colors?.background || '#ffffff';
  const effectiveBg = hoverBg || dropdownBg;
  const themeDataProvider = useDataProvider(papi.themes.dataProviderName);

  // custom hook to get access to the theme data provider's setAllThemes function
  const [allThemesPossiblyError, setAllThemes] = useData<typeof papi.themes.dataProviderName>(
    themeDataProvider,
  ).AllThemes(undefined, DEFAULT_ALL_THEMES);

  // re-run the function when its dependencies change
  useEffect(() => {
    if (popoverColor?.startsWith('hsl')) {
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
    const handleClick = () => {
      setPopoverColor(undefined);
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
    if (allThemesPossiblyError === undefined) {
      logger.warn('allThemesPossiblyError is undefined, falling back to DEFAULT_ALL_THEMES');
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
    <div>
      <div>{titleLocalized}</div>
      <div>
        {Object.entries(allThemes).map(([themeFamilyId, themeFamily]) => (
          <div key={themeFamilyId} className="mb-2">
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
                      setSelectedCssVariable(undefined);
                      setPopoverColor(undefined);
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
                  className="mr-2 mb-2 rounded p-2"
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
      {/* New Copy Theme Button */}
      <Button
        onClick={() => {
          if (!themeToCopyFrom) {
            logger.warn('No theme selected to copy from');
            return;
          }
          if (!selectedTheme) {
            logger.warn('No target selectedTheme to copy into');
            return;
          }

          const [familyId, type] = themeToCopyFrom.split('::');
          const themeSource = allThemes[familyId]?.[type];

          if (!themeSource) {
            logger.error(`Theme to copy from not found: ${themeToCopyFrom}`);
            return;
          }

          // Copy cssVariables from selected source theme into selectedTheme
          const updatedTheme = {
            ...selectedTheme,
            cssVariables: { ...themeSource.cssVariables },
          };

          setSelectedTheme(updatedTheme);
          logger.info(`Copied theme ${familyId}::${type} into selectedTheme`);
        }}
        style={{
          backgroundColor: effectiveBg,
          color: getContrastTextColor(effectiveBg),
        }}
      >
        Copy Theme
      </Button>
      {/* Dropdown List of all themes except selectedTheme */}
      <Select
        value={themeToCopyFrom}
        onChange={(e) => setThemeToCopyFrom(e.target.value)}
        style={{
          backgroundColor: effectiveBg,
          color: getContrastTextColor(effectiveBg),
        }}
        className="p-1 border border-gray-300 rounded"
      >
        <SelectTrigger
          className="tw-w-48"
          style={{
            backgroundColor: effectiveBg,
            color: getContrastTextColor(effectiveBg),
          }}
        >
          <SelectValue placeholder="Select a Theme" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(allThemes).flatMap(([themeFamilyId, themeFamily]) =>
            Object.entries(themeFamily ?? {}).map(([type, themeObj]) => {
              if (
                selectedTheme &&
                themeObj?.id === selectedTheme.id &&
                themeFamilyId === selectedTheme.themeFamilyId &&
                type === selectedTheme.type
              ) {
                return ''; // Skip current theme
              }

              const label =
                localizedStrings[themeObj?.label] ?? themeObj?.label ?? '(Unnamed Theme)';
              const suffix = themeFamilyId.startsWith(papi.themes.USER_THEME_FAMILY_PREFIX)
                ? ' ' + themeFamilyId.substring(papi.themes.USER_THEME_FAMILY_PREFIX.length)
                : '';

              const optionBg = themeObj?.colors?.background || dropdownBg;

              return (
                <SelectItem
                  key={`${themeFamilyId}-${type}`}
                  value={`${themeFamilyId}::${type}`}
                  className={`p-4 rounded ${optionBg === 'red' ? 'bg-red-500 text-white' : ''}`}
                  onMouseEnter={() => setHoverBg(optionBg)}
                  onMouseLeave={() => setHoverBg(undefined)}
                >
                  {label}
                  {suffix}
                </SelectItem>
              );
            }),
          )}
        </SelectContent>
      </Select>
      {selectedTheme &&
        selectedTheme.cssVariables &&
        Object.keys(selectedTheme.cssVariables || {}).length > 0 && (
          <div className="mt-4 bg-gray-100 p-4 rounded-lg">
            <h3
              className="mb-3"
              style={{
                backgroundColor: effectiveBg,
                color: getContrastTextColor(effectiveBg),
              }}
            >
              CSS Variables for Theme:{' '}
              <span className="text-gray-800">
                {localizedStrings[selectedTheme.label] || selectedTheme.label || '(unknown theme)'}
                {selectedTheme.themeFamilyId.startsWith(papi.themes.USER_THEME_FAMILY_PREFIX)
                  ? ' ' +
                    selectedTheme.themeFamilyId.substring(
                      papi.themes.USER_THEME_FAMILY_PREFIX.length,
                    )
                  : ''}
              </span>
            </h3>
            <div className="flex flex-col gap-3">
              {Object.entries(selectedTheme.cssVariables || {}).map(([key, value]) => {
                const swatchColor = resolveCssVariable(value);
                return (
                  // 1 button (color swatch) for each css variable
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 border border-dashed border-gray-300 rounded bg-white"
                  >
                    <Button
                      className="w-5 h-5 mb-6 border border-gray-500 rounded flex-shrink-0 p-0"
                      style={{ backgroundColor: swatchColor }}
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
                        backgroundColor: effectiveBg,
                        color: getContrastTextColor(effectiveBg),
                      }}
                      className="border border-gray-300 rounded p-1 font-mono text-gray-800 bg-gray-100 cursor-default"
                    />
                    <span className="font-mono text-gray-600">
                      {value?.split(' ').length !== 3 ? value : ''}
                    </span>
                    <br />
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
          {/* Check if popoverColor is in HSL format */}
          {/^(hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*\))$/.test(popoverColor) ? (
            <>
              <div
                style={{
                  backgroundColor: `hsl(${hue ?? 0}, ${saturation ?? 0}%, ${lightness ?? 0}%)`,
                }}
                className="w-[100px] h-[50px] border border-[#999] rounded-[4px] mb-2"
              />
              <div className="font-mono text-gray-800 mb-2">
                hsl({hue}, {saturation}%, {lightness}%)
              </div>

              {/* Hue slider */}
              {selectedTheme && hue !== undefined && (
                <Label
                  style={{
                    backgroundColor: effectiveBg,
                    color: getContrastTextColor(effectiveBg),
                  }}
                >
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
                        const newHsl = `hsl(${newHue}, ${saturation ?? 0}%, ${lightness ?? 0}%)`;
                        setSelectedCssVariable({ key: selectedCssVariable.key, value: newHsl });
                        setSelectedTheme({
                          ...selectedTheme,
                          cssVariables: {
                            ...selectedTheme.cssVariables,
                            [selectedCssVariable.key]: newHsl,
                          },
                        });
                      }
                    }}
                    className="w-full"
                  />
                </Label>
              )}
              {/* Saturation slider */}
              {selectedTheme && saturation !== undefined && (
                <Label
                  style={{
                    backgroundColor: effectiveBg,
                    color: getContrastTextColor(effectiveBg),
                  }}
                >
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
                        const newHsl = `hsl(${hue ?? 0}, ${newSaturation}%, ${lightness ?? 0}%)`;
                        setSelectedCssVariable({ key: selectedCssVariable.key, value: newHsl });
                        setSelectedTheme({
                          ...selectedTheme,
                          cssVariables: {
                            ...selectedTheme.cssVariables,
                            [selectedCssVariable.key]: newHsl,
                          },
                        });
                      }
                    }}
                    className="w-full"
                  />
                </Label>
              )}

              {/* Lightness slider */}
              {selectedTheme && lightness !== undefined && (
                <Label
                  style={{
                    backgroundColor: effectiveBg,
                    color: getContrastTextColor(effectiveBg),
                  }}
                >
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
                        const newHsl = `hsl(${hue ?? 0}, ${saturation ?? 0}%, ${newLightness}%)`;
                        setSelectedCssVariable({ key: selectedCssVariable.key, value: newHsl });
                        setSelectedTheme({
                          ...selectedTheme,
                          cssVariables: {
                            ...selectedTheme.cssVariables,
                            [selectedCssVariable.key]: newHsl,
                          },
                        });
                      }
                    }}
                    className="w-full"
                  />
                </Label>
              )}
            </>
          ) : (
            // If it's not an HSL color → text input
            <div>
              <Label
                style={{
                  backgroundColor: effectiveBg,
                  color: getContrastTextColor(effectiveBg),
                }}
              >
                Color Value:
                <input
                  type="text"
                  value={selectedCssVariable?.value || ''}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setSelectedCssVariable({ key: selectedCssVariable?.key, value: newValue });
                    if (selectedTheme) {
                      setSelectedTheme({
                        ...selectedTheme,
                        cssVariables: {
                          ...selectedTheme.cssVariables,
                          [selectedCssVariable!.key]: newValue,
                        },
                      });
                    }
                  }}
                  className="w-full border border-gray-300 rounded p-1 font-mono"
                />
              </Label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
