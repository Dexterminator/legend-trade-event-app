class_name PlayerPanel
extends PanelContainer

@onready var name_label: Label = %NameLabel

enum State {EXPANDED, COLLAPSED}
var state: State = State.COLLAPSED
var score: int = 0
var pnl_pct: float = 0.0
var ranking: int = 0
var showing_score: int = 0
var score_tween: Tween

func init() -> void:
	# Set name
	# Set PFP
	# Set country flag
	# Set top pos
	pass

func _update() -> void:
	# Set top pos
	# Set trade volume
	# Set PnL
	# Draw sparkline
	pass

func set_pnl_pct(new_pnl_pct: float) -> void:
	pnl_pct = new_pnl_pct
	# score_label.text = "%0.2f%%" % pnl_pct
