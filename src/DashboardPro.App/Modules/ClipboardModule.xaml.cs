using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Windows.ApplicationModel.DataTransfer;

namespace DashboardPro.App.Modules;

/// <summary>История буфера обмена (текст): клик по записи копирует её обратно.</summary>
public sealed partial class ClipboardModule : UserControl, IModuleControl
{
    private readonly ModuleConfig _config;
    private readonly List<string> _history = new();
    private bool _ignoreNextChange;

    public ClipboardModule(ModuleConfig config)
    {
        _config = config;
        InitializeComponent();
        Loaded += (_, _) => { Clipboard.ContentChanged += OnClipboardChanged; Render(); };
        Unloaded += (_, _) => Clipboard.ContentChanged -= OnClipboardChanged;
    }

    public void OnSettingsChanged() => Render();

    private async void OnClipboardChanged(object? sender, object e)
    {
        if (_ignoreNextChange) { _ignoreNextChange = false; return; }
        try
        {
            var content = Clipboard.GetContent();
            if (!content.Contains(StandardDataFormats.Text)) return;
            var text = (await content.GetTextAsync())?.Trim();
            if (string.IsNullOrEmpty(text)) return;

            _history.Remove(text);
            _history.Insert(0, text);
            var max = Math.Max(3, ModuleItem.GetInt(_config, "maxItems", 10));
            while (_history.Count > max) _history.RemoveAt(_history.Count - 1);

            DispatcherQueue.TryEnqueue(Render);
        }
        catch
        {
            // Буфер может быть занят другим процессом — пропускаем событие
        }
    }

    private void Render()
    {
        ListPanel.Children.Clear();
        if (_history.Count == 0)
        {
            ListPanel.Children.Add(UiFactory.Secondary("Скопируйте текст — он появится здесь."));
            return;
        }

        foreach (var text in _history)
        {
            var display = text.Replace("\r", " ").Replace("\n", " ");
            if (display.Length > 60) display = display[..60] + "…";

            var button = new Button
            {
                HorizontalAlignment = HorizontalAlignment.Stretch,
                HorizontalContentAlignment = HorizontalAlignment.Left,
                Padding = new Thickness(8, 5, 8, 5),
                Content = UiFactory.Text(display, 12)
            };
            ToolTipService.SetToolTip(button, "Скопировать снова");
            button.Click += (_, _) =>
            {
                _ignoreNextChange = true;
                var package = new DataPackage();
                package.SetText(text);
                Clipboard.SetContent(package);
            };
            ListPanel.Children.Add(button);
        }
    }
}
