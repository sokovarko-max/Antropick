import SwiftUI

struct WorkoutView: View {
    @EnvironmentObject var store: Store
    @StateObject private var rest = RestTimer()
    @State private var showPicker = false
    @State private var now = Date()

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        NavigationStack {
            Group {
                if store.active == nil {
                    startScreen
                } else {
                    activeScreen
                }
            }
            .navigationTitle("Тренировка")
            .safeAreaInset(edge: .bottom) {
                if rest.isRunning { RestTimerBar(timer: rest).padding(.bottom, 6) }
            }
            .sheet(isPresented: $showPicker) {
                ExercisePicker { store.addExercise($0) }
            }
        }
        .onReceive(clock) { now = $0 }
    }

    private var startScreen: some View {
        VStack(spacing: 16) {
            Button {
                store.startWorkout()
                showPicker = true
            } label: {
                Text("Начать тренировку").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            if let last = store.workouts.first {
                GroupBox {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(last.date, format: .dateTime.day().month().weekday()).bold()
                        HStack(spacing: 14) {
                            Label("\(last.durationMinutes) мин", systemImage: "clock")
                            Label("\(last.tonnage) кг", systemImage: "scalemass")
                            Label("\(last.doneSets)", systemImage: "checkmark.circle")
                        }.font(.caption).foregroundStyle(.secondary)
                    }.frame(maxWidth: .infinity, alignment: .leading)
                } label: { Text("Прошлая тренировка") }
            }
            Spacer()
        }
        .padding()
    }

    private var activeScreen: some View {
        ScrollView {
            VStack(spacing: 12) {
                HStack {
                    Spacer()
                    if let a = store.active {
                        Text(elapsed(since: a.start))
                            .font(.headline.monospacedDigit()).foregroundStyle(.blue)
                    }
                }
                .padding(.horizontal)

                ForEach(Array((store.active?.entries ?? []).enumerated()), id: \.element.id) { idx, entry in
                    EntryCard(entryIndex: idx, rest: rest)
                }

                Button { showPicker = true } label: {
                    Label("Добавить упражнение", systemImage: "plus").frame(maxWidth: .infinity)
                }.buttonStyle(.bordered)

                TextField("Заметка к тренировке", text: Binding(
                    get: { store.active?.note ?? "" },
                    set: { store.active?.note = $0; store.save() }
                )).textFieldStyle(.roundedBorder).padding(.horizontal)

                Button {
                    store.finishWorkout(); rest.stop()
                } label: { Text("Завершить").frame(maxWidth: .infinity) }
                    .buttonStyle(.borderedProminent).tint(.green).controlSize(.large)

                Button(role: .destructive) {
                    store.cancelWorkout(); rest.stop()
                } label: { Text("Отменить").frame(maxWidth: .infinity) }
                    .buttonStyle(.bordered)
            }.padding(.vertical)
        }
    }

    private func elapsed(since start: Date) -> String {
        let s = max(0, Int(now.timeIntervalSince(start)))
        let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec)
                     : String(format: "%d:%02d", m, sec)
    }
}

private struct EntryCard: View {
    @EnvironmentObject var store: Store
    @ObservedObject var rest: RestTimer
    let entryIndex: Int

    private var entry: WorkoutEntry? {
        guard let e = store.active?.entries, entryIndex < e.count else { return nil }
        return e[entryIndex]
    }

    var body: some View {
        if let entry {
            GroupBox {
                VStack(spacing: 8) {
                    ForEach(Array(entry.sets.enumerated()), id: \.element.id) { i, _ in
                        HStack(spacing: 8) {
                            Text("\(i + 1)").foregroundStyle(.secondary).frame(width: 20)
                            TextField("кг", value: setBinding(i).weight, format: .number)
                                .keyboardType(.decimalPad).textFieldStyle(.roundedBorder)
                            TextField("повт", value: setBinding(i).reps, format: .number)
                                .keyboardType(.numberPad).textFieldStyle(.roundedBorder)
                            Button {
                                toggle(i)
                            } label: {
                                Image(systemName: entry.sets[i].done ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(entry.sets[i].done ? .green : .secondary)
                                    .font(.title2)
                            }
                        }
                    }
                    HStack {
                        Button("+ Подход") { addSet() }.buttonStyle(.bordered)
                        Button("− Подход") { removeSet() }.buttonStyle(.bordered)
                    }
                }
            } label: {
                HStack {
                    Text(entry.exerciseName).font(.headline)
                    Spacer()
                    Button(role: .destructive) { store.active?.entries.remove(at: entryIndex); store.save() }
                        label: { Image(systemName: "xmark") }
                }
            }
            .padding(.horizontal)
        }
    }

    private func setBinding(_ i: Int) -> (weight: Binding<Double>, reps: Binding<Int>) {
        (Binding(get: { store.active?.entries[entryIndex].sets[i].weight ?? 0 },
                 set: { store.active?.entries[entryIndex].sets[i].weight = $0; store.save() }),
         Binding(get: { store.active?.entries[entryIndex].sets[i].reps ?? 0 },
                 set: { store.active?.entries[entryIndex].sets[i].reps = $0; store.save() }))
    }

    private func toggle(_ i: Int) {
        guard store.active != nil else { return }
        store.active!.entries[entryIndex].sets[i].done.toggle()
        store.save()
        if store.active!.entries[entryIndex].sets[i].done {
            rest.start(seconds: store.restSeconds)
        }
    }

    private func addSet() {
        let last = store.active?.entries[entryIndex].sets.last
        store.active?.entries[entryIndex].sets.append(
            SetEntry(weight: last?.weight ?? 0, reps: last?.reps ?? 0))
        store.save()
    }

    private func removeSet() {
        if (store.active?.entries[entryIndex].sets.count ?? 0) > 1 {
            store.active?.entries[entryIndex].sets.removeLast()
            store.save()
        }
    }
}

struct ExercisePicker: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    let onPick: (Exercise) -> Void

    private var filtered: [Exercise] {
        query.isEmpty ? store.exercises
            : store.exercises.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }
    private var groups: [String] {
        Array(Set(filtered.map(\.group))).sorted()
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(groups, id: \.self) { g in
                    Section(g) {
                        ForEach(filtered.filter { $0.group == g }) { ex in
                            Button(ex.name) { onPick(ex); dismiss() }
                        }
                    }
                }
            }
            .searchable(text: $query, prompt: "Поиск упражнения")
            .navigationTitle("Упражнение")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Закрыть") { dismiss() } } }
        }
    }
}
