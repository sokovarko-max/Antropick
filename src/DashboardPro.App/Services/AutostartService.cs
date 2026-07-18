using Microsoft.Win32;

namespace DashboardPro.App.Services;

/// <summary>Автозапуск через HKCU\...\Run — работает для неупакованного приложения.</summary>
public static class AutostartService
{
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string ValueName = "DashboardPro";

    public static void Apply(bool enabled)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(RunKey);
            if (enabled)
            {
                var exe = Environment.ProcessPath;
                if (exe is not null) key.SetValue(ValueName, $"\"{exe}\"");
            }
            else
            {
                key.DeleteValue(ValueName, throwOnMissingValue: false);
            }
        }
        catch
        {
            // Нет доступа к реестру — молча пропускаем
        }
    }
}
