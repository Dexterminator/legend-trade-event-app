extends Node2D
## TickerOverlay — displays the ticker text broadcast from the server.

@onready var label: Label = $Control/Label


func _ready() -> void:
	SignalBus.ticker_updated.connect(_on_ticker_updated)


func _on_ticker_updated(text: String) -> void:
	label.text = text
