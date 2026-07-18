using DashboardPro.Core.Models;

namespace DashboardPro.Core.DataSources;

public interface ITaskSource
{
    string Name { get; }
    Task<IReadOnlyList<TaskItem>> GetTasksAsync(CancellationToken ct = default);
    bool CanComplete => false;
    Task CompleteTaskAsync(TaskItem task, bool completed, CancellationToken ct = default) => Task.CompletedTask;
    bool CanAdd => false;
    Task AddTaskAsync(string title, DateTime? due, TaskPriority priority, CancellationToken ct = default) => Task.CompletedTask;
}

public interface ICalendarSource
{
    string Name { get; }
    Task<IReadOnlyList<CalendarEvent>> GetEventsAsync(DateTime from, DateTime to, CancellationToken ct = default);
}

public interface INoteSource
{
    string Name { get; }
    Task<IReadOnlyList<Note>> GetNotesAsync(CancellationToken ct = default);
    bool CanWrite => false;
    Task AddNoteAsync(string content, CancellationToken ct = default) => Task.CompletedTask;
    Task DeleteNoteAsync(Note note, CancellationToken ct = default) => Task.CompletedTask;
}

public interface IWeatherProvider
{
    string Name { get; }
    Task<WeatherInfo> GetWeatherAsync(CancellationToken ct = default);
}

/// <summary>
/// Точка расширения: плагин (DLL в папке %LOCALAPPDATA%\DashboardPro\Plugins)
/// регистрирует свои источники данных, не меняя ядро приложения.
/// </summary>
public interface IDashboardPlugin
{
    string Name { get; }
    void Register(ISourceRegistry registry);
}

public interface ISourceRegistry
{
    void RegisterTaskSource(string typeKey, Func<IReadOnlyDictionary<string, string>, ITaskSource> factory);
    void RegisterCalendarSource(string typeKey, Func<IReadOnlyDictionary<string, string>, ICalendarSource> factory);
    void RegisterNoteSource(string typeKey, Func<IReadOnlyDictionary<string, string>, INoteSource> factory);
    void RegisterWeatherProvider(string typeKey, Func<IReadOnlyDictionary<string, string>, IWeatherProvider> factory);
}
