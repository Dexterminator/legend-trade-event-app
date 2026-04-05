extends Node2D
class_name RecentTrade

const Factory := preload("res://scenes/recent_trades_overlay/recent_trade/recent_trade.tscn")

@onready var panel_container: PanelContainer = $PanelContainer
@onready var name_label: Label = %Name
@onready var action_label: Label = %Action
@onready var timestamp_label: Label = %Timestamp
@onready var symbol_label: Label = %Symbol
@onready var price_label: Label = %Price
@onready var icon_texture: TextureRect = %Icon
@onready var size_label: Label = %Size
@onready var closed_pnl_label: Label = %ClosedPnl

static func create(trade_update: Dictionary, parent: Node2D) -> RecentTrade:
	var instance: RecentTrade = Factory.instantiate()
	parent.add_child(instance)
	instance.init(trade_update)
	return instance

func init(trade_update: Dictionary) -> void:
	name_label.text = trade_update["username"]
	var action: String = trade_update["action"]
	var size_usd: float = trade_update["size_usd"]
	var ts: int = trade_update["ts"]
	var price: float = trade_update["price"]
	var side: String = trade_update["side"]
	action_label.text = action.capitalize() + ": " + side
	timestamp_label.text = Utils.format_timestamp(ts)
	symbol_label.text = trade_update["symbol"]
	size_label.text = Utils.format_compact_number(size_usd)
	price_label.text = Utils.format_compact_number(price)
	if action == "closed":
		var closed_pnl: float = trade_update["closed_pnl"]
		closed_pnl_label.text = "%s%s" % ["+" if closed_pnl > 0 else "-", Utils.format_compact_number(closed_pnl)]
		closed_pnl_label.modulate = Constants.GREEN if closed_pnl > 0 else Constants.RED
	else:
		closed_pnl_label.text = ""


func get_display_height() -> float:
	if panel_container.size.y > 0.0:
		return panel_container.size.y

	return panel_container.get_combined_minimum_size().y
