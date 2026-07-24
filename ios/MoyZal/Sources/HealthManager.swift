import Foundation
import HealthKit

/// Тренировка, прочитанная из Apple Health (Apple Watch).
struct HealthWorkout: Identifiable, Codable, Equatable {
    var id: String
    var date: Date
    var type: String
    var minutes: Int
    var kcal: Int
    var avgHR: Int
    var maxHR: Int
    var km: Double
}

/// Автоматическое чтение данных из HealthKit: тренировки с часов
/// (пульс, калории, дистанция) и вес тела. Наблюдатель (HKObserverQuery)
/// с фоновой доставкой обновляет данные автоматически при появлении новых.
@MainActor
final class HealthManager: ObservableObject {
    static let shared = HealthManager()
    private let store = HKHealthStore()

    @Published var workouts: [HealthWorkout] = []
    @Published var latestBodyMass: (kg: Double, date: Date)?
    @Published var authorized = false

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [HKObjectType.workoutType()]
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) { types.insert(hr) }
        if let en = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { types.insert(en) }
        if let bm = HKObjectType.quantityType(forIdentifier: .bodyMass) { types.insert(bm) }
        if let dr = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) { types.insert(dr) }
        if let dc = HKObjectType.quantityType(forIdentifier: .distanceCycling) { types.insert(dc) }
        return types
    }

    /// Запросить доступ и включить автоматическое обновление.
    func requestAndStart() {
        guard isAvailable else { return }
        store.requestAuthorization(toShare: [], read: readTypes) { [weak self] ok, _ in
            Task { @MainActor in
                guard let self else { return }
                self.authorized = ok
                if ok {
                    await self.refresh()
                    self.startObserving()
                }
            }
        }
    }

    /// Разовое обновление всех данных.
    func refresh() async {
        await fetchWorkouts()
        await fetchBodyMass()
    }

    // MARK: - Автоматическое наблюдение

    private func startObserving() {
        let wType = HKObjectType.workoutType()
        let q = HKObserverQuery(sampleType: wType, predicate: nil) { [weak self] _, completion, _ in
            Task { @MainActor in await self?.fetchWorkouts() }
            completion()
        }
        store.execute(q)
        store.enableBackgroundDelivery(for: wType, frequency: .immediate) { _, _ in }

        if let bm = HKObjectType.quantityType(forIdentifier: .bodyMass) {
            let bq = HKObserverQuery(sampleType: bm, predicate: nil) { [weak self] _, completion, _ in
                Task { @MainActor in await self?.fetchBodyMass() }
                completion()
            }
            store.execute(bq)
        }
    }

    // MARK: - Чтение тренировок

    private func fetchWorkouts() async {
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let samples: [HKWorkout] = await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: HKObjectType.workoutType(),
                                  predicate: nil, limit: 100, sortDescriptors: [sort]) { _, res, _ in
                cont.resume(returning: (res as? [HKWorkout]) ?? [])
            }
            store.execute(q)
        }

        var result: [HealthWorkout] = []
        for w in samples {
            let (avg, max) = await heartRate(for: w)
            result.append(HealthWorkout(
                id: w.uuid.uuidString,
                date: w.startDate,
                type: Self.name(for: w.workoutActivityType),
                minutes: Int(w.duration / 60),
                kcal: Int(energy(for: w)),
                avgHR: avg, maxHR: max,
                km: distance(for: w)
            ))
        }
        workouts = result
    }

    private func energy(for w: HKWorkout) -> Double {
        if let e = w.statistics(for: HKQuantityType(.activeEnergyBurned))?
            .sumQuantity()?.doubleValue(for: .kilocalorie()) { return e }
        return w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
    }

    private func distance(for w: HKWorkout) -> Double {
        let meters = w.statistics(for: HKQuantityType(.distanceWalkingRunning))?
            .sumQuantity()?.doubleValue(for: .meter())
            ?? w.statistics(for: HKQuantityType(.distanceCycling))?
            .sumQuantity()?.doubleValue(for: .meter())
            ?? w.totalDistance?.doubleValue(for: .meter()) ?? 0
        return (meters / 1000 * 100).rounded() / 100
    }

    private func heartRate(for w: HKWorkout) async -> (Int, Int) {
        guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else { return (0, 0) }
        let pred = HKQuery.predicateForSamples(withStart: w.startDate, end: w.endDate, options: [])
        return await withCheckedContinuation { cont in
            let q = HKStatisticsQuery(quantityType: hrType, quantitySamplePredicate: pred,
                                      options: [.discreteAverage, .discreteMax]) { _, stats, _ in
                let unit = HKUnit.count().unitDivided(by: .minute())
                let avg = stats?.averageQuantity()?.doubleValue(for: unit) ?? 0
                let max = stats?.maximumQuantity()?.doubleValue(for: unit) ?? 0
                cont.resume(returning: (Int(avg.rounded()), Int(max.rounded())))
            }
            store.execute(q)
        }
    }

    // MARK: - Вес тела

    private func fetchBodyMass() async {
        guard let bm = HKObjectType.quantityType(forIdentifier: .bodyMass) else { return }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let sample: HKQuantitySample? = await withCheckedContinuation { cont in
            let q = HKSampleQuery(sampleType: bm, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, res, _ in
                cont.resume(returning: res?.first as? HKQuantitySample)
            }
            store.execute(q)
        }
        if let s = sample {
            latestBodyMass = (kg: (s.quantity.doubleValue(for: .gramUnit(with: .kilo)) * 10).rounded() / 10,
                              date: s.startDate)
        }
    }

    // MARK: - Названия активностей

    static func name(for t: HKWorkoutActivityType) -> String {
        switch t {
        case .running: return "Бег"
        case .walking: return "Ходьба"
        case .cycling: return "Велосипед"
        case .swimming: return "Плавание"
        case .elliptical: return "Эллипс"
        case .rowing: return "Гребля"
        case .hiking: return "Хайкинг"
        case .yoga: return "Йога"
        case .pilates: return "Пилатес"
        case .jumpRope: return "Скакалка"
        case .traditionalStrengthTraining: return "Силовая тренировка"
        case .functionalStrengthTraining: return "Функциональная тренировка"
        case .highIntensityIntervalTraining: return "ВИИТ"
        case .crossTraining: return "Кросс-тренинг"
        case .coreTraining: return "Пресс и кор"
        case .dance, .cardioDance: return "Танцы"
        case .boxing: return "Бокс"
        case .martialArts: return "Единоборства"
        case .soccer: return "Футбол"
        case .basketball: return "Баскетбол"
        case .tennis: return "Теннис"
        default: return "Тренировка"
        }
    }
}
