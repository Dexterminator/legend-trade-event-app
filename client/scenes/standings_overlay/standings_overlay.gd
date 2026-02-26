extends Node2D

@onready var standings_container: VBoxContainer = %StandingsContainer

func _ready() -> void:
	SignalBus.standings_updated.connect(_on_standings_updated)
	for i in range(standings_container.get_child_count()):
		var p: PlayerPanel = standings_container.get_child(i)
		print(p)
		p.name_label.text = "Player %d" % (i + 1)

func sort_by_score() -> void:
	var panels := standings_container.get_children()

	panels.sort_custom(func(a: PlayerPanel, b: PlayerPanel) -> int:
		return a.score > b.score # descending
	)

	for i in panels.size():
		standings_container.move_child(panels[i], i)

func _on_standings_updated(_text: String) -> void:
	for child: PlayerPanel in standings_container.get_children():
		child.set_score(randi_range(0, 1000000))

	sort_by_score()

func _input(event: InputEvent) -> void:
	if event is InputEventKey:
		var key_event := event as InputEventKey
		if key_event.pressed:
			var key_index := key_event.keycode - KEY_1
			if 0 <= key_index and key_index <= 7:
				var child: PlayerPanel = standings_container.get_child(key_index)
				child.toggle_expanded()
