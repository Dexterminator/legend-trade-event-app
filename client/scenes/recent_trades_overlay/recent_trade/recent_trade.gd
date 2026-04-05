extends Node2D
class_name RecentTrade

const Factory := preload("res://scenes/recent_trades_overlay/recent_trade/recent_trade.tscn")

@onready var name_label: Label = %Name
@onready var action_label: Label = %Action
@onready var timestamp_label: Label = %Timestamp
@onready var symbol_label: Label = %Symbol
@onready var asset_value_label: Label = %AssetValue
@onready var icon_texture: TextureRect = %Icon
@onready var size_label: Label = %Size
@onready var closed_pnl_label: Label = %ClosedPnl

static func create(trade_update: Dictionary, parent: Node2D) -> RecentTrade:
	var instance: RecentTrade = Factory.instantiate()
	parent.add_child(instance)
	instance.init(trade_update)
	return instance

func init(trade_update: Dictionary) -> void:
	#     id: string
	# ts: number
	# user_id: string
	# username: string
	# avatar_url: string
	# action: ActivityAction
	# symbol: string
	# side: PositionSide
	# size_usd: number
	# price: number
	# leverage: number
	# margin_usd: number
	# closed_pnl: number | null
	# closed_pnl_pct: number | null
	name_label.text = trade_update["username"]
	var action: String = trade_update["action"]
	var size_usd: float = trade_update["size_usd"]
	var ts: int = trade_update["ts"]
	action_label.text = action.capitalize()
	timestamp_label.text = Utils.format_timestamp(ts)
	symbol_label.text = trade_update["symbol"]
	size_label.text = Utils.format_compact_number(size_usd)
	if action == "closed":
		var closed_pnl: float = trade_update["closed_pnl"]
		closed_pnl_label.text = "%s%s" % ["+" if closed_pnl > 0 else "-", Utils.format_compact_number(closed_pnl)]
		closed_pnl_label.modulate = Constants.GREEN if closed_pnl > 0 else Constants.RED
	else:
		closed_pnl_label.text = ""
