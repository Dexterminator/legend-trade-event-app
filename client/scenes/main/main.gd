extends Node2D
## Main — entry point.
##   • Reads ?overlay= from the URL query string (Web export only).
##   • Instantiates the matching overlay (or all overlays in native/editor mode).
##   • Manages the WebSocket connection to the server with exponential backoff.

# ── Overlay registry ──────────────────────────────────────────────────────────
const OVERLAYS: Dictionary[String, PackedScene] = {
	"standings": preload("res://scenes/standings_overlay/standings_overlay.tscn"),
	"score": preload("res://scenes/score_overlay/score_overlay.tscn"),
	"ticker": preload("res://scenes/ticker_overlay/ticker_overlay.tscn"),
}

# ── WebSocket config ──────────────────────────────────────────────────────────
const WS_URL: String = "ws://localhost:5050/ws"
const BASE_DELAY: float = 1.0 # seconds
const MAX_DELAY: float = 30.0 # seconds

# ── State ─────────────────────────────────────────────────────────────────────
var _socket: WebSocketPeer = null
var _reconnect_timer: float = 0.0
var _reconnect_delay: float = BASE_DELAY
var _attempt: int = 0

# ── Lifecycle ─────────────────────────────────────────────────────────────────

func _ready() -> void:
	_spawn_overlay()
	_connect_socket()

func _process(delta: float) -> void:
	# Reconnect countdown while socket is absent
	if _socket == null:
		if _reconnect_timer > 0.0:
			_reconnect_timer -= delta
			if _reconnect_timer <= 0.0:
				_connect_socket()
		return

	_socket.poll()

	match _socket.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			# Reset backoff on successful connection
			_reconnect_delay = BASE_DELAY
			_attempt = 0
			# Drain all available packets
			while _socket.get_available_packet_count() > 0:
				var raw := _socket.get_packet().get_string_from_utf8()
				_handle_message(raw)

		WebSocketPeer.STATE_CLOSED:
			_schedule_reconnect()

		WebSocketPeer.STATE_CONNECTING, WebSocketPeer.STATE_CLOSING:
			pass # wait

# ── Helpers ───────────────────────────────────────────────────────────────────

func _spawn_overlay() -> void:
	var key: String = ""

	if OS.has_feature("web"):
		# Parse ?overlay=<key> from the browser URL
		var query: String = JavaScriptBridge.eval("window.location.search")
		for part: String in query.trim_prefix("?").split("&"):
			var kv := part.split("=")
			if kv.size() == 2 and kv[0] == "overlay":
				key = kv[1].to_lower().strip_edges()
				break
	else:
		key = "standings"
	if key in OVERLAYS:
		add_child((OVERLAYS[key] as PackedScene).instantiate())

func _connect_socket() -> void:
	_socket = WebSocketPeer.new()
	var err := _socket.connect_to_url(WS_URL)
	if err != OK:
		push_warning("[Main] WebSocket connect_to_url failed: %d" % err)
		_schedule_reconnect()


func _schedule_reconnect() -> void:
	_socket = null
	_reconnect_delay = minf(_reconnect_delay * 2.0, MAX_DELAY)
	_attempt += 1
	_reconnect_timer = _reconnect_delay
	print("[Main] Reconnecting in %.1fs (attempt %d)" % [_reconnect_delay, _attempt])


func _handle_message(raw: String) -> void:
	var data: Dictionary = JSON.parse_string(raw)
	if not data is Dictionary:
		push_warning("[Main] Unexpected message format: " + raw.left(120))
		return

	var msg_type: String = data.get("type", "")
	var payload: Dictionary = data.get("payload", {})

	match msg_type:
		"initial_state", "state_update":
			if payload.has("standings"):
				SignalBus.standings_updated.emit(str(payload["standings"]))
			if payload.has("score"):
				SignalBus.score_updated.emit(str(payload["score"]))
			if payload.has("ticker"):
				SignalBus.ticker_updated.emit(str(payload["ticker"]))
		_:
			push_warning("[Main] Unknown message type: " + msg_type)
