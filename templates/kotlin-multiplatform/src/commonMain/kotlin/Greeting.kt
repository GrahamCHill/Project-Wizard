package starter

fun greet(name: String): String = "Hello, ${name.ifBlank { "World" }}!"
