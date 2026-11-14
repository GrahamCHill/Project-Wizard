package com.example.mobile;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public final class CounterTest {
    @Test
    public void increments() {
        assertEquals(5, Counter.next(4));
    }
}
