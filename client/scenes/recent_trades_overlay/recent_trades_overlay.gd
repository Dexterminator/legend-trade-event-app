extends Node2D

var recent_trades: Array[RecentTrade] = []

func _ready() -> void:
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.trade_update.connect(_on_trade_update)
	
func _on_trade_update(payload: Dictionary) -> void:
	var recent_trade := RecentTrade.create(payload, self )
	recent_trades.append(recent_trade)
