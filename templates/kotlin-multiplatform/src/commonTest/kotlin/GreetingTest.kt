package starter

import kotlin.test.Test
import kotlin.test.assertEquals

class GreetingTest {
    @Test
    fun greetsNamedAndDefaultCallers() {
        assertEquals("Hello, Kotlin!", greet("Kotlin"))
        assertEquals("Hello, World!", greet(""))
    }
}
