extends Node2D

@onready var spawn_point: Marker2D = %Spawn
var recent_trades: Array[RecentTrade] = []
const WIDTH: float = 600.0

func _ready() -> void:
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.trade_update.connect(_on_trade_update)
	
func _on_trade_update(payload: Dictionary) -> void:
	var recent_trade := RecentTrade.create(payload, spawn_point)
	recent_trade.position = Vector2.RIGHT * WIDTH
	recent_trades.append(recent_trade)

	recent_trade.modulate.a = 0.0
	var t := create_tween()
	t.tween_property(recent_trade, "position:x", 0, .5).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	t.parallel().tween_property(recent_trade, "modulate:a", 1.0, .4).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
