class_name PlayerPanel
extends PanelContainer

@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var name_label: Label = %NameLabel
@onready var score_label: Label = %ScoreLabel
@onready var placement_label: Label = %PlacementLabel

enum State {EXPANDED, COLLAPSED}
var state: State = State.COLLAPSED
var score: int = 0
var pnl_pct: float = 0.0
var ranking: int = 0
var showing_score: int = 0
var score_tween: Tween

func set_pnl_pct(new_pnl_pct: float) -> void:
	pnl_pct = new_pnl_pct
	score_label.text = "%0.2f%%" % pnl_pct

func toggle_expanded() -> void:
	if animation_player.is_playing():
		animation_player.stop()
	match state:
		State.EXPANDED:
			animation_player.play("collapse")
			state = State.COLLAPSED
		State.COLLAPSED:
			animation_player.play("expand")
			state = State.EXPANDED
