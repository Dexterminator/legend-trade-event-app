extends VBoxContainer
class_name TopBarPlayer

@onready var name_label: Label = %NameLabel
@onready var pnl_pct_label: Label = %PnlPctLabel
@onready var flag_texture: TextureRect = %Flag

func init(trader: Dictionary) -> void:
	var country_code: String = trader["country_code"]
	name_label.text = trader["username"]
	flag_texture.texture = load("res://assets/flag_%s.png" % country_code.to_lower())

func update(updates: Dictionary) -> void:
	var pnl_pct: float = updates["pnl_pct"]
	Utils.format_pct_label(pnl_pct_label, pnl_pct)
