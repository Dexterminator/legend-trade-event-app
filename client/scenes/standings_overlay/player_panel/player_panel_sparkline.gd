class_name PlayerPanelSparkline
extends Control

const CHART_LINE_WIDTH := 4.0
const CHART_PADDING_X := 10.0
const CHART_PADDING_TOP := 24.0
const CHART_PADDING_BOTTOM := 10.0
const CHART_COLOR := Color(0.84705883, 0.34901962, 0.0627451, 0.3)

var values := PackedFloat32Array()

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)

func set_values(next_values: Array) -> void:
	values = PackedFloat32Array()
	values.resize(next_values.size())
	for i in next_values.size():
		var next_value: Variant = next_values[i]
		if next_value is float:
			var float_value: float = next_value
			values[i] = float_value
		elif next_value is int:
			var int_value: int = next_value
			values[i] = float(int_value)
		elif next_value is bool:
			var bool_value: bool = next_value
			values[i] = 1.0 if bool_value else 0.0
		else:
			values[i] = 0.0
	queue_redraw()

func clear_values() -> void:
	values = PackedFloat32Array()
	queue_redraw()

func _draw() -> void:
	if values.is_empty():
		return

	var chart_size := size
	if chart_size.x <= CHART_PADDING_X * 2.0 or chart_size.y <= CHART_PADDING_TOP + CHART_PADDING_BOTTOM:
		return

	var left := CHART_PADDING_X
	var top := CHART_PADDING_TOP
	var usable_width := chart_size.x - CHART_PADDING_X * 2.0
	var usable_height := chart_size.y - CHART_PADDING_TOP - CHART_PADDING_BOTTOM

	var min_value := values[0]
	var max_value := values[0]
	for value: float in values:
		min_value = minf(min_value, value)
		max_value = maxf(max_value, value)

	if is_equal_approx(min_value, max_value):
		min_value -= 1.0
		max_value += 1.0

	if values.size() == 1:
		var point_y := top + _value_to_y(values[0], min_value, max_value, usable_height)
		draw_circle(Vector2(left + usable_width * 0.5, point_y), CHART_LINE_WIDTH, CHART_COLOR)
		return

	var points := PackedVector2Array()
	points.resize(values.size())
	for i in values.size():
		var x := left + usable_width * (float(i) / float(values.size() - 1))
		var y := top + _value_to_y(values[i], min_value, max_value, usable_height)
		points[i] = Vector2(x, y)

	draw_polyline(points, CHART_COLOR, CHART_LINE_WIDTH, true)

func _value_to_y(value: float, min_value: float, max_value: float, usable_height: float) -> float:
	var normalized := inverse_lerp(min_value, max_value, value)
	return lerpf(usable_height, 0.0, normalized)