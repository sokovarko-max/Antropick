import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var store: Store
    @EnvironmentObject var health: HealthManager

    /// Общая лента: тренировки в зале + тренировки с Apple Watch по дате.
    private enum Item: Identifiable {
        case gym(Workout)
        case watch(HealthWorkout)
        var id: String {
            switch self {
            case .gym(let w): return "g" + w.id.uuidString
            case .watch(let w): return "w" + w.id
            }
        }
        var date: Date {
            switch self { case .gym(let w): return w.date; case .watch(let w): return w.date }
        }
    }

    private var items: [Item] {
        (store.workouts.map(Item.gym) + health.workouts.map(Item.watch))
            .sorted { $0.date > $1.date }
    }

    var body: some View {
        NavigationStack {
            List {
                if items.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "book").font(.largeTitle).foregroundStyle(.secondary)
                        Text("История пуста").font(.headline)
                        Text("Здесь появятся твои тренировки.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowSeparator(.hidden)
                }
                ForEach(items) { item in
                    switch item {
                    case .gym(let w): gymRow(w)
                    case .watch(let w): watchRow(w)
                    }
                }
            }
            .navigationTitle("История")
        }
    }

    private func gymRow(_ w: Workout) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(w.date, format: .dateTime.day().month().weekday()).bold()
            HStack(spacing: 14) {
                Label("\(w.durationMinutes) мин", systemImage: "clock")
                Label("\(w.tonnage) кг", systemImage: "scalemass")
                Label("\(w.doneSets)", systemImage: "checkmark.circle")
            }.font(.caption).foregroundStyle(.secondary)
            ForEach(w.entries) { e in
                Text(e.exerciseName + ": " +
                     e.sets.filter { $0.done }.map { "\(Int($0.weight))×\($0.reps)" }.joined(separator: ", "))
                    .font(.caption)
            }
            if !w.note.isEmpty { Text("📝 " + w.note).font(.caption).foregroundStyle(.secondary) }
        }
    }

    private func watchRow(_ w: HealthWorkout) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("⌚ " + w.type).bold()
            HStack(spacing: 14) {
                Text(w.date, format: .dateTime.day().month().weekday())
                if w.minutes > 0 { Label("\(w.minutes) мин", systemImage: "clock") }
                if w.kcal > 0 { Label("\(w.kcal) ккал", systemImage: "flame") }
                if w.avgHR > 0 { Label("\(w.avgHR)–\(w.maxHR)", systemImage: "heart") }
                if w.km > 0 { Label(String(format: "%.2f км", w.km), systemImage: "ruler") }
            }.font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct HealthView: View {
    @EnvironmentObject var health: HealthManager

    private var last4wSummary: (min: Int, kcal: Int, avgHR: Int, km: Double) {
        let cutoff = Date().addingTimeInterval(-28 * 24 * 3600)
        let recent = health.workouts.filter { $0.date >= cutoff }
        let mins = recent.reduce(0) { $0 + $1.minutes }
        let kcal = recent.reduce(0) { $0 + $1.kcal }
        let kms = (recent.reduce(0.0) { $0 + $1.km } * 10).rounded() / 10
        let hrs = recent.filter { $0.avgHR > 0 }
        let avg = hrs.isEmpty ? 0 : hrs.reduce(0) { $0 + $1.avgHR } / hrs.count
        return (mins, kcal, avg, kms)
    }

    var body: some View {
        NavigationStack {
            List {
                if !health.isAvailable {
                    Text("HealthKit недоступен на этом устройстве.")
                } else if !health.authorized {
                    Section {
                        Text("Разреши доступ к «Здоровью», чтобы данные с Apple Watch подтягивались автоматически.")
                        Button("Разрешить доступ к Здоровью") { health.requestAndStart() }
                    }
                } else {
                    let s = last4wSummary
                    Section("⌚ Здоровье за 4 недели") {
                        LabeledContent("Минут кардио", value: "\(s.min)")
                        LabeledContent("Ккал сожжено", value: "\(s.kcal)")
                        if s.avgHR > 0 { LabeledContent("Средний пульс", value: "❤️ \(s.avgHR)") }
                        if s.km > 0 { LabeledContent("Дистанция", value: String(format: "%.1f км", s.km)) }
                    }
                    if let bm = health.latestBodyMass {
                        Section("Вес тела") {
                            LabeledContent(bm.date.formatted(.dateTime.day().month()),
                                           value: String(format: "%.1f кг", bm.kg))
                        }
                    }
                    Section {
                        Button("Обновить сейчас") { Task { await health.refresh() } }
                    }
                }
            }
            .navigationTitle("Здоровье")
            .refreshable { await health.refresh() }
        }
    }
}
