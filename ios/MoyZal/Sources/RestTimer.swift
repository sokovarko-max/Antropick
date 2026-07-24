import SwiftUI

/// Таймер отдыха. Считает от абсолютного времени окончания, поэтому
/// не сбивается при сворачивании приложения. При запуске планирует
/// системное уведомление — оно придёт даже при закрытом приложении
/// и продублируется на Apple Watch.
@MainActor
final class RestTimer: ObservableObject {
    @Published var endAt: Date?
    @Published var remaining: Int = 0
    private var timer: Timer?

    var isRunning: Bool { endAt != nil }

    func start(seconds: Int) {
        let end = Date().addingTimeInterval(TimeInterval(seconds))
        endAt = end
        remaining = seconds
        NotificationManager.shared.scheduleRestEnd(after: TimeInterval(seconds))
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    func add(seconds: Int) {
        guard let end = endAt else { return }
        let newEnd = end.addingTimeInterval(TimeInterval(seconds))
        endAt = newEnd
        remaining = max(0, Int(newEnd.timeIntervalSinceNow.rounded()))
        NotificationManager.shared.scheduleRestEnd(after: newEnd.timeIntervalSinceNow)
    }

    func stop() {
        timer?.invalidate(); timer = nil
        endAt = nil
        remaining = 0
        NotificationManager.shared.cancelRest()
    }

    private func tick() {
        guard let end = endAt else { return }
        let left = Int(end.timeIntervalSinceNow.rounded())
        if left <= 0 { stop() } else { remaining = left }
    }

    var label: String {
        let m = remaining / 60, s = remaining % 60
        return String(format: "%d:%02d", m, s)
    }
}

struct RestTimerBar: View {
    @ObservedObject var timer: RestTimer

    var body: some View {
        HStack {
            Text("Отдых").foregroundStyle(.secondary)
            Text(timer.label).font(.title2.bold().monospacedDigit()).foregroundStyle(.blue)
            Spacer()
            Button("+15 c") { timer.add(seconds: 15) }
                .buttonStyle(.bordered)
            Button("Пропустить") { timer.stop() }
                .buttonStyle(.bordered)
        }
        .padding()
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(.blue, lineWidth: 1))
        .padding(.horizontal)
    }
}
