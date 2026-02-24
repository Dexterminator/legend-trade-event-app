extends Node2D
## StandingsOverlay — displays the standings text broadcast from the server.

@onready var label: Label = $Label


func _ready() -> void:
	SignalBus.standings_updated.connect(_on_standings_updated)


func _on_standings_updated(text: String) -> void:
	label.text = text
