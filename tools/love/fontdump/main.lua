-- Dump a TrueType font as LÖVE 11 rasterizes it (glyph bitmaps, bearings,
-- advances, kerning and line metrics), so the browser renders text exactly
-- like the game.
--   SDL_VIDEODRIVER=offscreen FONT=path/to/font.ttf SIZE=200 OUT=dir love tools/love/fontdump
-- CPS=file: the code points to dump (one per line; default: Latin-1 and a few
-- marks). BITMAP_SCALE=0.5: glyph bitmaps rasterized at half the size (the
-- metrics stay those of SIZE: the text is laid out the same), for fonts with
-- thousands of glyphs. Atlases are pages of at most 4096 pixels high:
-- NAME.png, NAME_1.png ...
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
  local cps_file = os.getenv('CPS')
  if cps_file then
    for line in io.lines(cps_file) do
      local cp = tonumber(line)
      if cp then cps[#cps + 1] = cp end
    end
  else
    for cp = 32, 126 do cps[#cps + 1] = cp end
    for cp = 160, 255 do cps[#cps + 1] = cp end
    for _, cp in ipairs({0x2019, 0x2018, 0x201C, 0x201D, 0x2014, 0x2013, 0x2026, 0x2022, 0x20AC}) do cps[#cps + 1] = cp end
  end
  local bscale = tonumber(os.getenv('BITMAP_SCALE') or '1')
  local brast = bscale ~= 1 and love.font.newRasterizer(fd, math.floor(size * bscale + 0.5)) or rast

  -- pack glyphs in rows with 2px padding (as LÖVE does), on pages of at most MAX_H pixels
  local PAD = 2
  local atlas_w, MAX_H = 2048, 4096
  local x, y, row_h, page = PAD, PAD, 0, 0
  local glyphs, placed, heights = {}, {}, {}
  for _, cp in ipairs(cps) do
    if rast:hasGlyphs(utf8char(cp)) or cp == 32 then
      local gd = rast:getGlyphData(cp)
      local w, h = gd:getDimensions()
      local bx, by = gd:getBearing()
      local bgd = brast == rast and gd or brast:getGlyphData(cp)
      local bw, bh = bgd:getDimensions()
      if x + bw + PAD > atlas_w then x = PAD; y = y + row_h + PAD; row_h = 0 end
      if y + bh + PAD > MAX_H then heights[page] = y; page = page + 1; x, y, row_h = PAD, PAD, 0 end
      local g = { cp = cp, w = w, h = h, bx = bx, by = by, adv = gd:getAdvance(),
        spacing = font:getWidth(utf8char(cp)), x = x, y = y, page = page }
      if brast ~= rast then g.bw, g.bh = bw, bh end
      glyphs[#glyphs + 1] = g
      placed[#placed + 1] = { gd = bgd, x = x, y = y, w = bw, h = bh, page = page }
      x = x + bw + PAD
      row_h = math.max(row_h, bh)
    end
  end
  heights[page] = y + row_h + PAD
  local atlas_h = heights[0]
  local pages = {}
  for p = 0, page do pages[p] = love.image.newImageData(atlas_w, heights[p]) end
  for _, p in ipairs(placed) do
    if p.w > 0 and p.h > 0 then
      local img = pages[p.page]
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
  local page_h = {}
  for p = 0, page do
    writefile(out .. '/' .. name .. (p == 0 and '' or '_' .. p) .. '.png', pages[p]:encode('png'):getString())
    page_h[#page_h + 1] = tostring(heights[p])
  end

  local kern = {}
  -- (kerning pairs of thousands of glyphs: only between the first 400, enough for the Latin text in them)
  local kerned = {}
  for i = 1, math.min(#glyphs, 400) do kerned[i] = glyphs[i] end
  for _, a in ipairs(kerned) do
    for _, b in ipairs(kerned) do
      local k = font:getKerning(utf8char(a.cp), utf8char(b.cp))
      if k ~= 0 then kern[#kern + 1] = string.format('[%d,%d,%s]', a.cp, b.cp, tostring(k)) end
    end
  end

  local parts = {}
  for _, g in ipairs(glyphs) do
    local extra = ''
    if g.page ~= 0 then extra = extra .. string.format(',"page":%d', g.page) end
    if g.bw then extra = extra .. string.format(',"bw":%d,"bh":%d', g.bw, g.bh) end
    parts[#parts + 1] = string.format('{"cp":%d,"w":%d,"h":%d,"bx":%d,"by":%d,"adv":%s,"spacing":%d,"x":%d,"y":%d%s}',
      g.cp, g.w, g.h, g.bx, g.by, tostring(g.adv), g.spacing, g.x, g.y, extra)
  end
  local json = string.format('{"size":%d,"height":%s,"baseline":%s,"ascent":%s,"descent":%s,"lineHeight":%s,"atlasW":%d,"atlasH":%d,"pageH":[%s],"bitmapScale":%s,"rastHeight":%s,"rastAscent":%s,"rastDescent":%s,\n"glyphs":[%s],\n"kerning":[%s]}',
    size, tostring(font:getHeight()), tostring(font:getBaseline()), tostring(font:getAscent()), tostring(font:getDescent()),
    tostring(font:getLineHeight()), atlas_w, atlas_h, table.concat(page_h, ','), tostring(bscale), tostring(rast:getHeight()), tostring(rast:getAscent()), tostring(rast:getDescent()),
    table.concat(parts, ',\n'), table.concat(kern, ','))
  writefile(out .. '/' .. name .. '.json', json)
  if os.getenv('NO_REFERENCE') then
    print('glyphs', #glyphs, 'pages', page + 1, 'height', font:getHeight())
    love.event.quit()
    return
  end

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
