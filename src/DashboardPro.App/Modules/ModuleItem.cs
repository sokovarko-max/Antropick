using DashboardPro.Core.Models;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

/// <summary>Экземпляр модуля на панели: описатель + конфигурация + лениво создаваемый контрол.</summary>
public sealed class ModuleItem(ModuleDescriptor descriptor, ModuleConfig config)
{
    public ModuleDescriptor Descriptor { get; } = descriptor;
    public ModuleConfig Config { get; } = config;

    private UserControl? _view;
    public UserControl View => _view ??= Descriptor.Factory(Config);

    public static int GetInt(ModuleConfig config, string key, int fallback) =>
        config.Settings.TryGetValue(key, out var v) && int.TryParse(v, out var n) ? n : fallback;

    public static bool GetBool(ModuleConfig config, string key, bool fallback) =>
        config.Settings.TryGetValue(key, out var v) && bool.TryParse(v, out var b) ? b : fallback;

    public static string GetString(ModuleConfig config, string key, string fallback = "") =>
        config.Settings.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v : fallback;
}
