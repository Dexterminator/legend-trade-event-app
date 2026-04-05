class_name PlayerPanel
extends PanelContainer

@onready var user_name_label: Label = %UserNameLabel
@onready var rank_container: HBoxContainer = %RankContainer
@onready var rank_label: Label = %RankLabel
@onready var flag_texture: TextureRect = %Flag
@onready var pfp_texture: TextureRect = %ProfilePicture
@onready var volume_label: Label = %VolumeLabel
@onready var top_positions_container: HBoxContainer = %TopPositions
@onready var pnl_pct_label: Label = %PnlPctLabel
@onready var rank_delta_indicator: TextureRect = %RankDeltaIndicator

const rank_delta_textures: Dictionary = {
	"up": preload("res://assets/up-position.svg"),
	"neutral": preload("res://assets/neutral-position.svg"),
	"down": preload("res://assets/down-position.svg"),
}

var rank: int = 0

func _format_pct_with_sign(value: float) -> String:
	return "%s%.2f%%" % ["+" if value > 0 else "", value]

func _update_rank_label() -> void:
	rank_label.text = str(rank)

func init(trader: Dictionary, new_rank: int) -> void:
	user_name_label.text = trader["username"]
	rank = new_rank
	_update_rank_label()
	# TODO: Set PFP (dict by username?)
	# TODO: Set country flag (dict by username?)

func _update(updates: Dictionary) -> void:
	rank = updates["rank"]
	var pnl_pct: float = updates["pnl_pct"]
	var volume: float = updates["volume_usd"]
	pnl_pct_label.text = _format_pct_with_sign(pnl_pct)
	pnl_pct_label.modulate = Constants.GREEN if pnl_pct > 0 else Constants.RED
	volume_label.text = Utils.format_compact_number(volume)


	# TODO: Set rank delta indicator
	# TODO: Set top pos
	# TODO: Draw sparkline

func set_rank_label(new_rank: int) -> void:
	var prev_rank: int = int(rank_label.text)
	rank_label.text = str(new_rank)
	var rank_delta: int = new_rank - prev_rank

	if rank_delta > 0:
		rank_delta_indicator.texture = rank_delta_textures["down"]
	elif rank_delta < 0:
		rank_delta_indicator.texture = rank_delta_textures["up"]
	else:
		rank_delta_indicator.texture = rank_delta_textures["neutral"]
