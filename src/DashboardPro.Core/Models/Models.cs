namespace DashboardPro.Core.Models;

public enum TaskPriority { Low = 0, Normal = 1, High = 2, Urgent = 3 }

public sealed class TaskItem
{
    public long Id { get; set; }
    public string Title { get; set; } = "";
    public string? Notes { get; set; }
    public DateTime? DueDate { get; set; }
    public TaskPriority Priority { get; set; } = TaskPriority.Normal;
    public bool IsCompleted { get; set; }
    public string? Project { get; set; }
    public string Source { get; set; } = "local";
    public string? ExternalId { get; set; }

    public bool IsOverdue => !IsCompleted && DueDate.HasValue && DueDate.Value.Date < DateTime.Today;
    public bool IsDueToday => DueDate.HasValue && DueDate.Value.Date == DateTime.Today;
    public string DueDisplay => DueDate is null ? "" :
        IsOverdue ? $"просрочено • {DueDate:d MMM}" :
        IsDueToday ? "сегодня" : DueDate.Value.ToString("d MMM");
    public bool HasDue => DueDate.HasValue;
    public bool IsImportant => Priority >= TaskPriority.High;
}

public sealed class CalendarEvent
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Title { get; set; } = "";
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string? Location { get; set; }
    public bool IsAllDay { get; set; }
    public string Source { get; set; } = "ics";

    public string TimeRange => IsAllDay ? "Весь день" : $"{Start:HH:mm}–{End:HH:mm}";
}

public sealed class Note
{
    public long Id { get; set; }
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
    public string Source { get; set; } = "local";
    public string? FilePath { get; set; }

    public string Excerpt
    {
        get
        {
            var text = Content.Replace("\r", " ").Replace("\n", " ").Trim();
            return text.Length > 120 ? text[..120] + "…" : text;
        }
    }
}

public sealed class Habit
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public int TargetPerWeek { get; set; } = 7;
}

public sealed class Project
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime? Deadline { get; set; }
    public int TotalTasks { get; set; }
    public int DoneTasks { get; set; }
    public string? NextStep { get; set; }
    public string Source { get; set; } = "local";

    public double Progress => TotalTasks <= 0 ? 0 : Math.Clamp(100.0 * DoneTasks / TotalTasks, 0, 100);
    public string StatsDisplay
    {
        get
        {
            var s = $"{DoneTasks}/{TotalTasks} задач";
            if (Deadline.HasValue) s += $" • до {Deadline:d MMM}";
            return s;
        }
    }
}

public enum PomodoroKind { Work, ShortBreak, LongBreak }

public sealed class WeatherInfo
{
    public double Temperature { get; set; }
    public double FeelsLike { get; set; }
    public string Description { get; set; } = "";
    public string City { get; set; } = "";
    public int Humidity { get; set; }
    public double WindSpeed { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}

public enum InsightSeverity { Info, Suggestion, Warning }

public sealed class Insight
{
    public string Text { get; set; } = "";
    public InsightSeverity Severity { get; set; } = InsightSeverity.Info;
    public string Glyph => Severity switch
    {
        InsightSeverity.Warning => "\uE7BA",
        InsightSeverity.Suggestion => "\uEA80",
        _ => "\uE946"
    };
}
