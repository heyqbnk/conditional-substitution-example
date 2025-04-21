// Regular expression used to detect \n import from "virtual:platformed";
export const RE_PLATFORMED_IMPORT = /(?:\r\n|\r|\n)?\s*import\s*{\s*platformed\s*}\s*from\s*['"]virtual:platformed['"];?/;
// Regular expression used to detect platformed({...}) calls.
// Example:
// const A = platformed({ common: B, ios: C });
//
// Result:
// "platformed({ common: B, ios: C });"
export const RE_PLATFORMED_CALL = /platformed(?:<[^>]*>|)\(\s*{[\s\S]*?}\s*\)/gm;
// Regular expression to detect platformed module ID.
export const RE_PLATFORMED_ID = /\.platformed(\.(jsx?|tsx?)|)$/;
// Regular expression to detect an import platform name.
export const RE_DETECT_PLATFORM = /\.(\w+)(?:\.(?:s?css|jsx?|tsx?)|)['"];?$/;

// Regular expression to find all platform-specific imports.
export const getREPlatformedImports = (knownPlatforms: string[]) => new RegExp(
  `(?:\r\n|\r|\n)?\\s*import(?:\\s*{[^}]+}\\s*from)?\\s*['"][\\w.\\/@~]+\\.(?:${knownPlatforms.join('|')})(?:\\.(?:s?css|jsx?|tsx?)|)['"];?`,
  'gm',
);
