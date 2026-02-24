extends Node2D
## ScoreOverlay — displays the score text broadcast from the server.

@onready var label: Label = $Control/Label


func _ready() -> void:
	SignalBus.score_updated.connect(_on_score_updated)


func _on_score_updated(text: String) -> void:
	label.text = text
