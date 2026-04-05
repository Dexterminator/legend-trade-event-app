extends Node2D

func _ready() -> void:
	modulate.a = 0.0
	var t := create_tween()
	t.tween_property(self , "modulate:a", 1.0, 2.0).set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	SignalBus.recent_trades_updated.connect(_on_recent_trades_updated)

func _on_recent_trades_updated(payload: Dictionary) -> void:
	pass