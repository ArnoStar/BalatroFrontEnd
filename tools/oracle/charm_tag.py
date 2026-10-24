# Skipping the Small Blind for a Charm Tag (its Mega Arcana Pack opens), then a
# Charm Tag and a Boss Tag waiting for the next blind select.
G = Game("TAG00010").start_run()
run(G, 'skip_blind (Charm Tag)', lambda: G.act_skip_blind())
run(G, 'skip_pack', lambda: G.act_skip_pack())
G.act_select_blind()
G.do({"cmd": "cheat", "win": True})
G.act_cash_out()
G.do({"cmd": "add_tag", "key": "tag_charm"})
G.do({"cmd": "add_tag", "key": "tag_boss"})
run(G, 'end_shop (Charm and Boss Tags)', lambda: G.act_end_shop())
run(G, 'skip_pack (the Boss Tag rerolls)', lambda: G.act_skip_pack())
