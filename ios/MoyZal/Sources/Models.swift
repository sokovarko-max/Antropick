import Foundation

struct Exercise: Identifiable, Codable, Hashable {
    var id = UUID()
    var name: String
    var group: String
}

struct SetEntry: Identifiable, Codable, Hashable {
    var id = UUID()
    var weight: Double = 0
    var reps: Int = 0
    var done: Bool = false
}

struct WorkoutEntry: Identifiable, Codable, Hashable {
    var id = UUID()
    var exerciseID: UUID
    var exerciseName: String
    var sets: [SetEntry]
}

struct Workout: Identifiable, Codable, Hashable {
    var id = UUID()
    var date: Date
    var start: Date
    var end: Date
    var entries: [WorkoutEntry]
    var note: String = ""

    var durationMinutes: Int { Int(end.timeIntervalSince(start) / 60) }
    var tonnage: Int {
        entries.reduce(0) { acc, e in
            acc + e.sets.filter { $0.done }.reduce(0) { $0 + Int($1.weight * Double($1.reps)) }
        }
    }
    var doneSets: Int { entries.reduce(0) { $0 + $1.sets.filter { $0.done }.count } }
}

/// Активная (текущая) тренировка.
struct ActiveWorkout: Codable {
    var start: Date = Date()
    var entries: [WorkoutEntry] = []
    var note: String = ""
}

/// Хранилище приложения: тренировки, библиотека упражнений, настройки.
/// Персистентность — JSON-файл в Documents.
@MainActor
final class Store: ObservableObject {
    @Published var exercises: [Exercise]
    @Published var workouts: [Workout] = []
    @Published var active: ActiveWorkout?
    @Published var restSeconds: Int = 90 { didSet { save() } }

    private let url: URL = {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return dir.appendingPathComponent("moyzal.json")
    }()

    struct Persisted: Codable {
        var exercises: [Exercise]
        var workouts: [Workout]
        var active: ActiveWorkout?
        var restSeconds: Int
    }

    init() {
        exercises = Store.seedExercises
        load()
    }

    func load() {
        guard let data = try? Data(contentsOf: url),
              let p = try? JSONDecoder().decode(Persisted.self, from: data) else { return }
        exercises = p.exercises.isEmpty ? Store.seedExercises : p.exercises
        workouts = p.workouts
        active = p.active
        restSeconds = p.restSeconds > 0 ? p.restSeconds : 90
    }

    func save() {
        let p = Persisted(exercises: exercises, workouts: workouts, active: active, restSeconds: restSeconds)
        if let data = try? JSONEncoder().encode(p) { try? data.write(to: url) }
    }

    // MARK: - Управление тренировкой

    func startWorkout() { active = ActiveWorkout(); save() }

    func cancelWorkout() {
        active = nil
        NotificationManager.shared.cancelRest()
        save()
    }

    func addExercise(_ ex: Exercise) {
        guard active != nil else { return }
        let prev = lastSets(for: ex.id)
        let sets = prev.isEmpty
            ? [SetEntry(), SetEntry(), SetEntry()]
            : prev.map { SetEntry(weight: $0.weight, reps: $0.reps) }
        active?.entries.append(WorkoutEntry(exerciseID: ex.id, exerciseName: ex.name, sets: sets))
        save()
    }

    func lastSets(for exID: UUID) -> [SetEntry] {
        for w in workouts {
            for e in w.entries where e.exerciseID == exID {
                let done = e.sets.filter { $0.done }
                if !done.isEmpty { return done }
            }
        }
        return []
    }

    func finishWorkout() {
        guard var a = active else { return }
        a.entries = a.entries.compactMap { entry in
            var e = entry
            e.sets = e.sets.filter { $0.done || $0.weight > 0 || $0.reps > 0 }
            return e.sets.isEmpty ? nil : e
        }
        let w = Workout(date: Date(), start: a.start, end: Date(), entries: a.entries, note: a.note)
        workouts.insert(w, at: 0)
        active = nil
        NotificationManager.shared.cancelRest()
        save()
    }

    static let seedExercises: [Exercise] = [
        .init(name: "Жим штанги лёжа", group: "Грудь"),
        .init(name: "Жим гантелей лёжа", group: "Грудь"),
        .init(name: "Жим на наклонной скамье", group: "Грудь"),
        .init(name: "Разводка гантелей", group: "Грудь"),
        .init(name: "Отжимания на брусьях", group: "Грудь"),
        .init(name: "Подтягивания", group: "Спина"),
        .init(name: "Тяга верхнего блока", group: "Спина"),
        .init(name: "Тяга штанги в наклоне", group: "Спина"),
        .init(name: "Становая тяга", group: "Спина"),
        .init(name: "Гиперэкстензия", group: "Спина"),
        .init(name: "Приседания со штангой", group: "Ноги"),
        .init(name: "Жим ногами", group: "Ноги"),
        .init(name: "Выпады с гантелями", group: "Ноги"),
        .init(name: "Румынская тяга", group: "Ноги"),
        .init(name: "Разгибание ног", group: "Ноги"),
        .init(name: "Сгибание ног", group: "Ноги"),
        .init(name: "Жим штанги стоя", group: "Плечи"),
        .init(name: "Жим гантелей сидя", group: "Плечи"),
        .init(name: "Махи гантелями в стороны", group: "Плечи"),
        .init(name: "Подъём штанги на бицепс", group: "Бицепс"),
        .init(name: "Молотки", group: "Бицепс"),
        .init(name: "Французский жим", group: "Трицепс"),
        .init(name: "Разгибание на блоке", group: "Трицепс"),
        .init(name: "Скручивания", group: "Пресс"),
        .init(name: "Планка", group: "Пресс"),
        .init(name: "Подъём ног в висе", group: "Пресс"),
    ]
}
