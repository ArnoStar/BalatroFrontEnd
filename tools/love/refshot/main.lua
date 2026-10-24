-- Runs the original game headlessly at a fixed 60 fps with scripted input,
-- saving screenshots, to compare the front end with the real thing.
--   tools/love/refshot/run.sh <script.lua> <out_dir>
-- The script returns a list of steps: {frame = N, click = {x, y}} /
-- {frame = N, move = {x, y}} / {frame = N, key = 'escape'} / {frame = N, shot = 'name'} /
-- {frame = N, lua = function() ... end} / {frame = N, quit = true}
local FRAME = 0
local MX, MY = 0, 0
local OUT = os.getenv('REF_OUT') or '.'
local steps = assert(loadfile(os.getenv('REF_SCRIPT')))()

love.timer.step = function() return 1 / 60 end
love.timer.getTime = function() return FRAME / 60 end
love.timer.sleep = function() end
love.mouse.getPosition = function() return MX, MY end
love.mouse.getX = function() return MX end
love.mouse.getY = function() return MY end

-- keep the window conf.lua created (the game would switch to the desktop's size)
love.window.updateMode = function() return true end

require 'main_orig'

-- a fully unlocked profile with the tutorial done, as the front end shows
local start_up = Game.start_up
function Game:start_up()
  start_up(self)
end
local orig_load = love.load
function love.load(...)
  orig_load(...)
  G.F_NO_ACHIEVEMENTS = true
  G.SETTINGS.tutorial_complete = true
  G.SETTINGS.tutorial_progress = nil
  for _, v in pairs(G.P_CENTERS) do v.unlocked = true; v.discovered = true; v.alerted = true end
  for _, v in pairs(G.P_BLINDS) do v.discovered = true; v.alerted = true end
  for _, v in pairs(G.P_TAGS) do v.discovered = true; v.alerted = true end
  for _, v in pairs(G.P_SEALS) do v.discovered = true; v.alerted = true end
  G.P_LOCKED = {}
end

local pending_release = nil
local orig_update = love.update
function love.update(dt)
  FRAME = FRAME + 1
  if pending_release then love.mousereleased(pending_release[1], pending_release[2], 1); pending_release = nil end
  for _, s in ipairs(steps) do
    if s.frame == FRAME then
      if s.move then MX, MY = s.move[1], s.move[2]; love.mousemoved(MX, MY, 0, 0) end
      if s.click then
        MX, MY = s.click[1], s.click[2]
        love.mousemoved(MX, MY, 0, 0)
        love.mousepressed(MX, MY, 1)
        pending_release = {MX, MY}
      end
      if s.key then love.keypressed(s.key); love.keyreleased(s.key) end
      if s.lua then s.lua() end
    end
  end
  orig_update(dt)
end

local orig_draw = love.draw
function love.draw()
  orig_draw()
  for _, s in ipairs(steps) do
    if s.frame == FRAME and s.shot then
      love.graphics.captureScreenshot(function(img)
        local f = io.open(OUT .. '/' .. s.shot .. '.png', 'wb')
        f:write(img:encode('png'):getString())
        f:close()
      end)
    end
    if s.frame == FRAME and s.quit then love.event.quit() end
  end
end
