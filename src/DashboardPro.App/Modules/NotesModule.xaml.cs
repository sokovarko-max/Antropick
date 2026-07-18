using DashboardPro.Core.Models;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace DashboardPro.App.Modules;

public sealed partial class NotesModule : UserControl
{
    private const int MaxVisible = 6;

    public NotesModule(ModuleConfig config)
    {
        InitializeComponent();
        Loaded += (_, _) => { App.Hub.Updated += OnHubUpdated; Render(); };
        Unloaded += (_, _) => App.Hub.Updated -= OnHubUpdated;
    }

    private void OnHubUpdated() => DispatcherQueue.TryEnqueue(Render);

    private void Render()
    {
        ListPanel.Children.Clear();
        var canWrite = App.Hub.NoteSource is { CanWrite: true };
        NewNoteBox.IsEnabled = canWrite;

        if (App.Hub.NotesError is { } error)
        {
            ListPanel.Children.Add(UiFactory.Secondary($"Заметки: {error}"));
            return;
        }

        var notes = App.Hub.Notes.Take(MaxVisible).ToList();
        if (notes.Count == 0)
        {
            ListPanel.Children.Add(UiFactory.Secondary("Заметок пока нет."));
            return;
        }

        foreach (var note in notes)
        {
            var row = new Grid { ColumnSpacing = 6 };
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var body = new StackPanel();
            var title = UiFactory.Text(note.Title, 13);
            title.FontWeight = Microsoft.UI.Text.FontWeights.SemiBold;
            body.Children.Add(title);
            if (note.Excerpt.Length > 0 && note.Excerpt != note.Title)
                body.Children.Add(UiFactory.Secondary(note.Excerpt, 11));
            row.Children.Add(body);

            if (canWrite)
            {
                var delete = UiFactory.SmallIconButton("\uE74D", "Удалить заметку");
                delete.Click += async (_, _) => await App.Hub.DeleteNoteAsync(note);
                Grid.SetColumn(delete, 1);
                row.Children.Add(delete);
            }
            ListPanel.Children.Add(row);
        }
    }

    private async void OnAddClick(object sender, RoutedEventArgs e)
    {
        var content = NewNoteBox.Text.Trim();
        if (content.Length == 0) return;
        NewNoteBox.Text = "";
        await App.Hub.AddNoteAsync(content);
    }
}
