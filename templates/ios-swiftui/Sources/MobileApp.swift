import SwiftUI

@main
struct MobileApp: App {
    var body: some Scene {
        WindowGroup {
            CounterView()
        }
    }
}

struct CounterView: View {
    @State private var count = 0

    var body: some View {
        VStack(spacing: 16) {
            Text("__PROJECT_NAME__")
                .font(.title)
            Text(count.formatted())
                .font(.largeTitle.monospacedDigit())
                .accessibilityLabel("Count: \(count)")
            Button("Increment") {
                count += 1
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
