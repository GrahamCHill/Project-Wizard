package com.example.projectwizard.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class CounterTest {
    @Test
    fun incrementsTheCounter() {
        assertEquals(3, nextCount(2))
    }
}
