extends Control

@onready var headers: VBoxContainer = $HBoxContainer/Headers
@onready var players_container: HBoxContainer = %PlayersContainer

var inited: bool = false
var is_simple := false

func _ready() -> void:
	_apply_url_query_params()
	_apply_display_mode()
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.standings_updated.connect(_on_standings_updated)


func _apply_url_query_params() -> void:
	if not OS.has_feature("web"):
		return

	var query: String = JavaScriptBridge.eval("window.location.search")
	for part: String in query.trim_prefix("?").split("&"):
		var kv := part.split("=")
		if kv.size() != 2 or kv[0] != "simple":
			continue

		is_simple = kv[1].to_lower().strip_edges() == "true"
		return


func _apply_display_mode() -> void:
	headers.visible = not is_simple
	for i in range(players_container.get_child_count()):
		var player_node := players_container.get_child(i) as TopBarPlayer
		player_node.set_simple_mode(is_simple)

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