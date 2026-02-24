extends Node2D
## StandingsOverlay — displays the standings text broadcast from the server.

@onready var label: Label = $Control/Label
@onready var particles: CPUParticles2D = $CPUParticles2D

func _ready() -> void:
	SignalBus.standings_updated.connect(_on_standings_updated)

func _on_standings_updated(text: String) -> void:
	var t: Tween = create_tween()
	t.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_CUBIC)
	t.tween_property(label, "modulate:a", 0.0, 0.5)
	t.parallel().tween_property(label, "position:y", 30, 0.5).as_relative()
	await t.finished
	label.text = text
	var t2: Tween = create_tween()
	t2.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_CUBIC)
	t2.tween_property(label, "modulate:a", 1.0, 0.5)
	t2.parallel().tween_property(label, "position:y", -30, 0.5).as_relative()
	await t2.finished
	particles.emitting = true
