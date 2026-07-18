using System.Globalization;
using System.Text.RegularExpressions;
using DashboardPro.Core.Models;

namespace DashboardPro.Core.DataSources;

/// <summary>
/// Задачи из Markdown-файла или папки (формат Obsidian/GFM: "- [ ] текст", "- [x] сделано").
/// Дата: "due:2026-07-18" или "📅 2026-07-18". Приоритет: "!" — высокий, "!!" — срочный.
/// </summary>
public sealed partial class MarkdownTaskSource(string path) : ITaskSource
{
    public string Name => "Markdown";

    [GeneratedRegex(@"^\s*[-*]\s*\[(?<done>[ xX])\]\s*(?<text>.+)$")]
    private static partial Regex TaskLine();

    [GeneratedRegex(@"(?:due:|📅\s*)(?<date>\d{4}-\d{2}-\d{2})")]
    private static partial Regex DueTag();

    public Task<IReadOnlyList<TaskItem>> GetTasksAsync(CancellationToken ct = default)
    {
        var files = Directory.Exists(path)
            ? Directory.EnumerateFiles(path, "*.md", SearchOption.AllDirectories)
            : File.Exists(path) ? new[] { path } : Array.Empty<string>();

        var tasks = new List<TaskItem>();
        foreach (var file in files)
        {
            foreach (var line in File.ReadAllLines(file))
            {
                var m = TaskLine().Match(line);
                if (!m.Success) continue;

                var text = m.Groups["text"].Value.Trim();
                DateTime? due = null;
                var dm = DueTag().Match(text);
                if (dm.Success)
                {
                    due = DateTime.ParseExact(dm.Groups["date"].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture);
                    text = DueTag().Replace(text, "").Trim();
                }

                var priority = TaskPriority.Normal;
                if (text.EndsWith("!!")) { priority = TaskPriority.Urgent; text = text.TrimEnd('!').Trim(); }
                else if (text.EndsWith("!")) { priority = TaskPriority.High; text = text.TrimEnd('!').Trim(); }

                tasks.Add(new TaskItem
                {
                    Title = text,
                    DueDate = due,
                    Priority = priority,
                    IsCompleted = m.Groups["done"].Value is "x" or "X",
                    Source = "markdown",
                    Project = Path.GetFileNameWithoutExtension(file)
                });
            }
        }
        return Task.FromResult<IReadOnlyList<TaskItem>>(tasks);
    }
}

/// <summary>Задачи из CSV: колонки title;due;priority;completed (разделитель , или ;).</summary>
public sealed class CsvTaskSource(string path) : ITaskSource
{
    public string Name => "CSV";

    public Task<IReadOnlyList<TaskItem>> GetTasksAsync(CancellationToken ct = default)
    {
        var tasks = new List<TaskItem>();
        if (!File.Exists(path)) return Task.FromResult<IReadOnlyList<TaskItem>>(tasks);

        var lines = File.ReadAllLines(path);
        foreach (var line in lines.Skip(lines.Length > 0 && lines[0].ToLowerInvariant().Contains("title") ? 1 : 0))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var parts = line.Split(line.Contains(';') ? ';' : ',');
            var t = new TaskItem { Title = parts[0].Trim().Trim('"'), Source = "csv" };
            if (parts.Length > 1 && DateTime.TryParse(parts[1].Trim(), out var due)) t.DueDate = due;
            if (parts.Length > 2 && Enum.TryParse<TaskPriority>(parts[2].Trim(), true, out var pr)) t.Priority = pr;
            if (parts.Length > 3) t.IsCompleted = parts[3].Trim() is "1" or "true" or "x";
            if (t.Title.Length > 0) tasks.Add(t);
        }
        return Task.FromResult<IReadOnlyList<TaskItem>>(tasks);
    }
}

/// <summary>Заметки из папки с Markdown/TXT-файлами (Obsidian-vault и т.п.).</summary>
public sealed class MarkdownNoteSource(string folder) : INoteSource
{
    public string Name => "Markdown-папка";
    public bool CanWrite => true;

    public Task<IReadOnlyList<Note>> GetNotesAsync(CancellationToken ct = default)
    {
        var notes = new List<Note>();
        if (Directory.Exists(folder))
        {
            foreach (var file in Directory.EnumerateFiles(folder, "*.*")
                         .Where(f => f.EndsWith(".md") || f.EndsWith(".txt"))
                         .OrderByDescending(File.GetLastWriteTime)
                         .Take(50))
            {
                notes.Add(new Note
                {
                    Title = Path.GetFileNameWithoutExtension(file),
                    Content = File.ReadAllText(file),
                    UpdatedAt = File.GetLastWriteTime(file),
                    Source = "markdown",
                    FilePath = file
                });
            }
        }
        return Task.FromResult<IReadOnlyList<Note>>(notes);
    }

    public Task AddNoteAsync(string content, CancellationToken ct = default)
    {
        Directory.CreateDirectory(folder);
        var name = $"Заметка {DateTime.Now:yyyy-MM-dd HH-mm-ss}.md";
        File.WriteAllText(Path.Combine(folder, name), content);
        return Task.CompletedTask;
    }

    public Task DeleteNoteAsync(Note note, CancellationToken ct = default)
    {
        if (note.FilePath is not null && File.Exists(note.FilePath)) File.Delete(note.FilePath);
        return Task.CompletedTask;
    }
}
