using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using DashboardPro.Core.Models;

namespace DashboardPro.Core.DataSources;

/// <summary>Todoist REST API v2. Требуется API-токен (Настройки Todoist → Интеграции → Для разработчиков).</summary>
public sealed class TodoistTaskSource : ITaskSource
{
    private readonly HttpClient _http;

    public TodoistTaskSource(string apiToken)
    {
        _http = new HttpClient { BaseAddress = new Uri("https://api.todoist.com/rest/v2/") };
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiToken);
    }

    public string Name => "Todoist";
    public bool CanComplete => true;

    private sealed class TodoistDue
    {
        [JsonPropertyName("date")] public string? Date { get; set; }
        [JsonPropertyName("datetime")] public string? DateTime { get; set; }
    }

    private sealed class TodoistTask
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("content")] public string Content { get; set; } = "";
        [JsonPropertyName("priority")] public int Priority { get; set; } = 1;
        [JsonPropertyName("due")] public TodoistDue? Due { get; set; }
        [JsonPropertyName("project_id")] public string? ProjectId { get; set; }
    }

    public async Task<IReadOnlyList<TaskItem>> GetTasksAsync(CancellationToken ct = default)
    {
        var items = await _http.GetFromJsonAsync<List<TodoistTask>>("tasks", ct) ?? new();
        return items.Select(t => new TaskItem
        {
            Title = t.Content,
            ExternalId = t.Id,
            Source = "todoist",
            // Todoist: 4 = самый высокий приоритет (p1)
            Priority = t.Priority switch { 4 => TaskPriority.Urgent, 3 => TaskPriority.High, 2 => TaskPriority.Normal, _ => TaskPriority.Low },
            DueDate = ParseDue(t.Due)
        }).ToList();
    }

    private static DateTime? ParseDue(TodoistDue? due)
    {
        if (due is null) return null;
        if (due.DateTime is not null && DateTime.TryParse(due.DateTime, out var dt)) return dt.ToLocalTime();
        if (due.Date is not null && DateTime.TryParse(due.Date, out var d)) return d;
        return null;
    }

    public async Task CompleteTaskAsync(TaskItem task, bool completed, CancellationToken ct = default)
    {
        if (task.ExternalId is null) return;
        var url = completed ? $"tasks/{task.ExternalId}/close" : $"tasks/{task.ExternalId}/reopen";
        (await _http.PostAsync(url, null, ct)).EnsureSuccessStatusCode();
    }
}
