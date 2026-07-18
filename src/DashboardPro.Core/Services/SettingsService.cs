using System.Text.Json;
using System.Text.Json.Serialization;
using DashboardPro.Core.Models;

namespace DashboardPro.Core.Services;

public sealed class SettingsService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        AllowTrailingCommas = true,
        ReadCommentHandling = JsonCommentHandling.Skip
    };

    public string DataFolder { get; }
    public string SettingsPath { get; }
    public AppSettings Current { get; private set; } = new();

    public event Action? Saved;

    public SettingsService(string? folder = null)
    {
        DataFolder = folder ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DashboardPro");
        Directory.CreateDirectory(DataFolder);
        SettingsPath = Path.Combine(DataFolder, "settings.json");
        Load();
    }

    public void Load()
    {
        try
        {
            if (File.Exists(SettingsPath))
                Current = JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(SettingsPath), JsonOptions) ?? new AppSettings();
        }
        catch
        {
            Current = new AppSettings();
        }
    }

    public void Save()
    {
        File.WriteAllText(SettingsPath, JsonSerializer.Serialize(Current, JsonOptions));
        Saved?.Invoke();
    }

    public ModuleConfig GetModuleConfig(string moduleId)
    {
        var cfg = Current.Modules.FirstOrDefault(m => m.Id == moduleId);
        if (cfg is null)
        {
            cfg = new ModuleConfig { Id = moduleId };
            Current.Modules.Add(cfg);
        }
        return cfg;
    }
}
