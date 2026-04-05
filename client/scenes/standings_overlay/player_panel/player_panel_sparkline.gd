class_name PlayerPanelSparkline
extends Control

const CHART_LINE_WIDTH := 2.0
const CHART_PADDING_X := 10.0
const CHART_PADDING_TOP := 24.0
const CHART_PADDING_BOTTOM := 10.0
const CHART_MIN_RANGE_PADDING := 0.05
const CHART_RANGE_PADDING_RATIO := 0.08
const BASELINE_DASH_WIDTH := 6.0
const BASELINE_GAP_WIDTH := 4.0
const BASELINE_COLOR := Color(0.85, 0.85, 0.85, 0.16)
const CHART_COLOR := Color(0.84705883, 0.34901962, 0.0627451, 0.22)

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
	for value in values:
		min_value = minf(min_value, value)
		max_value = maxf(max_value, value)

	var original_min := min_value
	var original_max := max_value
	if is_equal_approx(min_value, max_value):
		min_value -= CHART_MIN_RANGE_PADDING
		max_value += CHART_MIN_RANGE_PADDING
	else:
		var value_padding := maxf((max_value - min_value) * CHART_RANGE_PADDING_RATIO, CHART_MIN_RANGE_PADDING)
		min_value -= value_padding
		max_value += value_padding

	# if original_min <= 0.0 and original_max >= 0.0:
	# 	var baseline_y := top + _value_to_y(0.0, min_value, max_value, usable_height)
	# 	_draw_dashed_baseline(left, baseline_y, usable_width)

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

func _draw_dashed_baseline(left: float, y: float, width: float) -> void:
	var x := left
	var end_x := left + width
	while x < end_x:
		var dash_end := minf(x + BASELINE_DASH_WIDTH, end_x)
		draw_line(Vector2(x, y), Vector2(dash_end, y), BASELINE_COLOR, 1.0, true)
		x += BASELINE_DASH_WIDTH + BASELINE_GAP_WIDTH