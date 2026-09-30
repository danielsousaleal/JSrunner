export function isLuauPath(path: string): boolean {
  return /\.(luau|lua)$/i.test(path);
}

export const LUAU_SAMPLE = `-- Luau, the language Roblox uses.
-- Run with the play button or Ctrl+Enter.
-- require("./other") loads another .luau file in this project.
-- This sandbox includes Vector3, CFrame, Color3, Folder, and workspace.
-- Players, physics, and the rest of the Roblox engine are not here.

local props = Instance.new("Folder")
props.Name = "Props"
props.Parent = workspace

local point = Vector3.new(1, 2, 3)
print(props:GetFullName(), point + Vector3.yAxis)
`;

export function formatLuauValue(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return "nil";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "function") return "function";
  if (depth >= 2) return "{...}";
  if (isLuauTable(value)) {
    try {
      const keys = value.keys();
      const shown = keys.slice(0, 8).map((key) => {
        return `${String(key)} = ${formatLuauValue(value.get(key), depth + 1)}`;
      });
      if (keys.length > 8) shown.push("...");
      return `{${shown.join(", ")}}`;
    } catch {
      return "{...}";
    }
  }
  return String(value);
}

export function luaString(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")}"`;
}

export function luauModuleGlobal(index: number): string {
  return `__luau_mod_${index}`;
}

export function buildLuauPrelude(
  modules: Array<{ path: string; globalName: string }>
): string {
  const rows = modules.map((module) => {
    if (!/^__luau_mod_\d+$/.test(module.globalName)) {
      throw new Error("Invalid Luau module binding");
    }
    return `\t[${luaString(module.path)}] = ${module.globalName},`;
  });
  const clears = modules.map((module) => `${module.globalName} = nil`).join("\n");

  return `local __loaded = {
${rows.join("\n")}
}
${clears}
local __cache = {}
local __loading = {}
local __current = nil

function __luau_enter(path)
	__current = path
	__loading[path] = true
end

local function __directory(path)
	return string.match(path, "^(.+)/[^/]+$") or ""
end

local function __normalize(path)
	local parts = {}
	for part in string.gmatch(path, "[^/]+") do
		if part == ".." then
			if #parts == 0 then
				error("module path escapes the project", 2)
			end
			table.remove(parts)
		elseif part ~= "." then
			table.insert(parts, part)
		end
	end
	return table.concat(parts, "/")
end

local function __candidates(spec)
	local from = __current or ""
	local raw = spec
	if string.sub(spec, 1, 1) == "/" then
		raw = string.sub(spec, 2)
	elseif string.sub(spec, 1, 2) == "./" or string.sub(spec, 1, 3) == "../" then
		local base = __directory(from)
		raw = if base == "" then spec else base .. "/" .. spec
	end
	raw = __normalize(raw)
	if string.sub(raw, -5) == ".luau" or string.sub(raw, -4) == ".lua" then
		return { raw }
	end
	return { raw .. ".luau", raw .. ".lua", raw .. "/init.luau", raw .. "/init.lua" }
end

function require(spec)
	if type(spec) ~= "string" or spec == "" then
		error("require expects a module path", 2)
	end
	local found = nil
	for _, candidate in __candidates(spec) do
		if __loaded[candidate] then
			found = candidate
			break
		end
	end
	if not found then
		error("module '" .. spec .. "' not found", 2)
	end
	local cached = __cache[found]
	if cached then
		return table.unpack(cached, 1, cached.n)
	end
	if __loading[found] then
		error("circular require of '" .. found .. "'", 2)
	end
	__loading[found] = true
	local previous = __current
	__current = found
	local packed = table.pack(__loaded[found]())
	__current = previous
	__loading[found] = nil
	__cache[found] = packed
	return table.unpack(packed, 1, packed.n)
end
`;
}

function isLuauTable(
  value: unknown
): value is { keys: () => unknown[]; get: (key: unknown) => unknown } {
  if (!value || typeof value !== "object") return false;
  const table = value as { keys?: unknown; get?: unknown };
  return typeof table.keys === "function" && typeof table.get === "function";
}
