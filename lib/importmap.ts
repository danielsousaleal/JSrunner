export const defaultImportMap: Record<string, string> = {
  react: "https://esm.sh/react@18.2.0",
  "react/": "https://esm.sh/react@18.2.0/",
  "react-dom": "https://esm.sh/react-dom@18.2.0",
  "react-dom/": "https://esm.sh/react-dom@18.2.0/",
  "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime",
  lodash: "https://esm.sh/lodash@4.17.21",
  "lodash-es": "https://esm.sh/lodash-es@4.17.21",
  clsx: "https://esm.sh/clsx@2.0.0",
  "tailwind-merge": "https://esm.sh/tailwind-merge@2.0.0",
  "class-variance-authority": "https://esm.sh/class-variance-authority@0.7.0",
  axios: "https://esm.sh/axios@1.6.0",
  zod: "https://esm.sh/zod@3.22.0",
  "date-fns": "https://esm.sh/date-fns@3.0.0",
  "date-fns/": "https://esm.sh/date-fns@3.0.0/",
  uuid: "https://esm.sh/uuid@9.0.0",
  nanoid: "https://esm.sh/nanoid@5.0.0",
  zustand: "https://esm.sh/zustand@4.4.0",
  "zustand/": "https://esm.sh/zustand@4.4.0/",
  debug: "https://esm.sh/debug@4.3.0",
};

export function mergeImportMaps(
  ...maps: Record<string, string>[]
): Record<string, string> {
  return Object.assign({}, defaultImportMap, ...maps);
}

export function addPackageToImportMap(
  currentMap: Record<string, string>,
  packageName: string,
  version?: string
): Record<string, string> {
  const versionStr = version ? `@${version}` : "";
  const baseUrl = `https://esm.sh/${packageName}${versionStr}`;
  return {
    ...currentMap,
    [packageName]: baseUrl,
    [`${packageName}/`]: `${baseUrl}/`,
  };
}

export function removePackageFromImportMap(
  currentMap: Record<string, string>,
  packageName: string
): Record<string, string> {
  const newMap = { ...currentMap };
  delete newMap[packageName];
  delete newMap[`${packageName}/`];
  return newMap;
}

export function buildImportMapScript(
  importMap: Record<string, string>
): string {
  const merged = mergeImportMaps(importMap);
  return JSON.stringify({ imports: merged }, null, 2);
}
