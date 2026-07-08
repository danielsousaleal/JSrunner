export interface PackageSearchResult {
  name: string;
  description: string;
  version: string;
}

export async function searchPackages(
  query: string
): Promise<PackageSearchResult[]> {
  if (!query.trim()) return [];

  try {
    const response = await fetch(
      `https://esm.sh/packages?q=${encodeURIComponent(query)}&limit=10`
    );
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.map((item: Record<string, string>) => ({
      name: item.name ?? item.package ?? query,
      description: item.description ?? "",
      version: item.version ?? "latest",
    }));
  } catch {
    return [{ name: query, description: "Add from npm registry", version: "latest" }];
  }
}

export async function resolvePackageVersion(name: string): Promise<string | undefined> {
  try {
    const response = await fetch(`https://esm.sh/${name}`);
    if (response.ok) return "latest";
  } catch {
    // ignore
  }
  return undefined;
}
