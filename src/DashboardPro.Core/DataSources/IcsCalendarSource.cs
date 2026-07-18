using System.Globalization;
using DashboardPro.Core.Models;

namespace DashboardPro.Core.DataSources;

/// <summary>
/// Календарь из ICS-ленты: секретная ссылка Google Calendar, «Опубликовать календарь» в Outlook,
/// либо локальный .ics файл. Повторяющиеся события (RRULE) в v1 не разворачиваются.
/// </summary>
public sealed class IcsCalendarSource(string urlOrPath) : ICalendarSource
{
    private static readonly HttpClient Http = new();

    public string Name => "ICS-календарь";

    public async Task<IReadOnlyList<CalendarEvent>> GetEventsAsync(DateTime from, DateTime to, CancellationToken ct = default)
    {
        string text;
        if (urlOrPath.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            text = await Http.GetStringAsync(urlOrPath, ct);
        else
            text = await File.ReadAllTextAsync(urlOrPath, ct);

        return Parse(text).Where(e => e.End >= from && e.Start < to).OrderBy(e => e.Start).ToList();
    }

    private static List<CalendarEvent> Parse(string ics)
    {
        // Разворачиваем «сложенные» строки (продолжение начинается с пробела/таба)
        var raw = ics.Replace("\r\n", "\n").Split('\n');
        var lines = new List<string>();
        foreach (var line in raw)
        {
            if (line.Length > 0 && (line[0] == ' ' || line[0] == '\t') && lines.Count > 0)
                lines[^1] += line[1..];
            else
                lines.Add(line);
        }

        var events = new List<CalendarEvent>();
        CalendarEvent? cur = null;
        bool startIsDate = false;

        foreach (var line in lines)
        {
            if (line.StartsWith("BEGIN:VEVENT")) { cur = new CalendarEvent(); startIsDate = false; continue; }
            if (line.StartsWith("END:VEVENT"))
            {
                if (cur is not null && cur.Title.Length > 0)
                {
                    if (cur.End == default) cur.End = startIsDate ? cur.Start.AddDays(1) : cur.Start.AddHours(1);
                    cur.IsAllDay = startIsDate;
                    events.Add(cur);
                }
                cur = null;
                continue;
            }
            if (cur is null) continue;

            var idx = line.IndexOf(':');
            if (idx < 0) continue;
            var key = line[..idx];
            var value = line[(idx + 1)..].Trim();
            var name = key.Split(';')[0];

            switch (name)
            {
                case "SUMMARY": cur.Title = Unescape(value); break;
                case "LOCATION": cur.Location = Unescape(value); break;
                case "UID": cur.Id = value; break;
                case "DTSTART":
                    cur.Start = ParseIcsDate(value, key, out startIsDate);
                    break;
                case "DTEND":
                    cur.End = ParseIcsDate(value, key, out _);
                    break;
            }
        }
        return events;
    }

    private static DateTime ParseIcsDate(string value, string key, out bool isDateOnly)
    {
        isDateOnly = key.Contains("VALUE=DATE") || value.Length == 8;
        if (isDateOnly &&
            DateTime.TryParseExact(value, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d))
            return d;
        if (value.EndsWith("Z") &&
            DateTime.TryParseExact(value, "yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var utc))
            return utc.ToLocalTime();
        if (DateTime.TryParseExact(value, "yyyyMMdd'T'HHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
            return local; // TZID игнорируем в v1 — считаем локальным временем
        DateTime.TryParse(value, out var fallback);
        return fallback;
    }

    private static string Unescape(string s) =>
        s.Replace("\\n", "\n").Replace("\\,", ",").Replace("\\;", ";").Replace("\\\\", "\\");
}
