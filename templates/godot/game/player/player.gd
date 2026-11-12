extends Node2D

@export var speed: float = 240.0


func _physics_process(delta: float) -> void:
	var direction := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	var margin := Vector2(15, 15)
	position = (position + direction * speed * delta).clamp(margin, get_viewport_rect().size - margin)
