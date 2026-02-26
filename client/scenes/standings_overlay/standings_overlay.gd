extends Node2D

@onready var standings_container: VBoxContainer = %StandingsContainer

func _ready() -> void:
	SignalBus.standings_updated.connect(_on_standings_updated)

func _on_standings_updated(_text: String) -> void:
	pass

func _input(event: InputEvent) -> void:
	if event is InputEventKey:
		var key_event := event as InputEventKey
		if key_event.pressed:
			var key_index := key_event.keycode - KEY_1
			if 0 <= key_index and key_index <= 7:
				var child: PlayerPanel = standings_container.get_child(key_index)
				child.toggle_expanded()
