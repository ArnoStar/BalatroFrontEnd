-- Dump a TrueType font as LÖVE 11 rasterizes it (glyph bitmaps, bearings,
-- advances, kerning and line metrics), so the browser renders text exactly
-- like the game.
--   SDL_VIDEODRIVER=offscreen FONT=path/to/font.ttf SIZE=200 OUT=dir love tools/love/fontdump
local function readfile(p) local f = assert(io.open(p, 'rb')); local s = f:read('*a'); f:close(); return s end
local function writefile(p, s) local f = assert(io.open(p, 'wb')); f:write(s); f:close() end

local function utf8char(cp)
  if cp < 0x80 then return string.char(cp)
  elseif cp < 0x800 then return string.char(0xC0 + math.floor(cp / 0x40), 0x80 + cp % 0x40)
  else return string.char(0xE0 + math.floor(cp / 0x1000), 0x80 + math.floor(cp / 0x40) % 0x40, 0x80 + cp % 0x40) end
end

function love.load()
  local font_path, size, out = os.getenv('FONT'), tonumber(os.getenv('SIZE') or '200'), os.getenv('OUT')
  local name = os.getenv('NAME') or 'font'
  local fd = love.filesystem.newFileData(readfile(font_path), 'font.ttf')
  local font = love.graphics.newFont(fd, size)
  local rast = love.font.newRasterizer(fd, size)

  local cps = {}
  for cp = 32, 126 do cps[#cps + 1] = cp end
  for cp = 160, 255 do cps[#cps + 1] = cp end
  for _, cp in ipairs({0x2019, 0x2018, 0x201C, 0x201D, 0x2014, 0x2013, 0x2026, 0x2022, 0x20AC}) do cps[#cps + 1] = cp end

  -- pack glyphs in rows with 2px padding (as LÖVE does)
  local PAD = 2
  local atlas_w = 2048
  local x, y, row_h = PAD, PAD, 0
  local glyphs, placed = {}, {}
  for _, cp in ipairs(cps) do
    if rast:hasGlyphs(utf8char(cp)) or cp == 32 then
      local gd = rast:getGlyphData(cp)
      local w, h = gd:getDimensions()
      local bx, by = gd:getBearing()
      if x + w + PAD > atlas_w then x = PAD; y = y + row_h + PAD; row_h = 0 end
      glyphs[#glyphs + 1] = { cp = cp, w = w, h = h, bx = bx, by = by, adv = gd:getAdvance(),
        spacing = font:getWidth(utf8char(cp)), x = x, y = y }
      placed[#placed + 1] = { gd = gd, x = x, y = y, w = w, h = h }
      x = x + w + PAD
      row_h = math.max(row_h, h)
    end
  end
  local atlas_h = y + row_h + PAD
  local img = love.image.newImageData(atlas_w, atlas_h)
  for _, p in ipairs(placed) do
    if p.w > 0 and p.h > 0 then
      local fmt = p.gd:getFormat()
      local s = p.gd:getString()
      for j = 0, p.h - 1 do
        for i = 0, p.w - 1 do
          local a
          if fmt == 'la8' then a = s:byte((j * p.w + i) * 2 + 2) / 255
          elseif fmt == 'rgba8' then a = s:byte((j * p.w + i) * 4 + 4) / 255
          else a = s:byte(j * p.w + i + 1) / 255 end
          img:setPixel(p.x + i, p.y + j, 1, 1, 1, a)
        end
      end
    end
  end
  writefile(out .. '/' .. name .. '.png', img:encode('png'):getString())

  local kern = {}
  for _, a in ipairs(glyphs) do
    for _, b in ipairs(glyphs) do
      local k = font:getKerning(utf8char(a.cp), utf8char(b.cp))
      if k ~= 0 then kern[#kern + 1] = string.format('[%d,%d,%s]', a.cp, b.cp, tostring(k)) end
    end
  end

  local parts = {}
  for _, g in ipairs(glyphs) do
    parts[#parts + 1] = string.format('{"cp":%d,"w":%d,"h":%d,"bx":%d,"by":%d,"adv":%s,"spacing":%d,"x":%d,"y":%d}',
      g.cp, g.w, g.h, g.bx, g.by, tostring(g.adv), g.spacing, g.x, g.y)
  end
  local json = string.format('{"size":%d,"height":%s,"baseline":%s,"ascent":%s,"descent":%s,"lineHeight":%s,"atlasW":%d,"atlasH":%d,"rastHeight":%s,"rastAscent":%s,"rastDescent":%s,\n"glyphs":[%s],\n"kerning":[%s]}',
    size, tostring(font:getHeight()), tostring(font:getBaseline()), tostring(font:getAscent()), tostring(font:getDescent()),
    tostring(font:getLineHeight()), atlas_w, atlas_h, tostring(rast:getHeight()), tostring(rast:getAscent()), tostring(rast:getDescent()),
    table.concat(parts, ',\n'), table.concat(kern, ','))
  writefile(out .. '/' .. name .. '.json', json)

  -- a reference rendering to compare the browser's text with
  local canvas = love.graphics.newCanvas(1200, 400)
  love.graphics.setCanvas(canvas)
  love.graphics.clear(0.2, 0.25, 0.3, 1)
  love.graphics.setColor(1, 1, 1, 1)
  love.graphics.draw(love.graphics.newText(font, 'Hello World! $4 +10 Mult'), 10, 10, 0, 0.3, 0.3)
  love.graphics.draw(love.graphics.newText(font, 'Hand: Flush Five 1,234'), 10, 100, 0.1, 0.17, 0.17)
  love.graphics.draw(love.graphics.newText(font, 'Small Blind'), 10, 200, 0, 0.6, 0.6)
  love.graphics.setCanvas()
  writefile(out .. '/' .. name .. '_reference.png', canvas:newImageData():encode('png'):getString())
  print('glyphs', #glyphs, 'height', font:getHeight(), 'baseline', font:getBaseline(), 'ascent', font:getAscent(), 'descent', font:getDescent(), 'kerning pairs', #kern)
  love.event.quit()
end
