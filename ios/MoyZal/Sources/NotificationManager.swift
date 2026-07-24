import Foundation
import UserNotifications

/// Локальные уведомления об окончании отдыха.
/// Запланированное уведомление доставляется системой, даже если приложение
/// полностью закрыто. Если iPhone заблокирован — iOS автоматически дублирует
/// его на сопряжённые Apple Watch (стандартное зеркалирование уведомлений).
final class NotificationManager {
    static let shared = NotificationManager()
    private let restID = "rest-timer"

    private init() {}

    /// Запросить разрешение на уведомления (один раз при первом запуске).
    func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { _, _ in }
    }

    var isAuthorized: Bool {
        get async {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            return settings.authorizationStatus == .authorized
        }
    }

    /// Запланировать уведомление через `seconds` секунд.
    /// Сработает даже при свёрнутом или закрытом приложении.
    func scheduleRestEnd(after seconds: TimeInterval) {
        cancelRest()
        guard seconds > 0 else { return }

        let content = UNMutableNotificationContent()
        content.title = "Отдых окончен 💪"
        content.body = "Пора делать следующий подход!"
        content.sound = .default
        content.interruptionLevel = .timeSensitive // пробьётся сквозь «Не беспокоить»

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds, repeats: false)
        let request = UNNotificationRequest(identifier: restID, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    /// Отменить запланированное уведомление (пропуск отдыха / досрочный подход).
    func cancelRest() {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [restID])
    }
}
