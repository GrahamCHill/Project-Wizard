package com.example.projectwizard.xr

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.xr.compose.platform.LocalSession
import androidx.xr.compose.platform.LocalSpatialCapabilities
import androidx.xr.compose.spatial.Subspace
import androidx.xr.compose.subspace.SpatialPanel
import androidx.xr.compose.subspace.layout.SubspaceModifier
import androidx.xr.compose.subspace.layout.height
import androidx.xr.compose.subspace.layout.width
import androidx.xr.scenecore.scene

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                val session = LocalSession.current
                if (session != null && LocalSpatialCapabilities.current.isSpatialUiEnabled) {
                    Subspace {
                        SpatialPanel(SubspaceModifier.width(380.dp).height(230.dp)) {
                            Welcome("You are in Full Space", "Return to Home Space") {
                                session.scene.requestHomeSpace()
                            }
                        }
                    }
                } else if (session != null) {
                    Welcome("You are in Home Space", "Enter Full Space") {
                        session.scene.requestFullSpace()
                    }
                } else {
                    Welcome("Open this app on Android XR to see the spatial panel.")
                }
            }
        }
    }
}

@Composable
private fun Welcome(message: String, buttonLabel: String = "", onClick: (() -> Unit)? = null) {
    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("__PROJECT_NAME__", style = MaterialTheme.typography.headlineMedium)
            Text(message)
            if (onClick != null) {
                Button(onClick = onClick) { Text(buttonLabel) }
            }
        }
    }
}
