class_name SymbolIconLoader
extends RefCounted

const SYMBOL_ICON_BASE_URL := "https://legend-trade-dev.s3.amazonaws.com/token-images/%s.png"
const SYMBOL_ICON_PROXY_PATH := "/token-images/%s.png"
const PRELOADED_SYMBOLS := [
	"ETH",
	"$HYPE",
	"AVAX",
	"DOGE",
	"ARB",
	"BTC",
	"MATIC",
	"SOL",
]

static var _symbol_icon_cache: Dictionary = {}
static var _pending_callbacks_by_symbol: Dictionary = {}
static var _has_preloaded_symbols := false


func ensure_preloaded(owner: Node) -> void:
	if _has_preloaded_symbols:
		return

	_has_preloaded_symbols = true
	for symbol: String in PRELOADED_SYMBOLS:
		request_icon(owner, symbol, Callable())


func get_cached_icon(symbol_value: Variant) -> Texture2D:
	var symbol := normalize_symbol(symbol_value)
	return _symbol_icon_cache.get(symbol)


func request_icon(owner: Node, symbol_value: Variant, on_loaded: Callable) -> String:
	var symbol := normalize_symbol(symbol_value)
	var url_symbol := get_url_symbol(symbol)
	if symbol.is_empty():
		if on_loaded.is_valid():
			on_loaded.call(null, "")
		return ""

	var cached_texture: Texture2D = _symbol_icon_cache.get(symbol)
	if cached_texture != null:
		if on_loaded.is_valid():
			on_loaded.call(cached_texture, symbol)
		return symbol

	var pending_callbacks: Array = _pending_callbacks_by_symbol.get(symbol, [])
	pending_callbacks.append(on_loaded)
	_pending_callbacks_by_symbol[symbol] = pending_callbacks
	if pending_callbacks.size() > 1:
		return symbol

	var request := HTTPRequest.new()
	owner.add_child(request)
	request.request_completed.connect(func(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
		_complete_request(symbol, request, result, response_code, body)
	)

	var error := request.request(get_icon_url(url_symbol))
	if error != OK:
		_complete_request(symbol, request, -1, 0, PackedByteArray())

	return symbol


func normalize_symbol(symbol_value: Variant) -> String:
	return str(symbol_value).to_upper()


func get_url_symbol(symbol: String) -> String:
	if symbol == "$HYPE":
		return "HYPE"
	return symbol


func get_icon_url(url_symbol: String) -> String:
	if OS.has_feature("web"):
		var origin := str(JavaScriptBridge.eval("window.location.origin"))
		return origin + (SYMBOL_ICON_PROXY_PATH % url_symbol)
	return SYMBOL_ICON_BASE_URL % url_symbol


func _complete_request(symbol: String, request: HTTPRequest, result: int, response_code: int, body: PackedByteArray) -> void:
	if is_instance_valid(request):
		request.queue_free()

	var texture: Texture2D = null
	if result == HTTPRequest.RESULT_SUCCESS and response_code == 200:
		var image := Image.new()
		var error := image.load_png_from_buffer(body)
		if error == OK:
			texture = ImageTexture.create_from_image(image)
			_symbol_icon_cache[symbol] = texture

	var pending_callbacks: Array = _pending_callbacks_by_symbol.get(symbol, [])
	_pending_callbacks_by_symbol.erase(symbol)
	for pending_callback: Variant in pending_callbacks:
		if pending_callback is Callable:
			var callback: Callable = pending_callback
			if callback.is_valid():
				callback.call(texture, symbol)