class_name Utils
extends Node2D


static func lerp_smooth(from: float, to: float, delta: float, half_life: float) -> float:
	return to + (from - to) * pow(2, -delta / half_life)


static func lerp_smooth_vec(from: Vector2, to: Vector2, delta: float, half_life: float) -> Vector2:
	return Vector2(
		lerp_smooth(from.x, to.x, delta, half_life), lerp_smooth(from.y, to.y, delta, half_life)
	)


static func select_keys(dict: Dictionary, keys: Array) -> Dictionary:
	var res := {}
	for key: Variant in keys:
		if key in dict:
			res[key] = dict[key]
	return res


static func format_number(n: int) -> String:
	var n_str := str(n)
	var size := n_str.length()
	var s := ""

	for i in range(size):
		if (size - i) % 3 == 0 and i > 0:
			s = str(s, ",", n_str[i])
		else:
			s = str(s, n_str[i])

	return s


static func spawn(factory: PackedScene, parent: Node2D, pos: Vector2) -> Node2D:
	var node: Node2D = factory.instantiate()
	node.global_position = pos
	parent.add_child(node)
	return node


static func wait(parent: Node, wait_time: float) -> Signal:
	var timer := Timer.new()
	parent.add_child(timer)
	timer.wait_time = wait_time
	timer.one_shot = true
	timer.timeout.connect(timer.queue_free)
	timer.start()
	return timer.timeout

static func format_time(time_msec: int) -> String:
	var total_seconds := time_msec / 1000.0
	var seconds: float = fmod(total_seconds, 60.0)
	var minutes: int = int(total_seconds / 60.0) % 60
	var hours: int = int(total_seconds / 3600.0)
	var time_string: String = "%02d:%02d:%05.2f" % [hours, minutes, seconds]
	return time_string

static func get_screen_width() -> float:
	return DisplayServer.window_get_size().x

static func get_screen_height() -> float:
	return DisplayServer.window_get_size().y

static func get_hostname() -> String:
	var output: Array = []
	OS.execute("hostname", [], output)
	return output[0]

static func tween_property_with_curve(
	tween: Tween,
	node: Node,
	property: NodePath,
	to_value: Variant,
	duration: float,
	curve: Curve
) -> MethodTweener:
	var start_value: Variant = node.get_indexed(property)
	return tween.tween_method(
		func(prog: float) -> void:
			var curve_val := curve.sample(prog)
			node.set_indexed(property, lerp(start_value, to_value, curve_val)),
		0.0,
		1.0,
		duration
	)

static func tween_property_with_curve_relative(
	tween: Tween,
	node: Node,
	property: NodePath,
	to_value: Variant,
	duration: float,
	curve: Curve
) -> MethodTweener:
	var start_value: Variant = node.get_indexed(property)
	var end_value: Variant = start_value + to_value
	return tween.tween_method(
		func(prog: float) -> void:
			var curve_val := curve.sample(prog)
			node.set_indexed(property, lerp(start_value, end_value, curve_val)),
		0.0,
		1.0,
		duration
	)
