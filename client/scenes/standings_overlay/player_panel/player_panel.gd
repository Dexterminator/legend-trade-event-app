class_name PlayerPanel
extends PanelContainer

@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var name_label: Label = %NameLabel
@onready var score_label: Label = %ScoreLabel
@onready var placement_label: Label = %PlacementLabel

enum State {EXPANDED, COLLAPSED}
var state: State = State.COLLAPSED
var score: int = 0
var showing_score: int = 0
var score_tween: Tween

func set_score(new_score: int) -> void:
	score = new_score
	if score_tween:
		score_tween.kill()
	score_tween = create_tween()
	score_tween.tween_method(
		func(value: float) -> void:
			score_label.text = "$%s" % Utils.format_number(int(value)),
		float(showing_score),
		float(score),
		0.5
	)
	showing_score = score

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
