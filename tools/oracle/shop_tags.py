# Tags acting at round start (Juggle) and when the shop opens (Uncommon,
# Coupon), then buying a booster.
G = Game("TAG00010").start_run()
for k in ['tag_juggle', 'tag_uncommon', 'tag_coupon']:
    G.do({"cmd": "add_tag", "key": k})
run(G, 'select_blind (Juggle Tag)', lambda: G.act_select_blind())
G.do({"cmd": "cheat", "win": True})
run(G, 'cash_out (Uncommon and Coupon Tags)', lambda: G.act_cash_out())
run(G, 'buy a booster', lambda: G.act_buy('shop_booster', 0))
