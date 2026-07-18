using System.Reflection;
using DashboardPro.Core.Services;

namespace DashboardPro.Core.DataSources;

/// <summary>
/// Реестр и фабрика источников данных. Встроенные типы регистрируются в конструкторе,
/// дополнительные — плагинами через <see cref="IDashboardPlugin"/>.
/// </summary>
public sealed class SourceFactory : ISourceRegistry
{
    private readonly Dictionary<string, Func<IReadOnlyDictionary<string, string>, ITaskSource>> _tasks = new();
    private readonly Dictionary<string, Func<IReadOnlyDictionary<string, string>, ICalendarSource>> _calendars = new();
    private readonly Dictionary<string, Func<IReadOnlyDictionary<string, string>, INoteSource>> _notes = new();
    private readonly Dictionary<string, Func<IReadOnlyDictionary<string, string>, IWeatherProvider>> _weather = new();

    public SourceFactory(LocalStore store)
    {
        RegisterTaskSource("local", _ => new LocalTaskSource(store));
        RegisterTaskSource("markdown", s => new MarkdownTaskSource(Get(s, "path")));
        RegisterTaskSource("csv", s => new CsvTaskSource(Get(s, "path")));
        RegisterTaskSource("todoist", s => new TodoistTaskSource(Get(s, "token")));

        RegisterCalendarSource("ics", s => new IcsCalendarSource(Get(s, "url")));

        RegisterNoteSource("local", _ => new LocalNoteSource(store));
        RegisterNoteSource("markdown", s => new MarkdownNoteSource(Get(s, "path")));

        RegisterWeatherProvider("openweather", s => new OpenWeatherProvider(Get(s, "apiKey"), Get(s, "city")));
        RegisterWeatherProvider("weatherapi", s => new WeatherApiProvider(Get(s, "apiKey"), Get(s, "city")));
    }

    private static string Get(IReadOnlyDictionary<string, string> s, string key) =>
        s.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v)
            ? v
            : throw new InvalidOperationException($"Не заполнен параметр источника данных: «{key}»");

    public void RegisterTaskSource(string typeKey, Func<IReadOnlyDictionary<string, string>, ITaskSource> factory) => _tasks[typeKey] = factory;
    public void RegisterCalendarSource(string typeKey, Func<IReadOnlyDictionary<string, string>, ICalendarSource> factory) => _calendars[typeKey] = factory;
    public void RegisterNoteSource(string typeKey, Func<IReadOnlyDictionary<string, string>, INoteSource> factory) => _notes[typeKey] = factory;
    public void RegisterWeatherProvider(string typeKey, Func<IReadOnlyDictionary<string, string>, IWeatherProvider> factory) => _weather[typeKey] = factory;

    public ITaskSource? CreateTaskSource(IReadOnlyDictionary<string, string> settings) =>
        Create(_tasks, settings);
    public ICalendarSource? CreateCalendarSource(IReadOnlyDictionary<string, string> settings) =>
        Create(_calendars, settings);
    public INoteSource? CreateNoteSource(IReadOnlyDictionary<string, string> settings) =>
        Create(_notes, settings);
    public IWeatherProvider? CreateWeatherProvider(IReadOnlyDictionary<string, string> settings) =>
        Create(_weather, settings);

    private static T? Create<T>(Dictionary<string, Func<IReadOnlyDictionary<string, string>, T>> map,
        IReadOnlyDictionary<string, string> settings) where T : class
    {
        var type = settings.TryGetValue("type", out var t) ? t : "none";
        if (type is "none" or "") return null;
        return map.TryGetValue(type, out var factory) ? factory(settings) : null;
    }

    /// <summary>Загружает плагины-DLL из папки и даёт им зарегистрировать свои источники.</summary>
    public IReadOnlyList<string> LoadPlugins(string pluginsFolder)
    {
        var loaded = new List<string>();
        if (!Directory.Exists(pluginsFolder)) return loaded;

        foreach (var dll in Directory.EnumerateFiles(pluginsFolder, "*.dll"))
        {
            try
            {
                var asm = Assembly.LoadFrom(dll);
                foreach (var type in asm.GetTypes()
                             .Where(t => !t.IsAbstract && typeof(IDashboardPlugin).IsAssignableFrom(t)))
                {
                    if (Activator.CreateInstance(type) is IDashboardPlugin plugin)
                    {
                        plugin.Register(this);
                        loaded.Add(plugin.Name);
                    }
                }
            }
            catch
            {
                // Битый плагин не должен ронять приложение
            }
        }
        return loaded;
    }
}
