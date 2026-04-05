extends Node2D

@onready var players_container: HBoxContainer = %PlayersContainer

var inited: bool = false

func _ready() -> void:
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