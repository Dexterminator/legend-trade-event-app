extends VBoxContainer
class_name TopBarPlayer

@onready var name_label: Label = %NameLabel
@onready var pnl_pct_label: Label = %PnlPctLabel
@onready var flag_texture: TextureRect = %Flag

var _is_eliminated := false

func init(trader: Dictionary) -> void:
	var country_code: String = trader["country_code"]
	name_label.text = trader["username"]
	flag_texture.texture = load("res://assets/flag_%s.png" % country_code.to_lower())
	var is_eliminated: bool = trader.get("is_eliminated", false)
	_apply_elimination_state(is_eliminated, false)

func update(updates: Dictionary) -> void:
	var is_eliminated: bool = updates.get("is_eliminated", false)
	_apply_elimination_state(is_eliminated)
	var pnl_pct: float = updates["pnl_pct"]
	Utils.format_pct_label(pnl_pct_label, pnl_pct)


func _apply_elimination_state(next_is_eliminated: bool, _animate: bool = true) -> void:
	_is_eliminated = next_is_eliminated
	visible = not _is_eliminated
