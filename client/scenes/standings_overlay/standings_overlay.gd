extends Node2D

@onready var standings_container: VBoxContainer = %StandingsContainer
@onready var panels_by_player_index: Array = standings_container.get_children()
var inited := false

func _ready() -> void:
	SignalBus.standings_updated.connect(_on_standings_updated)
	for i in range(standings_container.get_child_count()):
		var p: PlayerPanel = standings_container.get_child(i)
		p.name_label.text = "Player %d" % (i + 1)

func sort_by_score() -> void:
	var panels := standings_container.get_children()

	panels.sort_custom(func(a: PlayerPanel, b: PlayerPanel) -> int:
		return a.score > b.score # descending
	)

	for i in panels.size():
		standings_container.move_child(panels[i], i)

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

	# 4️⃣ Wait for container to recalculate layout
	await get_tree().process_frame

	# 5️⃣ Animate from old position to new layout position
	for p: PlayerPanel in panels:
		var new_y: float = p.position.y
		p.position.y = old_positions[p]

		create_tween().tween_property(
			p,
			"position:y",
			new_y,
			1.0
		).set_trans(Tween.TRANS_CUBIC) \
		 .set_ease(Tween.EASE_IN_OUT)

func _on_standings_updated(_text: String) -> void:
	if not inited:
		inited = true
		return
	for child: PlayerPanel in standings_container.get_children():
		child.set_score(randi_range(0, 1000000))
		if child.state == PlayerPanel.State.EXPANDED:
			child.collapse()

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
