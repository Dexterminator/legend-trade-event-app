extends Control

@onready var players_container: HBoxContainer = %PlayersContainer

var inited: bool = false

func _ready() -> void:
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.standings_updated.connect(_on_standings_updated)

func _init_top_bar_players(payload: Dictionary) -> void:
	var traders: Array = payload["traders"]
	for i in range(players_container.get_child_count()):
		var trader: Dictionary = traders[i]
		var player_node: TopBarPlayer = players_container.get_child(i) as TopBarPlayer
		player_node.init(trader)

func _update_player_panels(payload: Dictionary) -> void:
	var traders: Array = payload["traders"]
	for i in range(players_container.get_child_count()):
		var trader: Dictionary = traders[i]
		var player_node: TopBarPlayer = players_container.get_child(i) as TopBarPlayer
		player_node.update(trader)

func _on_standings_updated(payload: Dictionary) -> void:
	if not inited:
		inited = true
		_init_top_bar_players(payload)
		_update_player_panels(payload)
		return

	_update_player_panels(payload)