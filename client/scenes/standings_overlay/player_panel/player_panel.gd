class_name PlayerPanel
extends PanelContainer

@onready var animation_player: AnimationPlayer = $AnimationPlayer

func expand() -> void:
    if animation_player.is_playing():
        animation_player.stop()
    animation_player.play("expand")

func collapse() -> void:
    if animation_player.is_playing():
        animation_player.stop()
    animation_player.play("collapse")
