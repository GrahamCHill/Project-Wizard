import SwiftUI

@main
struct MobileApp: App {
    var body: some Scene {
        WindowGroup {
            MobileTabs()
        }
    }
}

struct MobileTabs: View {
    @State private var count = 0

    var body: some View {
        TabView {
            VStack(spacing: 16) {
                Text("__PROJECT_NAME__")
                    .font(.title)
                Text(count.formatted())
                    .font(.largeTitle.monospacedDigit())
                    .accessibilityLabel("Count: \(count)")
                Button("Increment") { count += 1 }
                    .buttonStyle(.borderedProminent)
            }
            .padding()
            .tabItem { Label("Home", systemImage: "house") }

            VStack(spacing: 16) {
                Text("About").font(.title)
                Text("A two-screen starter for __PROJECT_NAME__.")
                    .multilineTextAlignment(.center)
                Button("Reset counter") { count = 0 }
                    .buttonStyle(.borderedProminent)
            }
            .padding()
            .tabItem { Label("About", systemImage: "info.circle") }
        }
    }
}
