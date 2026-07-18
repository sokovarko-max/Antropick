using DashboardPro.Core.Models;

namespace DashboardPro.Core.Services;

/// <summary>
/// «Интеллектуальный модуль»: анализирует задачи и календарь и формирует подсказки.
/// Базовая реализация — на правилах; интерфейс позволяет подключить LLM-провайдера плагином.
/// </summary>
public interface IInsightProvider
{
    Task<IReadOnlyList<Insight>> GetInsightsAsync(
        IReadOnlyList<TaskItem> tasks, IReadOnlyList<CalendarEvent> events, DateTime now,
        CancellationToken ct = default);
}

public sealed class RuleBasedInsightProvider : IInsightProvider
{
    public Task<IReadOnlyList<Insight>> GetInsightsAsync(
        IReadOnlyList<TaskItem> tasks, IReadOnlyList<CalendarEvent> events, DateTime now,
        CancellationToken ct = default)
    {
        var insights = new List<Insight>();
        var active = tasks.Where(t => !t.IsCompleted).ToList();

        // Просроченные задачи
        var overdue = active.Where(t => t.IsOverdue).OrderBy(t => t.DueDate).ToList();
        if (overdue.Count > 0)
        {
            insights.Add(new Insight
            {
                Severity = InsightSeverity.Warning,
                Text = overdue.Count == 1
                    ? $"Просрочена задача «{overdue[0].Title}»."
                    : $"Просроченных задач: {overdue.Count}. Начните с «{overdue[0].Title}»."
            });
        }

        // Ближайшая встреча
        var next = events.Where(e => !e.IsAllDay && e.Start > now).OrderBy(e => e.Start).FirstOrDefault();
        if (next is not null)
        {
            var minutes = (int)Math.Round((next.Start - now).TotalMinutes);
            if (minutes <= 60)
                insights.Add(new Insight
                {
                    Severity = InsightSeverity.Warning,
                    Text = $"До «{next.Title}» осталось {minutes} мин."
                });
            else if (next.Start.Date == now.Date)
                insights.Add(new Insight
                {
                    Severity = InsightSeverity.Info,
                    Text = $"Следующая встреча — «{next.Title}» в {next.Start:HH:mm}."
                });
        }

        // Свободное окно — предложить главную задачу
        var top = active
            .OrderByDescending(t => t.IsOverdue)
            .ThenByDescending(t => t.Priority)
            .ThenBy(t => t.DueDate ?? DateTime.MaxValue)
            .FirstOrDefault();
        var minutesToNext = next is null ? int.MaxValue : (int)(next.Start - now).TotalMinutes;
        if (top is not null && minutesToNext > 90)
        {
            insights.Add(new Insight
            {
                Severity = InsightSeverity.Suggestion,
                Text = $"Сейчас хорошее окно для фокуса: займитесь «{top.Title}»."
            });
        }

        // Дедлайны сегодня
        var dueToday = active.Count(t => t.IsDueToday);
        if (dueToday > 0)
            insights.Add(new Insight
            {
                Severity = InsightSeverity.Info,
                Text = $"Сегодня дедлайн у {dueToday} задач(и)."
            });

        if (insights.Count == 0)
            insights.Add(new Insight { Severity = InsightSeverity.Info, Text = "Всё под контролем — просроченных задач нет." });

        return Task.FromResult<IReadOnlyList<Insight>>(insights);
    }
}
