class_name PlayerPanel
extends PanelContainer

@onready var user_name_label: Label = %UserNameLabel
@onready var rank_label: Label = %RankLabel
@onready var flag_texture: TextureRect = %Flag
@onready var pfp_texture: TextureRect = %ProfilePicture
@onready var volume_label: Label = %VolumeLabel
@onready var top_positions_container: HBoxContainer = %TopPositions
@onready var pnl_pct_label: Label = %PnlPctLabel

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
	pass

func _update(updates: Dictionary) -> void:
	rank = updates["rank"]
	var pnl_pct: float = updates["pnl_pct"]
	var volume: float = updates["volume_usd"]
	pnl_pct_label.text = _format_pct_with_sign(pnl_pct)
	pnl_pct_label.modulate = Constants.GREEN if pnl_pct > 0 else Constants.RED
	volume_label.text = Utils.format_compact_number(volume)

	# Set trade volume
	# Set PnL
	# TODO: Set top pos
	# TODO: Draw sparkline

func set_rank(new_rank: int) -> void:
	rank = new_rank
	rank_label.text = str(rank)
