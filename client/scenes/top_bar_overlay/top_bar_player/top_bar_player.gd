extends VBoxContainer
class_name TopBarPlayer

@onready var name_panel: PanelContainer = $PanelContainer
@onready var pnl_panel: PanelContainer = $PanelContainer2
@onready var name_label: Label = %NameLabel
@onready var pnl_pct_label: Label = %PnlPctLabel
@onready var flag_texture: TextureRect = %Flag

var _is_eliminated := false
var _is_simple := false

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


func set_simple_mode(next_is_simple: bool) -> void:
	_is_simple = next_is_simple
	_set_panel_background_alpha(name_panel, 0.0 if _is_simple else 1.0)
	_set_panel_background_alpha(pnl_panel, 0.0 if _is_simple else 1.0)
	_apply_elimination_state(_is_eliminated, false)


func _set_panel_background_alpha(panel: PanelContainer, alpha: float) -> void:
	var panel_style := panel.get_theme_stylebox("panel")
	if not panel_style is StyleBoxFlat:
		return

	var panel_style_copy := (panel_style as StyleBoxFlat).duplicate() as StyleBoxFlat
	var bg_color := panel_style_copy.bg_color
	bg_color.a = alpha
	panel_style_copy.bg_color = bg_color
	panel.add_theme_stylebox_override("panel", panel_style_copy)


func _apply_elimination_state(next_is_eliminated: bool, _animate: bool = true) -> void:
	_is_eliminated = next_is_eliminated
	visible = true if _is_simple else not _is_eliminated
