package com.example.projectwizard.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

fun nextCount(count: Int): Int = count + 1

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                var count by rememberSaveable { mutableIntStateOf(0) }
                var selectedTab by rememberSaveable { mutableIntStateOf(0) }
                Scaffold { padding ->
                    Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                        PrimaryTabRow(selectedTabIndex = selectedTab) {
                            Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Home") })
                            Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("About") })
                        }
                        Column(
                            modifier = Modifier.fillMaxSize().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                        ) {
                            if (selectedTab == 0) {
                                Text("__PROJECT_NAME__", style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
                                Text(count.toString(), style = MaterialTheme.typography.headlineLarge)
                                Button(onClick = { count = nextCount(count) }) { Text("Increment") }
                            } else {
                                Text("About", style = MaterialTheme.typography.headlineMedium)
                                Text("A two-screen starter for __PROJECT_NAME__.", textAlign = TextAlign.Center)
                                Button(onClick = { count = 0 }) { Text("Reset counter") }
                            }
                        }
                    }
                }
            }
        }
    }
}
