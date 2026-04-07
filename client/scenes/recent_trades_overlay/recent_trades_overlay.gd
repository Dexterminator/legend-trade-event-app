extends Control

@export var is_popup_trades := false

@onready var spawn_point: Marker2D = %Spawn
var recent_trades: Array[RecentTrade] = []
var trade_tweens: Dictionary = {}
const WIDTH: float = 600.0
const TRADE_GAP: float = 16.0
const MOVE_DURATION: float = 0.45
const FADE_DURATION: float = 0.5
const MAX_TRADES: int = 7
const POPUP_MAX_TRADES: int = 3
const POPUP_TRADE_VISIBLE_DURATION: float = 3.0

func _ready() -> void:
	_apply_url_query_params()
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.trade_update.connect(_on_trade_update)


func _apply_url_query_params() -> void:
	if not OS.has_feature("web"):
		return

	var query: String = JavaScriptBridge.eval("window.location.search")
	for part: String in query.trim_prefix("?").split("&"):
		var kv := part.split("=")
		if kv.size() != 2 or kv[0] != "popup_trades":
			continue

		is_popup_trades = kv[1].to_lower().strip_edges() == "true"
		return


func _kill_trade_tween(recent_trade: RecentTrade) -> void:
	var tween: Tween = trade_tweens.get(recent_trade)
	if tween != null and is_instance_valid(tween):
		tween.kill()


func _fade_out_and_remove_trade(recent_trade: RecentTrade) -> void:
	_kill_trade_tween(recent_trade)
	var tween := create_tween()
	trade_tweens[recent_trade] = tween
	var recent_trade_ref: WeakRef = weakref(recent_trade)
	var panel := recent_trade.get_node("PanelContainer") as PanelContainer
	var trade_height: float = panel.size.y if panel.size.y > 0.0 else panel.get_combined_minimum_size().y

	tween.tween_property(
		recent_trade,
		"position:y",
		recent_trade.position.y + trade_height * 0.5,
		FADE_DURATION * 0.5
	).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tween.parallel().tween_property(
		recent_trade,
		"modulate:a",
		0.0,
		FADE_DURATION * 0.8
	).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	tween.finished.connect(func() -> void:
		var trade_object: Object = recent_trade_ref.get_ref()
		if not trade_object is RecentTrade:
			return
		var trade: RecentTrade = trade_object
		if trade != null and trade_tweens.get(trade) == tween:
			trade_tweens.erase(trade)
		if trade != null:
			trade.queue_free()
	)


func _get_max_trades() -> int:
	return POPUP_MAX_TRADES if is_popup_trades else MAX_TRADES


func _schedule_trade_fade_out(recent_trade: RecentTrade) -> void:
	var timer := get_tree().create_timer(POPUP_TRADE_VISIBLE_DURATION)
	var recent_trade_ref: WeakRef = weakref(recent_trade)
	timer.timeout.connect(func() -> void:
		var trade_object: Object = recent_trade_ref.get_ref()
		if not trade_object is RecentTrade:
			return
		var trade: RecentTrade = trade_object
		var trade_index := recent_trades.find(trade)
		if trade_index == -1:
			return
		recent_trades.remove_at(trade_index)
		_fade_out_and_remove_trade(trade)
		_animate_recent_trades()
	)


func _trim_recent_trades() -> void:
	while recent_trades.size() > _get_max_trades():
		var oldest_trade: RecentTrade = recent_trades.pop_back()
		_fade_out_and_remove_trade(oldest_trade)


func _get_trade_target_position(index: int) -> Vector2:
	if recent_trades.is_empty():
		return Vector2.ZERO

	var panel := recent_trades[0].get_node("PanelContainer") as PanelContainer
	var trade_height: float = panel.size.y if panel.size.y > 0.0 else panel.get_combined_minimum_size().y
	return Vector2(0.0, index * (trade_height + TRADE_GAP))


func _animate_recent_trades() -> void:
	for i in recent_trades.size():
		var recent_trade: RecentTrade = recent_trades[i]
		var recent_trade_ref: WeakRef = weakref(recent_trade)
		var should_play_closed_trade_flash := i == 0
		var tween := create_tween()
		_kill_trade_tween(recent_trade)
		trade_tweens[recent_trade] = tween

		tween.tween_property(
			recent_trade,
			"position",
			_get_trade_target_position(i),
			MOVE_DURATION
		).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
		tween.parallel().tween_property(
			recent_trade,
			"modulate:a",
			1.0,
			FADE_DURATION
		).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
		tween.finished.connect(func() -> void:
			var trade_object: Object = recent_trade_ref.get_ref()
			if not trade_object is RecentTrade:
				return
			var trade: RecentTrade = trade_object
			if trade != null and trade_tweens.get(trade) == tween:
				trade_tweens.erase(trade)
			if should_play_closed_trade_flash and trade != null:
				trade.play_queued_closed_trade_flash()
		)


func _on_trade_update(payload: Dictionary) -> void:
	var recent_trade := RecentTrade.create(payload, spawn_point)
	recent_trade.position = Vector2(WIDTH, 0.0)
	recent_trade.modulate.a = 0.0
	recent_trades.push_front(recent_trade)
	if is_popup_trades:
		_schedule_trade_fade_out(recent_trade)

	_trim_recent_trades()
	_animate_recent_trades()
