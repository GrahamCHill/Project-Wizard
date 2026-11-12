extends Label


func _ready() -> void:
	if ClassDB.can_instantiate(&"NativeGreeting"):
		var greeting = ClassDB.instantiate(&"NativeGreeting")
		text = greeting.message()
	else:
		text = "Build the native library using the README, then reopen Godot."
