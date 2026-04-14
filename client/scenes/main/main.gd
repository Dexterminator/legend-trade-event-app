extends Node2D
## Main — entry point.
##   • Reads ?overlay= from the URL query string (Web export only).
##   • Instantiates the matching overlay (or all overlays in native/editor mode).
##   • Manages the WebSocket connection to the server with exponential backoff.

const MAX_PACKETS_PER_FRAME := 100

var _packet_queue: Array[String] = []

# Optional: keep only latest state (recommended for OBS)
var _latest_leaderboard: Dictionary = {}
var _latest_trade: Dictionary = {}


# ── Overlay registry ──────────────────────────────────────────────────────────
const OVERLAYS: Dictionary[String, PackedScene] = {
	"standings": preload("res://scenes/standings_overlay/standings_overlay.tscn"),
	"top_bar": preload("res://scenes/top_bar_overlay/top_bar_overlay.tscn"),
	"recent_trades": preload("res://scenes/recent_trades_overlay/recent_trades_overlay.tscn"),
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
	if OS.has_feature("web"):
		JavaScriptBridge.eval("""
			console.warn = function() {};
			console.error = function() {};
		""")
	_spawn_overlay()
	_connect_socket()

func _process(delta: float) -> void:
	# Reconnect logic
	if _socket == null:
		if _reconnect_timer > 0.0:
			_reconnect_timer -= delta
			if _reconnect_timer <= 0.0:
				_connect_socket()
		return

	_socket.poll()

	match _socket.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			_reconnect_delay = BASE_DELAY
			_attempt = 0

			# 🚀 FAST DRAIN (no parsing, no signals)
			var count := 0
			while _socket.get_available_packet_count() > 0 and count < MAX_PACKETS_PER_FRAME:
				var raw := _socket.get_packet().get_string_from_utf8()
				_packet_queue.append(raw)
				count += 1

		WebSocketPeer.STATE_CLOSED:
			_schedule_reconnect()

		WebSocketPeer.STATE_CONNECTING, WebSocketPeer.STATE_CLOSING:
			return

	# 🧠 PROCESS AFTER DRAINING
	for raw in _packet_queue:
		_process_message_fast(raw)

	_packet_queue.clear()

	# 📉 Emit only latest (prevents UI spam)
	if not _latest_leaderboard.is_empty():
		SignalBus.standings_updated.emit(_latest_leaderboard)
		_latest_leaderboard.clear()

	if not _latest_trade.is_empty():
		SignalBus.trade_update.emit(_latest_trade)
		_latest_trade.clear()

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
		key = "standings" # default for native/editor
	if key in OVERLAYS:
		var overlay: Control = (OVERLAYS[key] as PackedScene).instantiate()
		overlay.focus_mode = Control.FOCUS_NONE
		overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(overlay)

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


func _process_message_fast(raw: String) -> void:
	var parsed: Dictionary = JSON.parse_string(raw)
	if not parsed is Dictionary:
		return

	# ignore warning
	var msg_type: String = parsed.get("type", "")
	var payload: Variant = parsed.get("payload", {})

	if not payload is Dictionary:
		return

	match msg_type:
		"connected":
			pass

		# 📉 KEEP ONLY LATEST
		"leaderboard":
			_latest_leaderboard = payload

		"trade_update":
			_latest_trade = payload
