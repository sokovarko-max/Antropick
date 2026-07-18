using DashboardPro.Core.Models;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

/// <summary>Поле в общем редакторе настроек модуля (шестерёнка на карточке).</summary>
public sealed record SettingField(string Key, string Label, string Placeholder = "");

public sealed record ModuleDescriptor(
    string Id,
    string Title,
    string Glyph,
    Func<ModuleConfig, UserControl> Factory,
    IReadOnlyList<SettingField>? SettingsSchema = null);

/// <summary>Контрол модуля может реагировать на изменение своих настроек.</summary>
public interface IModuleControl
{
    void OnSettingsChanged();
}

public static class ModuleRegistry
{
    public static readonly IReadOnlyList<ModuleDescriptor> All = new List<ModuleDescriptor>
    {
        new("clock", "Время", "\uE823", c => new ClockModule(c)),
        new("weather", "Погода", "\uE706", c => new WeatherModule(c), new[]
        {
            new SettingField("provider", "Провайдер (openweather | weatherapi)", "openweather"),
            new SettingField("apiKey", "API-ключ", "ключ с openweathermap.org"),
            new SettingField("city", "Город", "Moscow"),
            new SettingField("refreshMinutes", "Обновление, мин", "30")
        }),
        new("today", "Сегодня", "\uE787", c => new TodayModule(c)),
        new("toptasks", "Главные задачи", "\uE735", c => new TopTasksModule(c), new[]
        {
            new SettingField("maxItems", "Максимум задач", "5")
        }),
        new("dayplan", "План дня", "\uE8BF", c => new DayPlanModule(c)),
        new("pomodoro", "Pomodoro", "\uE916", c => new PomodoroModule(c), new[]
        {
            new SettingField("work", "Работа, мин", "25"),
            new SettingField("shortBreak", "Короткий перерыв, мин", "5"),
            new SettingField("longBreak", "Длинный перерыв, мин", "15"),
            new SettingField("cycles", "Циклов до длинного перерыва", "4"),
            new SettingField("autoStart", "Автостарт следующего цикла (true/false)", "true")
        }),
        new("notes", "Заметки", "\uE70B", c => new NotesModule(c)),
        new("habits", "Привычки", "\uE73E", c => new HabitsModule(c)),
        new("projects", "Проекты", "\uE8F1", c => new ProjectsModule(c)),
        new("sysmon", "Система", "\uE950", c => new SystemMonitorModule(c)),
        new("insights", "Ассистент", "\uEA80", c => new InsightsModule(c), new[]
        {
            new SettingField("refreshMinutes", "Анализ каждые, мин", "10")
        }),
    };

    public static ModuleDescriptor? Find(string id) => All.FirstOrDefault(m => m.Id == id);
}
