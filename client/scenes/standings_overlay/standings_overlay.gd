extends Node2D

@onready var standings_container: VBoxContainer = %StandingsContainer
@onready var panels_by_player_index: Array = standings_container.get_children()
var inited := false

func _ready() -> void:
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, .3).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_CUBIC)
	SignalBus.standings_updated.connect(_on_standings_updated)
	for i in range(standings_container.get_child_count()):
		var p: PlayerPanel = standings_container.get_child(i)
		p.name_label.text = "Player %d" % (i + 1)
		p.set_score(randi_range(0, 1000000))
	_set_placements()

func sort_by_score() -> void:
	var panels := standings_container.get_children()

	panels.sort_custom(func(a: PlayerPanel, b: PlayerPanel) -> int:
		return a.score > b.score # descending
	)

	for i in panels.size():
		standings_container.move_child(panels[i], i)

func _set_placements() -> void:
	var panels := standings_container.get_children()
	for i in panels.size():
		var panel: PlayerPanel = panels[i]
		panel.placement_label.text = "%d" % (i + 1)

func animate_sort(container: VBoxContainer) -> void:
	var panels := container.get_children()

	# 1️⃣ Store current layout positions
	var old_positions := {}
	for p: PlayerPanel in panels:
		old_positions[p] = p.position.y

	# 2️⃣ Sort by score (descending)
	panels.sort_custom(func(a: PlayerPanel, b: PlayerPanel) -> int:
		return a.score > b.score # descending
	)

	# 3️⃣ Apply new tree order
	for i in panels.size():
		container.move_child(panels[i], i)

	RenderingServer.render_loop_enabled = false
	# 4️⃣ Wait for container to recalculate layout
	await get_tree().process_frame
	RenderingServer.render_loop_enabled = true

	var animation_time := 1.0
	# 5️⃣ Animate from old position to new layout position
	for p: PlayerPanel in panels:
		var new_y: float = p.position.y
		p.position.y = old_positions[p]

		create_tween().tween_property(
			p,
			"position:y",
			new_y,
			animation_time
		).set_trans(Tween.TRANS_CUBIC) \
		 .set_ease(Tween.EASE_IN_OUT)

	# 6️⃣ If placement is different, animate the placement label
	await Utils.wait(self , animation_time * 0.1)
	for i in panels.size():
		var panel: PlayerPanel = panels[i]
		var new_placement: int = i + 1
		var prev_placement: int = int(panel.placement_label.text)
		if prev_placement != new_placement:
			if new_placement < prev_placement:
				panel.z_index = 1
			else:
				panel.z_index = -1
			# Fade out old placement
			var t := create_tween()
			t.tween_property(panel.placement_label, "modulate:a", 0.0, 0.4
			).set_trans(Tween.TRANS_CUBIC) \
			 .set_ease(Tween.EASE_IN_OUT)
			# After fade out, update text and fade in new placement
			t.tween_callback(func() -> void: panel.placement_label.text = str(new_placement))
			# Fade in new placement
			t.tween_property(panel.placement_label, "modulate:a", 1.0, 0.4
			).set_trans(Tween.TRANS_CUBIC) \
			 .set_ease(Tween.EASE_IN_OUT)
		else:
			panel.z_index = 0

func _on_standings_updated(_text: String) -> void:
	if not inited:
		inited = true
		return
	for child: PlayerPanel in standings_container.get_children():
		if randf() < 0.15:
			child.set_score(randi_range(0, 1000000))

	await Utils.wait(self , 0.7)
	animate_sort(standings_container)

func _input(event: InputEvent) -> void:
	if event is InputEventKey:
		var key_event := event as InputEventKey
		if key_event.pressed:
			var key_index := key_event.keycode - KEY_1
			if 0 <= key_index and key_index <= 7:
				var child: PlayerPanel = panels_by_player_index[key_index]
				child.toggle_expanded()
