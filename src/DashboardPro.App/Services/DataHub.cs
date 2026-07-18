using DashboardPro.Core.DataSources;
using DashboardPro.Core.Models;
using DashboardPro.Core.Services;

namespace DashboardPro.App.Services;

/// <summary>
/// Общий кэш данных: периодически опрашивает настроенные источники (задачи, календарь, заметки)
/// и раздаёт результат модулям через событие Updated. Ошибки отдельных источников не мешают остальным.
/// </summary>
public sealed class DataHub
{
    private readonly SettingsService _settings;
    private readonly SourceFactory _factory;
    private Timer? _timer;

    public ITaskSource? TaskSource { get; private set; }
    public ICalendarSource? CalendarSource { get; private set; }
    public INoteSource? NoteSource { get; private set; }

    public IReadOnlyList<TaskItem> Tasks { get; private set; } = Array.Empty<TaskItem>();
    public IReadOnlyList<CalendarEvent> Events { get; private set; } = Array.Empty<CalendarEvent>();
    public IReadOnlyList<Note> Notes { get; private set; } = Array.Empty<Note>();

    public string? TasksError { get; private set; }
    public string? EventsError { get; private set; }
    public string? NotesError { get; private set; }

    /// <summary>Срабатывает в фоновом потоке — подписчики сами переходят в UI-поток.</summary>
    public event Action? Updated;

    public DataHub(SettingsService settings, SourceFactory factory)
    {
        _settings = settings;
        _factory = factory;
    }

    public void Start()
    {
        RebuildSources();
        var period = TimeSpan.FromMinutes(Math.Max(1, _settings.Current.DataRefreshMinutes));
        _timer = new Timer(_ => _ = RefreshAsync(), null, TimeSpan.Zero, period);
    }

    /// <summary>Вызывается после изменения настроек: пересоздаёт источники и перечитывает данные.</summary>
    public void Restart()
    {
        RebuildSources();
        var period = TimeSpan.FromMinutes(Math.Max(1, _settings.Current.DataRefreshMinutes));
        _timer?.Change(TimeSpan.Zero, period);
    }

    private void RebuildSources()
    {
        try { TaskSource = _factory.CreateTaskSource(_settings.Current.TaskSource); TasksError = null; }
        catch (Exception ex) { TaskSource = null; TasksError = ex.Message; }
        try { CalendarSource = _factory.CreateCalendarSource(_settings.Current.CalendarSource); EventsError = null; }
        catch (Exception ex) { CalendarSource = null; EventsError = ex.Message; }
        try { NoteSource = _factory.CreateNoteSource(_settings.Current.NotesSource); NotesError = null; }
        catch (Exception ex) { NoteSource = null; NotesError = ex.Message; }
    }

    public async Task RefreshAsync()
    {
        if (TaskSource is not null)
        {
            try { Tasks = await TaskSource.GetTasksAsync(); TasksError = null; }
            catch (Exception ex) { TasksError = ex.Message; }
        }
        else Tasks = Array.Empty<TaskItem>();

        if (CalendarSource is not null)
        {
            try
            {
                Events = await CalendarSource.GetEventsAsync(DateTime.Today, DateTime.Today.AddDays(7));
                EventsError = null;
            }
            catch (Exception ex) { EventsError = ex.Message; }
        }
        else Events = Array.Empty<CalendarEvent>();

        if (NoteSource is not null)
        {
            try { Notes = await NoteSource.GetNotesAsync(); NotesError = null; }
            catch (Exception ex) { NotesError = ex.Message; }
        }
        else Notes = Array.Empty<Note>();

        Updated?.Invoke();
    }

    public async Task CompleteTaskAsync(TaskItem task, bool completed)
    {
        if (TaskSource is { CanComplete: true })
        {
            try { await TaskSource.CompleteTaskAsync(task, completed); } catch { /* показываем при следующем обновлении */ }
        }
        await RefreshAsync();
    }

    public async Task AddTaskAsync(string title)
    {
        if (TaskSource is { CanAdd: true })
        {
            try { await TaskSource.AddTaskAsync(title, null, TaskPriority.Normal); } catch { }
        }
        await RefreshAsync();
    }

    public async Task AddNoteAsync(string content)
    {
        if (NoteSource is { CanWrite: true })
        {
            try { await NoteSource.AddNoteAsync(content); } catch { }
        }
        await RefreshAsync();
    }

    public async Task DeleteNoteAsync(Note note)
    {
        if (NoteSource is { CanWrite: true })
        {
            try { await NoteSource.DeleteNoteAsync(note); } catch { }
        }
        await RefreshAsync();
    }
}
