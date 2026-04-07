class_name PlayerPanel
extends PanelContainer

const PlayerPanelSparklineScript := preload("res://scenes/standings_overlay/player_panel/player_panel_sparkline.gd")
const SYMBOL_ICON_BASE_URL := "https://legend-trade-dev.s3.amazonaws.com/token-images/%s.png"

@onready var user_name_label: Label = %UserNameLabel
@onready var rank_container: HBoxContainer = %RankContainer
@onready var rank_label: Label = %RankLabel
@onready var flag_texture: TextureRect = %Flag
@onready var pfp_texture: TextureRect = %ProfilePicture
@onready var volume_label: Label = %VolumeLabel
@onready var top_positions_container: HBoxContainer = %TopPositions
@onready var pnl_pct_label: Label = %PnlPctLabel
@onready var pnl_sparkline: PlayerPanelSparklineScript = %PnlSparkline
@onready var rank_delta_indicator: TextureRect = %RankDeltaIndicator

static var symbol_icon_cache: Dictionary = {}

var rank_delta_sign: int = 0
var ts_rank_delta_sign_changed: float = 0
var is_eliminated: bool = false
var _top_position_icon_slots: Array[TextureRect] = []
var _symbol_icon_requests: Dictionary = {}
var _current_top_position_symbols: Array[String] = []

const RANK_DELTA_RESET_TIME: float = 3 * 60.0

const rank_delta_textures: Dictionary = {
	"up": preload("res://assets/up-position.svg"),
	"neutral": preload("res://assets/neutral-position.svg"),
	"down": preload("res://assets/down-position.svg"),
}

var rank: int = 0

func _update_rank_label() -> void:
	rank_label.text = str(rank)

func init(trader: Dictionary, new_rank: int) -> void:
	user_name_label.text = trader["username"]
	rank = new_rank
	_update_rank_label()
	pnl_sparkline.clear_values()
	_cache_top_position_slots()
	_update_top_positions(_as_array(trader.get("top_positions", [])))
	var user_name: String = trader["username"]
	var country_code: String = trader["country_code"]
	pfp_texture.texture = load("res://assets/%s.png" % user_name.to_lower())
	flag_texture.texture = load("res://assets/flag_%s.png" % country_code.to_lower())

func _update(updates: Dictionary) -> void:
	rank = updates["rank"]
	var pnl_pct: float = updates["pnl_pct"]
	var volume: float = updates["volume_usd"]
	var sparkline: Array = updates.get("sparkline", [])
	Utils.format_pct_label(pnl_pct_label, pnl_pct)
	pnl_sparkline.set_values(sparkline)
	volume_label.text = Utils.format_compact_number(volume)
	is_eliminated = updates["is_eliminated"]
	visible = not is_eliminated
	_update_top_positions(_as_array(updates.get("top_positions", [])))

	if Delta.exceeded(ts_rank_delta_sign_changed, RANK_DELTA_RESET_TIME):
		rank_delta_sign = 0
		rank_delta_indicator.texture = rank_delta_textures["neutral"]


func _cache_top_position_slots() -> void:
	if not _top_position_icon_slots.is_empty():
		return

	for child in top_positions_container.get_children():
		if child is TextureRect:
			_top_position_icon_slots.append(child as TextureRect)


func _update_top_positions(top_positions: Array) -> void:
	_cache_top_position_slots()
	_current_top_position_symbols.clear()

	for i in _top_position_icon_slots.size():
		var slot := _top_position_icon_slots[i]
		if i >= top_positions.size():
			slot.texture = null
			continue

		var top_position: Variant = top_positions[i]
		if not top_position is Dictionary:
			slot.texture = null
			continue

		var top_position_dict: Dictionary = top_position
		var symbol_value: Variant = top_position_dict.get("symbol", "")
		var symbol := str(symbol_value).to_upper()
		if symbol.is_empty():
			slot.texture = null
			continue

		_current_top_position_symbols.append(symbol)
		_apply_symbol_icon(slot, symbol)


func _apply_symbol_icon(slot: TextureRect, symbol: String) -> void:
	if symbol_icon_cache.has(symbol):
		slot.texture = symbol_icon_cache[symbol]
		return

	slot.texture = null
	if _symbol_icon_requests.has(symbol):
		return

	var request := HTTPRequest.new()
	_symbol_icon_requests[symbol] = request
	add_child(request)
	request.request_completed.connect(_on_symbol_icon_request_completed.bind(symbol, request))
	var url_symbol := "HYPE" if symbol == "$HYPE" else symbol
	var error := request.request(SYMBOL_ICON_BASE_URL % url_symbol)
	if error != OK:
		_symbol_icon_requests.erase(symbol)
		request.queue_free()


func _on_symbol_icon_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, symbol: String, request: HTTPRequest) -> void:
	_symbol_icon_requests.erase(symbol)
	if is_instance_valid(request):
		request.queue_free()

	if result != HTTPRequest.RESULT_SUCCESS or response_code != 200:
		return

	var image := Image.new()
	var error := image.load_png_from_buffer(body)
	if error != OK:
		return

	var texture := ImageTexture.create_from_image(image)
	symbol_icon_cache[symbol] = texture
	for i in _top_position_icon_slots.size():
		if i >= _current_top_position_symbols.size():
			continue
		if _current_top_position_symbols[i] == symbol:
			_top_position_icon_slots[i].texture = texture


func _as_array(value: Variant) -> Array:
	if value is Array:
		return value
	return []

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
