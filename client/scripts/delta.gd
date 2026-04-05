extends Node

var now := 0.0


func exceeded(ts_started: float, duration: float) -> float:
	if ts_started == null:
		return true
	return now - ts_started > duration


func since(ts_started: float) -> float:
	if ts_started == null:
		return INF
	return now - ts_started


func _physics_process(delta: float) -> void:
	now += delta
