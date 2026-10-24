-- Extract the static data the user interface needs from the original Balatro
-- source into JSON: item prototypes (with their sprite positions), pools,
-- challenges and the English localization.
--
--   luajit tools/lua/extract_ui_data.lua src/data/game.json
--
-- (set BALATRO_SRC to the game directory if it isn't ../balatro_src)
-- boot.lua and json.lua come from BalatroEngine's tools/lua.
local here = debug.getinfo(1, 'S').source:match('^@(.*/)') or './'
if not os.getenv('BALATRO_SRC') then
  -- tools/lua -> ../../../balatro_src
  local src = here .. '../../../balatro_src'
  local ok = io.open(src .. '/game.lua', 'rb')
  if ok then ok:close() end
end
local boot = dofile(here .. 'boot.lua')
local json = dofile(here .. 'json.lua')

-- prototype defaults: unlock and discovery state as shipped
boot.init({ profile = 'fresh' })

local function strip(t, seen)
  if type(t) ~= 'table' then return t end
  seen = seen or {}
  if seen[t] then return nil end
  seen[t] = true
  local out = {}
  for k, v in pairs(t) do
    if type(v) == 'table' then out[k] = strip(v, seen)
    elseif type(v) ~= 'function' and type(v) ~= 'userdata' then out[k] = v end
  end
  seen[t] = nil
  return out
end

local function keys_of(list)
  local out = {}
  for i, v in ipairs(list) do out[i] = v.key end
  return out
end

local data = { version = G.VERSION }

data.P_CENTERS = strip(G.P_CENTERS)
data.P_CARDS = strip(G.P_CARDS)
data.P_BLINDS = strip(G.P_BLINDS)
data.P_TAGS = strip(G.P_TAGS)
data.P_SEALS = strip(G.P_SEALS)
data.P_STAKES = strip(G.P_STAKES)
data.b_undiscovered = strip(G.b_undiscovered)
data.tag_undiscovered = strip(G.tag_undiscovered)

data.P_CENTER_POOLS = {}
for k, v in pairs(G.P_CENTER_POOLS) do data.P_CENTER_POOLS[k] = keys_of(v) end
data.P_JOKER_RARITY_POOLS = {}
for i, v in ipairs(G.P_JOKER_RARITY_POOLS) do data.P_JOKER_RARITY_POOLS[i] = keys_of(v) end

data.CHALLENGES = strip(G.CHALLENGES)

-- the raw localization table (parsed again by the front end, as init_localization does)
local loc_src = assert(io.open(boot.src .. '/localization/en-us.lua', 'rb')):read('*a')
data.localization = strip(assert(loadstring(loc_src))())

local out = arg[1] or 'game.json'
local f = assert(io.open(out, 'wb'))
f:write(json.encode(data))
f:close()
print('wrote ' .. out)
