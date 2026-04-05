extends Node2D

@onready var spawn_point: Marker2D = %Spawn
var recent_trades: Array[RecentTrade] = []
var trade_tweens: Dictionary = {}
const WIDTH: float = 600.0
const TRADE_GAP: float = 16.0
const MOVE_DURATION: float = 0.45
const FADE_DURATION: float = 0.5
const MAX_TRADES: int = 7

func _ready() -> void:
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.trade_update.connect(_on_trade_update)


func _kill_trade_tween(recent_trade: RecentTrade) -> void:
	var tween: Tween = trade_tweens.get(recent_trade)
	if tween != null and is_instance_valid(tween):
		tween.kill()


func _fade_out_and_remove_trade(recent_trade: RecentTrade) -> void:
	_kill_trade_tween(recent_trade)
	var tween := create_tween()
	trade_tweens[recent_trade] = tween
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
		if trade_tweens.get(recent_trade) == tween:
			trade_tweens.erase(recent_trade)
		if is_instance_valid(recent_trade):
			recent_trade.queue_free()
	)


func _trim_recent_trades() -> void:
	while recent_trades.size() > MAX_TRADES:
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
			if trade_tweens.get(recent_trade) == tween:
				trade_tweens.erase(recent_trade)
		)


func _on_trade_update(payload: Dictionary) -> void:
	var recent_trade := RecentTrade.create(payload, spawn_point)
	recent_trade.position = Vector2(WIDTH, 0.0)
	recent_trade.modulate.a = 0.0
	recent_trades.push_front(recent_trade)

	_trim_recent_trades()
	_animate_recent_trades()
