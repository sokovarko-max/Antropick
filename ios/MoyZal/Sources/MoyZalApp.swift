import SwiftUI

@main
struct MoyZalApp: App {
    @StateObject private var store = Store()
    @StateObject private var health = HealthManager.shared

    init() {
        NotificationManager.shared.requestAuthorization()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(health)
                .onAppear { health.requestAndStart() }
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            WorkoutView()
                .tabItem { Label("Тренировка", systemImage: "dumbbell") }
            HistoryView()
                .tabItem { Label("История", systemImage: "clock.arrow.circlepath") }
            HealthView()
                .tabItem { Label("Здоровье", systemImage: "heart") }
        }
    }
}
