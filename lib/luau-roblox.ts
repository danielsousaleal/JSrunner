type LuauChunk = (source: string, chunkName: string, throwOnError?: boolean) => (...args: unknown[]) => unknown;

const ROBLOX_LIBRARY = String.raw`
local vectorParts = {}
local vectorMethods = {}
local vectorMt = {
	__type = "Vector3",
	__metatable = "The metatable is locked",
}

local function formatNumber(n)
	if n ~= n then
		return "nan"
	end
	if n == math.huge then
		return "inf"
	end
	if n == -math.huge then
		return "-inf"
	end
	local text = string.format("%.6f", n)
	text = string.gsub(text, "0+$", "")
	text = string.gsub(text, "%.$", "")
	return text
end

local function vector(x, y, z)
	local self = setmetatable({}, vectorMt)
	vectorParts[self] = { X = x or 0, Y = y or 0, Z = z or 0 }
	return self
end

local function readVector(value, label)
	local parts = vectorParts[value]
	if parts == nil then
		error(label .. " must be a Vector3", 2)
	end
	return parts
end

function vectorMt.__index(self, key)
	local parts = vectorParts[self]
	if key == "X" or key == "Y" or key == "Z" then
		return parts[key]
	end
	if key == "Magnitude" then
		return math.sqrt(parts.X * parts.X + parts.Y * parts.Y + parts.Z * parts.Z)
	end
	if key == "Unit" then
		local magnitude = math.sqrt(parts.X * parts.X + parts.Y * parts.Y + parts.Z * parts.Z)
		if magnitude == 0 then
			return vector(0 / 0, 0 / 0, 0 / 0)
		end
		return vector(parts.X / magnitude, parts.Y / magnitude, parts.Z / magnitude)
	end
	local method = vectorMethods[key]
	if method ~= nil then
		return method
	end
	error(tostring(key) .. " is not a valid member of Vector3", 2)
end

function vectorMt.__newindex(_self, key)
	error(tostring(key) .. " cannot be assigned to", 2)
end

function vectorMt.__tostring(self)
	local parts = vectorParts[self]
	return formatNumber(parts.X) .. ", " .. formatNumber(parts.Y) .. ", " .. formatNumber(parts.Z)
end

function vectorMt.__eq(a, b)
	local left = vectorParts[a]
	local right = vectorParts[b]
	if left == nil or right == nil then
		return false
	end
	return left.X == right.X and left.Y == right.Y and left.Z == right.Z
end

function vectorMt.__unm(self)
	local parts = vectorParts[self]
	return vector(-parts.X, -parts.Y, -parts.Z)
end

function vectorMt.__add(a, b)
	local left = readVector(a, "Left operand")
	local right = readVector(b, "Right operand")
	return vector(left.X + right.X, left.Y + right.Y, left.Z + right.Z)
end

function vectorMt.__sub(a, b)
	local left = readVector(a, "Left operand")
	local right = readVector(b, "Right operand")
	return vector(left.X - right.X, left.Y - right.Y, left.Z - right.Z)
end

local function scaleVector(parts, scalar)
	return vector(parts.X * scalar, parts.Y * scalar, parts.Z * scalar)
end

function vectorMt.__mul(a, b)
	if vectorParts[a] ~= nil and type(b) == "number" then
		return scaleVector(vectorParts[a], b)
	end
	if type(a) == "number" and vectorParts[b] ~= nil then
		return scaleVector(vectorParts[b], a)
	end
	error("Vector3 can only be multiplied by a number", 2)
end

function vectorMt.__div(a, b)
	if vectorParts[a] ~= nil and type(b) == "number" then
		return scaleVector(vectorParts[a], 1 / b)
	end
	error("Vector3 can only be divided by a number", 2)
end

function vectorMethods.Dot(self, other)
	local left = readVector(self, "Vector3")
	local right = readVector(other, "Argument")
	return left.X * right.X + left.Y * right.Y + left.Z * right.Z
end

function vectorMethods.Cross(self, other)
	local left = readVector(self, "Vector3")
	local right = readVector(other, "Argument")
	return vector(
		left.Y * right.Z - left.Z * right.Y,
		left.Z * right.X - left.X * right.Z,
		left.X * right.Y - left.Y * right.X
	)
end

function vectorMethods.Lerp(self, other, alpha)
	local left = readVector(self, "Vector3")
	local right = readVector(other, "Argument")
	local t = alpha or 0
	return vector(
		left.X + (right.X - left.X) * t,
		left.Y + (right.Y - left.Y) * t,
		left.Z + (right.Z - left.Z) * t
	)
end

function vectorMethods.FuzzyEq(self, other, epsilon)
	local left = readVector(self, "Vector3")
	local right = readVector(other, "Argument")
	local limit = epsilon or 1e-5
	return math.abs(left.X - right.X) <= limit
		and math.abs(left.Y - right.Y) <= limit
		and math.abs(left.Z - right.Z) <= limit
end

local Vector3Lib = {}

function Vector3Lib.new(x, y, z)
	return vector(x, y, z)
end

function Vector3Lib.is(value)
	return vectorParts[value] ~= nil
end

Vector3Lib.zero = vector(0, 0, 0)
Vector3Lib.one = vector(1, 1, 1)
Vector3Lib.xAxis = vector(1, 0, 0)
Vector3Lib.yAxis = vector(0, 1, 0)
Vector3Lib.zAxis = vector(0, 0, 1)

local colorParts = {}
local colorMethods = {}
local colorMt = {
	__type = "Color3",
	__metatable = "The metatable is locked",
}

local function color(r, g, b)
	local self = setmetatable({}, colorMt)
	colorParts[self] = { R = r or 0, G = g or 0, B = b or 0 }
	return self
end

local function readColor(value, label)
	local parts = colorParts[value]
	if parts == nil then
		error(label .. " must be a Color3", 2)
	end
	return parts
end

function colorMt.__index(self, key)
	local parts = colorParts[self]
	if key == "R" or key == "G" or key == "B" then
		return parts[key]
	end
	local method = colorMethods[key]
	if method ~= nil then
		return method
	end
	error(tostring(key) .. " is not a valid member of Color3", 2)
end

function colorMt.__newindex(_self, key)
	error(tostring(key) .. " cannot be assigned to", 2)
end

function colorMt.__tostring(self)
	local parts = colorParts[self]
	return formatNumber(parts.R) .. ", " .. formatNumber(parts.G) .. ", " .. formatNumber(parts.B)
end

function colorMt.__eq(a, b)
	local left = colorParts[a]
	local right = colorParts[b]
	if left == nil or right == nil then
		return false
	end
	return left.R == right.R and left.G == right.G and left.B == right.B
end

function colorMethods.Lerp(self, other, alpha)
	local left = readColor(self, "Color3")
	local right = readColor(other, "Argument")
	local t = alpha or 0
	return color(
		left.R + (right.R - left.R) * t,
		left.G + (right.G - left.G) * t,
		left.B + (right.B - left.B) * t
	)
end

function colorMethods.ToHSV(self)
	local parts = readColor(self, "Color3")
	local r, g, b = parts.R, parts.G, parts.B
	local max = math.max(r, g, b)
	local min = math.min(r, g, b)
	local delta = max - min
	local h = 0
	if delta > 0 then
		if max == r then
			h = ((g - b) / delta) % 6
		elseif max == g then
			h = (b - r) / delta + 2
		else
			h = (r - g) / delta + 4
		end
		h = h / 6
		if h < 0 then
			h = h + 1
		end
	end
	local s = 0
	if max ~= 0 then
		s = delta / max
	end
	return h, s, max
end

local Color3Lib = {}

function Color3Lib.new(r, g, b)
	return color(r, g, b)
end

function Color3Lib.is(value)
	return colorParts[value] ~= nil
end

function Color3Lib.fromRGB(r, g, b)
	return color((r or 0) / 255, (g or 0) / 255, (b or 0) / 255)
end

function Color3Lib.fromHSV(h, s, v)
	local hue = h or 0
	local saturation = s or 0
	local value = v or 0
	local chroma = value * saturation
	local x = chroma * (1 - math.abs((hue * 6) % 2 - 1))
	local match = value - chroma
	local r, g, b = 0, 0, 0
	local sector = math.floor(hue * 6) % 6
	if sector == 0 then
		r, g, b = chroma, x, 0
	elseif sector == 1 then
		r, g, b = x, chroma, 0
	elseif sector == 2 then
		r, g, b = 0, chroma, x
	elseif sector == 3 then
		r, g, b = 0, x, chroma
	elseif sector == 4 then
		r, g, b = x, 0, chroma
	else
		r, g, b = chroma, 0, x
	end
	return color(r + match, g + match, b + match)
end

local cframeParts = {}
local cframeMethods = {}
local cframeMt = {
	__type = "CFrame",
	__metatable = "The metatable is locked",
}

local function cframe(x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22)
	local self = setmetatable({}, cframeMt)
	cframeParts[self] = {
		X = x or 0,
		Y = y or 0,
		Z = z or 0,
		r00 = r00 or 1,
		r01 = r01 or 0,
		r02 = r02 or 0,
		r10 = r10 or 0,
		r11 = r11 or 1,
		r12 = r12 or 0,
		r20 = r20 or 0,
		r21 = r21 or 0,
		r22 = r22 or 1,
	}
	return self
end

local function readCFrame(value, label)
	local parts = cframeParts[value]
	if parts == nil then
		error(label .. " must be a CFrame", 2)
	end
	return parts
end

local function transformPoint(parts, point)
	return vector(
		parts.r00 * point.X + parts.r01 * point.Y + parts.r02 * point.Z + parts.X,
		parts.r10 * point.X + parts.r11 * point.Y + parts.r12 * point.Z + parts.Y,
		parts.r20 * point.X + parts.r21 * point.Y + parts.r22 * point.Z + parts.Z
	)
end

local function compose(left, right)
	return cframe(
		left.r00 * right.X + left.r01 * right.Y + left.r02 * right.Z + left.X,
		left.r10 * right.X + left.r11 * right.Y + left.r12 * right.Z + left.Y,
		left.r20 * right.X + left.r21 * right.Y + left.r22 * right.Z + left.Z,
		left.r00 * right.r00 + left.r01 * right.r10 + left.r02 * right.r20,
		left.r00 * right.r01 + left.r01 * right.r11 + left.r02 * right.r21,
		left.r00 * right.r02 + left.r01 * right.r12 + left.r02 * right.r22,
		left.r10 * right.r00 + left.r11 * right.r10 + left.r12 * right.r20,
		left.r10 * right.r01 + left.r11 * right.r11 + left.r12 * right.r21,
		left.r10 * right.r02 + left.r11 * right.r12 + left.r12 * right.r22,
		left.r20 * right.r00 + left.r21 * right.r10 + left.r22 * right.r20,
		left.r20 * right.r01 + left.r21 * right.r11 + left.r22 * right.r21,
		left.r20 * right.r02 + left.r21 * right.r12 + left.r22 * right.r22
	)
end

local function inverseParts(parts)
	local r00, r01, r02 = parts.r00, parts.r10, parts.r20
	local r10, r11, r12 = parts.r01, parts.r11, parts.r21
	local r20, r21, r22 = parts.r02, parts.r12, parts.r22
	return cframe(
		-(r00 * parts.X + r01 * parts.Y + r02 * parts.Z),
		-(r10 * parts.X + r11 * parts.Y + r12 * parts.Z),
		-(r20 * parts.X + r21 * parts.Y + r22 * parts.Z),
		r00, r01, r02,
		r10, r11, r12,
		r20, r21, r22
	)
end

function cframeMt.__index(self, key)
	local parts = cframeParts[self]
	if key == "X" or key == "Y" or key == "Z" then
		return parts[key]
	end
	if key == "Position" then
		return vector(parts.X, parts.Y, parts.Z)
	end
	if key == "RightVector" then
		return vector(parts.r00, parts.r10, parts.r20)
	end
	if key == "UpVector" then
		return vector(parts.r01, parts.r11, parts.r21)
	end
	if key == "LookVector" then
		return vector(-parts.r02, -parts.r12, -parts.r22)
	end
	local method = cframeMethods[key]
	if method ~= nil then
		return method
	end
	error(tostring(key) .. " is not a valid member of CFrame", 2)
end

function cframeMt.__newindex(_self, key)
	error(tostring(key) .. " cannot be assigned to", 2)
end

function cframeMt.__tostring(self)
	local parts = cframeParts[self]
	local values = {
		parts.X, parts.Y, parts.Z,
		parts.r00, parts.r01, parts.r02,
		parts.r10, parts.r11, parts.r12,
		parts.r20, parts.r21, parts.r22,
	}
	local text = {}
	for index, value in ipairs(values) do
		text[index] = formatNumber(value)
	end
	return table.concat(text, ", ")
end

function cframeMt.__mul(a, b)
	local left = cframeParts[a]
	if left == nil then
		error("CFrame can only be multiplied by a CFrame or Vector3", 2)
	end
	local rightFrame = cframeParts[b]
	if rightFrame ~= nil then
		return compose(left, rightFrame)
	end
	local point = vectorParts[b]
	if point ~= nil then
		return transformPoint(left, point)
	end
	error("CFrame can only be multiplied by a CFrame or Vector3", 2)
end

function cframeMethods.Inverse(self)
	return inverseParts(readCFrame(self, "CFrame"))
end

function cframeMethods.ToWorldSpace(self, other)
	return compose(readCFrame(self, "CFrame"), readCFrame(other, "Argument"))
end

function cframeMethods.ToObjectSpace(self, other)
	return compose(inverseParts(readCFrame(self, "CFrame")), readCFrame(other, "Argument"))
end

function cframeMethods.PointToWorldSpace(self, point)
	return transformPoint(readCFrame(self, "CFrame"), readVector(point, "Argument"))
end

function cframeMethods.PointToObjectSpace(self, point)
	local inverted = inverseParts(readCFrame(self, "CFrame"))
	return transformPoint(cframeParts[inverted], readVector(point, "Argument"))
end

local function normalize3(x, y, z)
	local magnitude = math.sqrt(x * x + y * y + z * z)
	if magnitude < 1e-8 then
		return 0, 0, 0
	end
	return x / magnitude, y / magnitude, z / magnitude
end

function cframeMethods.Lerp(self, other, alpha)
	local t = alpha or 0
	if t == 0 then
		return self
	end
	if t == 1 then
		return other
	end
	local left = readCFrame(self, "CFrame")
	local right = readCFrame(other, "Argument")
	local function blend(a, b)
		return a + (b - a) * t
	end
	local rx, ry, rz = normalize3(
		blend(left.r00, right.r00),
		blend(left.r10, right.r10),
		blend(left.r20, right.r20)
	)
	local ux = blend(left.r01, right.r01) - rx * (rx * blend(left.r01, right.r01) + ry * blend(left.r11, right.r11) + rz * blend(left.r21, right.r21))
	local uy = blend(left.r11, right.r11) - ry * (rx * blend(left.r01, right.r01) + ry * blend(left.r11, right.r11) + rz * blend(left.r21, right.r21))
	local uz = blend(left.r21, right.r21) - rz * (rx * blend(left.r01, right.r01) + ry * blend(left.r11, right.r11) + rz * blend(left.r21, right.r21))
	ux, uy, uz = normalize3(ux, uy, uz)
	local bx = ry * uz - rz * uy
	local by = rz * ux - rx * uz
	local bz = rx * uy - ry * ux
	return cframe(
		blend(left.X, right.X),
		blend(left.Y, right.Y),
		blend(left.Z, right.Z),
		rx, ux, bx,
		ry, uy, by,
		rz, uz, bz
	)
end

local function lookAt(position, target, up)
	local origin = readVector(position, "Position")
	local focus = readVector(target, "Target")
	local upParts = vectorParts[up] or vectorParts[Vector3Lib.yAxis]
	local direction = vector(focus.X - origin.X, focus.Y - origin.Y, focus.Z - origin.Z)
	if direction.Magnitude < 1e-8 then
		return cframe(origin.X, origin.Y, origin.Z)
	end
	local look = direction.Unit
	local right = look:Cross(vector(upParts.X, upParts.Y, upParts.Z))
	if right.Magnitude < 1e-6 then
		right = look:Cross(Vector3Lib.xAxis)
	end
	if right.Magnitude < 1e-6 then
		right = look:Cross(Vector3Lib.zAxis)
	end
	right = right.Unit
	local newUp = right:Cross(look).Unit
	return cframe(
		origin.X, origin.Y, origin.Z,
		right.X, newUp.X, -look.X,
		right.Y, newUp.Y, -look.Y,
		right.Z, newUp.Z, -look.Z
	)
end

local CFrameLib = {}

function CFrameLib.is(value)
	return cframeParts[value] ~= nil
end

function CFrameLib.new(a, b, c, r00, r01, r02, r10, r11, r12, r20, r21, r22)
	if a == nil then
		return cframe(0, 0, 0)
	end
	if vectorParts[a] ~= nil and b == nil then
		local parts = vectorParts[a]
		return cframe(parts.X, parts.Y, parts.Z)
	end
	if vectorParts[a] ~= nil and vectorParts[b] ~= nil and c == nil then
		return lookAt(a, b)
	end
	if vectorParts[a] ~= nil and vectorParts[b] ~= nil and vectorParts[c] ~= nil then
		return lookAt(a, b, c)
	end
	if r00 == nil then
		return cframe(a or 0, b or 0, c or 0)
	end
	return cframe(a or 0, b or 0, c or 0, r00, r01, r02, r10, r11, r12, r20, r21, r22)
end

function CFrameLib.Angles(rx, ry, rz)
	local cx, sx = math.cos(rx or 0), math.sin(rx or 0)
	local cy, sy = math.cos(ry or 0), math.sin(ry or 0)
	local cz, sz = math.cos(rz or 0), math.sin(rz or 0)
	return cframe(
		0, 0, 0,
		cy * cz, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
		cy * sz, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
		-sy, cy * sx, cy * cx
	)
end

function CFrameLib.lookAt(position, target, up)
	return lookAt(position, target, up)
end

CFrameLib.identity = cframe(0, 0, 0)

local objects = {}
local instanceMethods = {}
local instanceMt = {
	__type = "Instance",
	__metatable = "The metatable is locked",
}
local world
local listMt = {
	__tostring = function(list)
		local names = {}
		for index, child in ipairs(list) do
			names[index] = objects[child].Name
		end
		return "{" .. table.concat(names, ", ") .. "}"
	end,
}

local function createInstance(className, name)
	local self = setmetatable({}, instanceMt)
	objects[self] = {
		ClassName = className,
		Name = name or className,
		Parent = nil,
		Children = {},
		Destroyed = false,
	}
	return self
end

local function removeChild(parent, child)
	local nextChildren = {}
	for _, item in ipairs(objects[parent].Children) do
		if item ~= child then
			table.insert(nextChildren, item)
		end
	end
	objects[parent].Children = nextChildren
end

local function setParent(self, parent)
	local data = objects[self]
	if parent ~= nil and objects[parent] == nil then
		error("Parent must be an Instance or nil", 2)
	end
	if parent ~= nil then
		if objects[parent].Destroyed then
			error("Cannot parent to a destroyed Instance", 2)
		end
		local cursor = parent
		while cursor ~= nil do
			if cursor == self then
				error("Attempt to set parent to itself or a descendant", 2)
			end
			cursor = objects[cursor].Parent
		end
	end
	if data.Parent ~= nil then
		removeChild(data.Parent, self)
	end
	data.Parent = parent
	if parent ~= nil then
		table.insert(objects[parent].Children, self)
	end
end

function instanceMt.__index(self, key)
	local data = objects[self]
	if data.Destroyed then
		error("This Instance has been destroyed", 2)
	end
	if key == "ClassName" or key == "Name" or key == "Parent" then
		return data[key]
	end
	if data.ClassName == "DataModel" and key == "Workspace" then
		return world
	end
	local method = instanceMethods[key]
	if method ~= nil then
		return method
	end
	error(tostring(key) .. " is not a valid member of " .. data.ClassName, 2)
end

function instanceMt.__newindex(self, key, value)
	local data = objects[self]
	if data.Destroyed then
		error("This Instance has been destroyed", 2)
	end
	if key == "Name" then
		if type(value) ~= "string" then
			error("Name must be a string", 2)
		end
		data.Name = value
		return
	end
	if key == "Parent" then
		setParent(self, value)
		return
	end
	if key == "ClassName" then
		error("ClassName is read-only", 2)
	end
	error(tostring(key) .. " is not a valid member of " .. data.ClassName, 2)
end

function instanceMt.__tostring(self)
	return instanceMethods.GetFullName(self)
end

function instanceMethods.GetChildren(self)
	local data = objects[self]
	if data.Destroyed then
		error("This Instance has been destroyed", 2)
	end
	local list = {}
	for index, child in ipairs(data.Children) do
		list[index] = child
	end
	return setmetatable(list, listMt)
end

function instanceMethods.FindFirstChild(self, name, recursive)
	local data = objects[self]
	if data.Destroyed then
		error("This Instance has been destroyed", 2)
	end
	if type(name) ~= "string" then
		error("FindFirstChild expects a string name", 2)
	end
	for _, child in ipairs(data.Children) do
		if objects[child].Name == name then
			return child
		end
	end
	if recursive then
		for _, child in ipairs(data.Children) do
			local found = instanceMethods.FindFirstChild(child, name, true)
			if found ~= nil then
				return found
			end
		end
	end
	return nil
end

function instanceMethods.GetFullName(self)
	local data = objects[self]
	if data.Destroyed then
		error("This Instance has been destroyed", 2)
	end
	if data.Parent == nil or objects[data.Parent].ClassName == "DataModel" then
		return data.Name
	end
	return instanceMethods.GetFullName(data.Parent) .. "." .. data.Name
end

function instanceMethods.IsA(self, className)
	local data = objects[self]
	if data.Destroyed then
		error("This Instance has been destroyed", 2)
	end
	return className == data.ClassName or className == "Instance"
end

function instanceMethods.Destroy(self)
	local data = objects[self]
	if data == nil or data.Destroyed then
		return
	end
	if data.ClassName == "DataModel" or data.ClassName == "Workspace" then
		error("Cannot destroy " .. data.ClassName, 2)
	end
	if data.Parent ~= nil then
		setParent(self, nil)
	end
	local children = data.Children
	data.Children = {}
	for _, child in ipairs(children) do
		instanceMethods.Destroy(child)
	end
	data.Destroyed = true
end

function instanceMethods.GetService(self, name)
	local data = objects[self]
	if data.ClassName ~= "DataModel" then
		error("GetService is not a valid member of " .. data.ClassName, 2)
	end
	if name == "Workspace" then
		return world
	end
	error(string.format('GetService("%s") is not available in this sandbox', tostring(name)), 2)
end

local InstanceLib = {}

function InstanceLib.is(value)
	return objects[value] ~= nil
end

function InstanceLib.new(className, parent)
	if className ~= "Folder" then
		error(string.format('Instance.new("%s") is not available in this sandbox', tostring(className)), 2)
	end
	local folder = createInstance("Folder", "Folder")
	if parent ~= nil then
		folder.Parent = parent
	end
	return folder
end

local dataModel = createInstance("DataModel", "Game")
world = createInstance("Workspace", "Workspace")
world.Parent = dataModel

local hostWarn = warn
function warn(...)
	local parts = {}
	for index = 1, select("#", ...) do
		local value = select(index, ...)
		if value == nil then
			parts[index] = "nil"
		else
			parts[index] = tostring(value)
		end
	end
	hostWarn(table.concat(parts, "\t"))
end

Vector3 = Vector3Lib
CFrame = CFrameLib
Color3 = Color3Lib
Instance = InstanceLib
game = dataModel
workspace = world
`;

export async function installRobloxSandbox(state: {
  loadstring: LuauChunk;
}): Promise<(value: unknown) => Promise<string>> {
  await state.loadstring(ROBLOX_LIBRARY, "roblox.luau", true)();
  const loaded = await state.loadstring(
    "return function(value)\n\tif value == nil then\n\t\treturn \"nil\"\n\tend\n\treturn tostring(value)\nend\n",
    "show.luau",
    true
  )();
  const show = (Array.isArray(loaded) ? loaded[0] : loaded) as (value: unknown) => Promise<unknown> | unknown;
  return async (value: unknown) => {
    const shown = await show(value);
    const text = Array.isArray(shown) ? shown[0] : shown;
    return text == null ? "nil" : String(text);
  };
}
