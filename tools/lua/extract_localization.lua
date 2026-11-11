-- The game's text in every language it ships, as JSON for the front end
-- (loaded when the player picks a language; English is also in game.json).
--
--   luajit tools/lua/extract_localization.lua <out dir>
--
-- (set BALATRO_SRC to the game directory if it isn't ../balatro_src)
local here = debug.getinfo(1, 'S').source:match('^@(.*/)') or './'
local json = dofile(here .. 'json.lua')
local src = os.getenv('BALATRO_SRC') or (here .. '../../../balatro_src')
local out = assert(arg[1], 'usage: extract_localization.lua <out dir>')

local function strip(t, seen)
  if type(t) ~= 'table' then return t end
  seen = seen or {}
  if seen[t] then return nil end
  seen[t] = true
  local r = {}
  for k, v in pairs(t) do
    if type(v) == 'table' then r[k] = strip(v, seen)
    elseif type(v) ~= 'function' and type(v) ~= 'userdata' then r[k] = v end
  end
  seen[t] = nil
  return r
end

-- (Game:set_language's G.LANGUAGES, but all1/all2: the console user name's fonts)
local LANGS = { 'en-us', 'de', 'es_419', 'es_ES', 'fr', 'id', 'it', 'ja', 'ko', 'nl', 'pl', 'pt_BR', 'ru', 'zh_CN', 'zh_TW' }
for _, key in ipairs(LANGS) do
  local f = assert(io.open(src .. '/localization/' .. key .. '.lua', 'rb'))
  local code = f:read('*a')
  f:close()
  local o = assert(io.open(out .. '/' .. key .. '.json', 'wb'))
  o:write(json.encode(strip(assert(loadstring(code))())))
  o:close()
end
print('wrote ' .. #LANGS .. ' languages to ' .. out)
