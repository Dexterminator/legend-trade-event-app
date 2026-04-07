extends Node2D
class_name RecentTrade

const Factory := preload("res://scenes/recent_trades_overlay/recent_trade/recent_trade.tscn")
const SYMBOL_ICON_BASE_URL := "https://legend-trade-dev.s3.amazonaws.com/token-images/%s.png"

@onready var panel_container: PanelContainer = $PanelContainer
@onready var name_label: Label = %Name
@onready var action_label: Label = %Action
@onready var timestamp_label: Label = %Timestamp
@onready var symbol_label: Label = %Symbol
@onready var price_label: Label = %Price
@onready var icon_texture: TextureRect = %Icon
@onready var size_label: Label = %Size
@onready var closed_pnl_label: Label = %ClosedPnl

static var symbol_icon_cache: Dictionary = {}

var background_flash_tween: Tween
var panel_style: StyleBoxFlat
var panel_base_bg_color := Color(0.07058824, 0.07058824, 0.07058824, 1.0)
var pending_closed_trade_flash_pnl: float = 0.0
var has_pending_closed_trade_flash := false
var _symbol_icon_request: HTTPRequest
var _current_symbol: String = ""

const BACKGROUND_FLASH_IN_DURATION := 0.12
const BACKGROUND_FLASH_OUT_DURATION := 0.3
const BACKGROUND_FLASH_STRENGTH := 0.2

static func create(trade_update: Dictionary, parent: Node2D) -> RecentTrade:
	var instance: RecentTrade = Factory.instantiate()
	parent.add_child(instance)
	instance.init(trade_update)
	return instance

func init(trade_update: Dictionary) -> void:
	_ensure_panel_style()
	name_label.text = trade_update["username"]
	var action: String = trade_update["action"]
	var size_usd: float = trade_update["size_usd"]
	var ts: int = trade_update["ts"]
	var price: float = trade_update["price"]
	var side: String = trade_update["side"]
	action_label.text = action.capitalize() + ": " + side
	timestamp_label.text = Utils.format_timestamp(ts)
	var symbol := str(trade_update["symbol"]).to_upper()
	symbol_label.text = symbol
	_set_symbol_icon(symbol)
	size_label.text = Utils.format_compact_number(size_usd)
	price_label.text = Utils.format_compact_number(price)
	if action == "closed":
		var closed_pnl: float = trade_update["closed_pnl"]
		closed_pnl_label.text = Utils.format_compact_closed_pnl(closed_pnl)
		closed_pnl_label.modulate = Constants.GREEN if closed_pnl > 0 else Constants.RED
		pending_closed_trade_flash_pnl = closed_pnl
		has_pending_closed_trade_flash = true
	else:
		closed_pnl_label.text = ""
		has_pending_closed_trade_flash = false


func _set_symbol_icon(symbol: String) -> void:
	_current_symbol = symbol
	if symbol.is_empty():
		icon_texture.texture = null
		return

	if symbol_icon_cache.has(symbol):
		icon_texture.texture = symbol_icon_cache[symbol]
		return

	icon_texture.texture = null
	if _symbol_icon_request != null and is_instance_valid(_symbol_icon_request):
		_symbol_icon_request.queue_free()

	_symbol_icon_request = HTTPRequest.new()
	add_child(_symbol_icon_request)
	_symbol_icon_request.request_completed.connect(_on_symbol_icon_request_completed.bind(symbol, _symbol_icon_request))
	var url_symbol := "HYPE" if symbol == "$HYPE" else symbol
	var error := _symbol_icon_request.request(SYMBOL_ICON_BASE_URL % url_symbol)
	if error != OK:
		_symbol_icon_request.queue_free()
		_symbol_icon_request = null


func _on_symbol_icon_request_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray, symbol: String, request: HTTPRequest) -> void:
	if request != _symbol_icon_request:
		if is_instance_valid(request):
			request.queue_free()
		return

	_symbol_icon_request = null
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
	if _current_symbol == symbol:
		icon_texture.texture = texture


func _ensure_panel_style() -> void:
	if panel_style != null:
		return

	var existing_style := panel_container.get_theme_stylebox("panel")
	if existing_style is StyleBoxFlat:
		panel_style = (existing_style as StyleBoxFlat).duplicate()
		panel_base_bg_color = panel_style.bg_color
		panel_container.add_theme_stylebox_override("panel", panel_style)


func _flash_closed_trade_background(closed_pnl: float) -> void:
	if closed_pnl == 0.0:
		return

	_ensure_panel_style()
	if panel_style == null:
		return

	if background_flash_tween != null:
		background_flash_tween.kill()

	var flash_color := Constants.GREEN if closed_pnl > 0.0 else Constants.RED
	var target_color := panel_base_bg_color.lerp(flash_color, BACKGROUND_FLASH_STRENGTH)
	panel_style.bg_color = panel_base_bg_color

	background_flash_tween = create_tween()
	background_flash_tween.tween_property(
		panel_style,
		"bg_color",
		target_color,
		BACKGROUND_FLASH_IN_DURATION
	).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	background_flash_tween.tween_property(
		panel_style,
		"bg_color",
		panel_base_bg_color,
		BACKGROUND_FLASH_OUT_DURATION
	).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)


func play_queued_closed_trade_flash() -> void:
	if not has_pending_closed_trade_flash:
		return

	has_pending_closed_trade_flash = false
	_flash_closed_trade_background(pending_closed_trade_flash_pnl)


func get_display_height() -> float:
	if panel_container.size.y > 0.0:
		return panel_container.size.y

	return panel_container.get_combined_minimum_size().y
