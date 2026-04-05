extends Node2D

@onready var standings_container: VBoxContainer = %StandingsContainer
@onready var panels_by_player_index: Array = standings_container.get_children()
var inited := false
var sorting := false
var player_panel_by_user_name: Dictionary[String, PlayerPanel] = {}

func _ready() -> void:
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.standings_updated.connect(_on_standings_updated)


func _sort_panels_by_rank(panels: Array) -> void:
	panels.sort_custom(func(a: PlayerPanel, b: PlayerPanel) -> bool:
		if a.is_eliminated != b.is_eliminated:
			return not a.is_eliminated

		if a.rank != b.rank:
			return a.rank < b.rank

		return a.user_name_label.text.naturalnocasecmp_to(b.user_name_label.text) < 0
	)

func sort_by_rank() -> void:
	var panels := standings_container.get_children()
	_sort_panels_by_rank(panels)

	for i in panels.size():
		standings_container.move_child(panels[i], i)


func _has_position_changes(container: VBoxContainer) -> bool:
	var current_panels := container.get_children()
	var sorted_panels := current_panels.duplicate()
	_sort_panels_by_rank(sorted_panels)

	for i in current_panels.size():
		if current_panels[i] != sorted_panels[i]:
			return true

	return false

func _set_placements() -> void:
	var panels := standings_container.get_children()
	for i in panels.size():
		var panel: PlayerPanel = panels[i]
		panel.set_rank_label(i + 1)

func animate_sort(container: VBoxContainer) -> void:
	if not _has_position_changes(container):
		return

	sorting = true
	var panels := container.get_children()

	# 1️⃣ Store current layout positions
	var old_positions := {}
	for p: PlayerPanel in panels:
		old_positions[p] = p.position.y

	# 2️⃣ Sort by rank
	sort_by_rank()

	RenderingServer.render_loop_enabled = false
	# 4️⃣ Wait for container to recalculate layout
	await get_tree().process_frame
	RenderingServer.render_loop_enabled = true
	panels = container.get_children()

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
		var new_rank: int = i + 1
		var prev_rank := int(panel.rank_label.text)
		if prev_rank != new_rank:
			if new_rank < prev_rank:
				panel.z_index = 1
			else:
				panel.z_index = -1
			# Fade out old placement
			var t := create_tween()
			t.tween_property(panel.rank_container, "modulate:a", 0.0, 0.4
			).set_trans(Tween.TRANS_CUBIC) \
			 .set_ease(Tween.EASE_IN_OUT)
			# After fade out, update text and fade in new placement
			t.tween_callback(func() -> void: panel.set_rank_label(new_rank))
			# Fade in new placement
			t.tween_property(panel.rank_container, "modulate:a", 1.0, 0.4
			).set_trans(Tween.TRANS_CUBIC) \
			 .set_ease(Tween.EASE_IN_OUT)
		else:
			panel.z_index = 0
	await Utils.wait(self , animation_time * 1.1)
	sorting = false

func _init_player_panels(payload: Dictionary) -> void:
	for i in range(standings_container.get_child_count()):
		var leaderboard_player: Dictionary = payload["traders"][i]
		var p: PlayerPanel = standings_container.get_child(i)
		p.init(leaderboard_player, i + 1)
		player_panel_by_user_name[leaderboard_player["username"]] = p

func _update_player_panels(payload: Dictionary) -> void:
	for i in range(len(payload["traders"])):
		var leaderboard_player: Dictionary = payload["traders"][i]
		var p: PlayerPanel = player_panel_by_user_name[leaderboard_player["username"]]
		p._update(leaderboard_player)

func _on_standings_updated(payload: Dictionary) -> void:
	if not inited:
		inited = true
		_init_player_panels(payload)
		_update_player_panels(payload)
		return

	_update_player_panels(payload)

	if sorting:
		return

	animate_sort(standings_container)
