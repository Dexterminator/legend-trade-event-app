class_name PlayerPanel
extends PanelContainer

@onready var animation_player: AnimationPlayer = $AnimationPlayer
enum State {EXPANDED, COLLAPSED}
var state: State = State.COLLAPSED

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