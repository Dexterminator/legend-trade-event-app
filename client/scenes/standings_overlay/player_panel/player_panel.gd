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

var rank_delta_sign: int = 0
var ts_rank_delta_sign_changed: float = 0

const RANK_DELTA_RESET_TIME: float = 3 * 60.0

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
	var user_name: String = trader["username"]
	var country_code: String = trader["country_code"]
	pfp_texture.texture = load("res://assets/%s.png" % user_name.to_lower())
	flag_texture.texture = load("res://assets/flag_%s.png" % country_code.to_lower())

func _update(updates: Dictionary) -> void:
	rank = updates["rank"]
	var pnl_pct: float = updates["pnl_pct"]
	var volume: float = updates["volume_usd"]
	pnl_pct_label.text = _format_pct_with_sign(pnl_pct)
	pnl_pct_label.modulate = Constants.GREEN if pnl_pct > 0 else Constants.RED
	volume_label.text = Utils.format_compact_number(volume)
	if Delta.exceeded(ts_rank_delta_sign_changed, RANK_DELTA_RESET_TIME):
		rank_delta_sign = 0
		rank_delta_indicator.texture = rank_delta_textures["neutral"]

	# TODO: Set top pos
	# TODO: Draw sparkline

func set_rank_label(new_rank: int) -> void:
	var prev_rank: int = int(rank_label.text)
	rank_label.text = str(new_rank)
	var rank_delta: int = new_rank - prev_rank
	var prev_rank_delta_sign: int = rank_delta_sign
	rank_delta_sign = sign(rank_delta)
	if rank_delta_sign != prev_rank_delta_sign:
		ts_rank_delta_sign_changed = Delta.now

	if rank_delta > 0:
		rank_delta_indicator.texture = rank_delta_textures["down"]
	elif rank_delta < 0:
		rank_delta_indicator.texture = rank_delta_textures["up"]
	else:
		rank_delta_indicator.texture = rank_delta_textures["neutral"]
