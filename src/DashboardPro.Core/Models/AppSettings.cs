namespace DashboardPro.Core.Models;

public sealed class ModuleConfig
{
    public string Id { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public bool Collapsed { get; set; }
    public Dictionary<string, string> Settings { get; set; } = new();
}

public sealed class AppSettings
{
    public int SidebarWidth { get; set; } = 380;
    /// <summary>Right | Left — к какому краю экрана прижата панель.</summary>
    public string DockEdge { get; set; } = "Right";
    /// <summary>Индекс монитора (0 — первый); -1 — автоматически, где находится окно.</summary>
    public int MonitorIndex { get; set; } = -1;
    public bool AlwaysOnTop { get; set; } = true;
    /// <summary>Резервировать место на рабочем столе через Shell AppBar (окна не перекрываются панелью).</summary>
    public bool ReserveScreenSpace { get; set; }
    public bool Autostart { get; set; }
    /// <summary>Mica | MicaAlt | Acrylic | None</summary>
    public string Backdrop { get; set; } = "Mica";
    /// <summary>System | Light | Dark</summary>
    public string Theme { get; set; } = "System";
    public double Opacity { get; set; } = 1.0;
    public int DataRefreshMinutes { get; set; } = 5;
    public bool ShowInSwitchers { get; set; }

    /// <summary>Источник задач: type=local|markdown|csv|todoist (+path/token).</summary>
    public Dictionary<string, string> TaskSource { get; set; } = new() { ["type"] = "local" };
    /// <summary>Источник календаря: type=none|ics (+url — подходит секретная ICS-ссылка Google/Outlook).</summary>
    public Dictionary<string, string> CalendarSource { get; set; } = new() { ["type"] = "none" };
    /// <summary>Источник заметок: type=local|markdown (+path — папка с .md файлами).</summary>
    public Dictionary<string, string> NotesSource { get; set; } = new() { ["type"] = "local" };

    public List<ModuleConfig> Modules { get; set; } = new();
}
