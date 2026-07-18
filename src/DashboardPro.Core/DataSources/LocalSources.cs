using DashboardPro.Core.Models;
using DashboardPro.Core.Services;

namespace DashboardPro.Core.DataSources;

public sealed class LocalTaskSource(LocalStore store) : ITaskSource
{
    public string Name => "База приложения";
    public bool CanComplete => true;
    public bool CanAdd => true;

    public Task<IReadOnlyList<TaskItem>> GetTasksAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<TaskItem>>(store.GetTasks());

    public Task CompleteTaskAsync(TaskItem task, bool completed, CancellationToken ct = default)
    {
        store.SetTaskCompleted(task.Id, completed);
        return Task.CompletedTask;
    }

    public Task AddTaskAsync(string title, DateTime? due, TaskPriority priority, CancellationToken ct = default)
    {
        store.AddTask(title, due, priority);
        return Task.CompletedTask;
    }
}

public sealed class LocalNoteSource(LocalStore store) : INoteSource
{
    public string Name => "База приложения";
    public bool CanWrite => true;

    public Task<IReadOnlyList<Note>> GetNotesAsync(CancellationToken ct = default) =>
        Task.FromResult<IReadOnlyList<Note>>(store.GetNotes());

    public Task AddNoteAsync(string content, CancellationToken ct = default)
    {
        var title = content.Split('\n')[0].Trim();
        if (title.Length > 40) title = title[..40] + "…";
        store.AddNote(title, content);
        return Task.CompletedTask;
    }

    public Task DeleteNoteAsync(Note note, CancellationToken ct = default)
    {
        store.DeleteNote(note.Id);
        return Task.CompletedTask;
    }
}
