_RELEASE_MODE = true
_DEMO = false
function love.conf(t)
  t.console = false
  t.title = 'Balatro'
  t.identity = 'balatro_refshot'
  t.window.width = tonumber(os.getenv('REF_W') or '2560')
  t.window.height = tonumber(os.getenv('REF_H') or '1440')
  t.window.minwidth = 100
  t.window.minheight = 100
end
