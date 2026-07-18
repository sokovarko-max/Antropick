using DashboardPro.Core.Models;
using Microsoft.Data.Sqlite;

namespace DashboardPro.Core.Services;

/// <summary>Локальная база приложения (SQLite): задачи, заметки, привычки, проекты, статистика Pomodoro.</summary>
public sealed class LocalStore
{
    private readonly string _connectionString;

    public LocalStore(string dataFolder)
    {
        Directory.CreateDirectory(dataFolder);
        _connectionString = $"Data Source={Path.Combine(dataFolder, "dashboard.db")}";
        Init();
    }

    private SqliteConnection Open()
    {
        var c = new SqliteConnection(_connectionString);
        c.Open();
        return c;
    }

    private void Init()
    {
        using var c = Open();
        Exec(c, """
            CREATE TABLE IF NOT EXISTS tasks(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                notes TEXT,
                due TEXT,
                priority INTEGER NOT NULL DEFAULT 1,
                completed INTEGER NOT NULL DEFAULT 0,
                project TEXT);
            CREATE TABLE IF NOT EXISTS notes(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL DEFAULT '',
                updated TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS habits(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                target_per_week INTEGER NOT NULL DEFAULT 7);
            CREATE TABLE IF NOT EXISTS habit_logs(
                habit_id INTEGER NOT NULL,
                day TEXT NOT NULL,
                PRIMARY KEY(habit_id, day));
            CREATE TABLE IF NOT EXISTS projects(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                deadline TEXT,
                total_tasks INTEGER NOT NULL DEFAULT 0,
                done_tasks INTEGER NOT NULL DEFAULT 0,
                next_step TEXT);
            CREATE TABLE IF NOT EXISTS pomodoro_sessions(
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind INTEGER NOT NULL,
                minutes INTEGER NOT NULL,
                finished TEXT NOT NULL);
            """);
    }

    private static void Exec(SqliteConnection c, string sql, params (string, object?)[] args)
    {
        using var cmd = c.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (k, v) in args) cmd.Parameters.AddWithValue(k, v ?? DBNull.Value);
        cmd.ExecuteNonQuery();
    }

    // ---------- Tasks ----------

    public List<TaskItem> GetTasks(bool includeCompleted = false)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT id,title,notes,due,priority,completed,project FROM tasks" +
                          (includeCompleted ? "" : " WHERE completed=0") + " ORDER BY due IS NULL, due, priority DESC";
        using var r = cmd.ExecuteReader();
        var list = new List<TaskItem>();
        while (r.Read())
            list.Add(new TaskItem
            {
                Id = r.GetInt64(0),
                Title = r.GetString(1),
                Notes = r.IsDBNull(2) ? null : r.GetString(2),
                DueDate = r.IsDBNull(3) ? null : DateTime.Parse(r.GetString(3)),
                Priority = (TaskPriority)r.GetInt32(4),
                IsCompleted = r.GetInt32(5) != 0,
                Project = r.IsDBNull(6) ? null : r.GetString(6),
                Source = "local"
            });
        return list;
    }

    public long AddTask(string title, DateTime? due = null, TaskPriority priority = TaskPriority.Normal, string? project = null)
    {
        using var c = Open();
        Exec(c, "INSERT INTO tasks(title,due,priority,project) VALUES($t,$d,$p,$pr)",
            ("$t", title), ("$d", due?.ToString("O")), ("$p", (int)priority), ("$pr", project));
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT last_insert_rowid()";
        return (long)cmd.ExecuteScalar()!;
    }

    public void SetTaskCompleted(long id, bool completed)
    {
        using var c = Open();
        Exec(c, "UPDATE tasks SET completed=$c WHERE id=$id", ("$c", completed ? 1 : 0), ("$id", id));
    }

    public void DeleteTask(long id)
    {
        using var c = Open();
        Exec(c, "DELETE FROM tasks WHERE id=$id", ("$id", id));
    }

    // ---------- Notes ----------

    public List<Note> GetNotes()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT id,title,content,updated FROM notes ORDER BY updated DESC";
        using var r = cmd.ExecuteReader();
        var list = new List<Note>();
        while (r.Read())
            list.Add(new Note
            {
                Id = r.GetInt64(0),
                Title = r.GetString(1),
                Content = r.GetString(2),
                UpdatedAt = DateTime.Parse(r.GetString(3)),
                Source = "local"
            });
        return list;
    }

    public void AddNote(string title, string content)
    {
        using var c = Open();
        Exec(c, "INSERT INTO notes(title,content,updated) VALUES($t,$c,$u)",
            ("$t", title), ("$c", content), ("$u", DateTime.Now.ToString("O")));
    }

    public void DeleteNote(long id)
    {
        using var c = Open();
        Exec(c, "DELETE FROM notes WHERE id=$id", ("$id", id));
    }

    // ---------- Habits ----------

    public List<Habit> GetHabits()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT id,name,target_per_week FROM habits ORDER BY id";
        using var r = cmd.ExecuteReader();
        var list = new List<Habit>();
        while (r.Read())
            list.Add(new Habit { Id = r.GetInt64(0), Name = r.GetString(1), TargetPerWeek = r.GetInt32(2) });
        return list;
    }

    public void AddHabit(string name)
    {
        using var c = Open();
        Exec(c, "INSERT INTO habits(name) VALUES($n)", ("$n", name));
    }

    public void DeleteHabit(long id)
    {
        using var c = Open();
        Exec(c, "DELETE FROM habits WHERE id=$id; DELETE FROM habit_logs WHERE habit_id=$id", ("$id", id));
    }

    public void SetHabitDone(long habitId, DateOnly day, bool done)
    {
        using var c = Open();
        if (done)
            Exec(c, "INSERT OR IGNORE INTO habit_logs(habit_id,day) VALUES($h,$d)",
                ("$h", habitId), ("$d", day.ToString("yyyy-MM-dd")));
        else
            Exec(c, "DELETE FROM habit_logs WHERE habit_id=$h AND day=$d",
                ("$h", habitId), ("$d", day.ToString("yyyy-MM-dd")));
    }

    public HashSet<DateOnly> GetHabitDays(long habitId, DateOnly from, DateOnly to)
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT day FROM habit_logs WHERE habit_id=$h AND day BETWEEN $f AND $t";
        cmd.Parameters.AddWithValue("$h", habitId);
        cmd.Parameters.AddWithValue("$f", from.ToString("yyyy-MM-dd"));
        cmd.Parameters.AddWithValue("$t", to.ToString("yyyy-MM-dd"));
        using var r = cmd.ExecuteReader();
        var set = new HashSet<DateOnly>();
        while (r.Read()) set.Add(DateOnly.Parse(r.GetString(0)));
        return set;
    }

    // ---------- Projects ----------

    public List<Project> GetProjects()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT id,name,deadline,total_tasks,done_tasks,next_step FROM projects ORDER BY deadline IS NULL, deadline";
        using var r = cmd.ExecuteReader();
        var list = new List<Project>();
        while (r.Read())
            list.Add(new Project
            {
                Id = r.GetInt64(0),
                Name = r.GetString(1),
                Deadline = r.IsDBNull(2) ? null : DateTime.Parse(r.GetString(2)),
                TotalTasks = r.GetInt32(3),
                DoneTasks = r.GetInt32(4),
                NextStep = r.IsDBNull(5) ? null : r.GetString(5)
            });
        return list;
    }

    public void AddProject(string name)
    {
        using var c = Open();
        Exec(c, "INSERT INTO projects(name) VALUES($n)", ("$n", name));
    }

    public void UpdateProject(Project p)
    {
        using var c = Open();
        Exec(c, "UPDATE projects SET name=$n, deadline=$d, total_tasks=$t, done_tasks=$dn, next_step=$s WHERE id=$id",
            ("$n", p.Name), ("$d", p.Deadline?.ToString("O")), ("$t", p.TotalTasks),
            ("$dn", p.DoneTasks), ("$s", p.NextStep), ("$id", p.Id));
    }

    public void DeleteProject(long id)
    {
        using var c = Open();
        Exec(c, "DELETE FROM projects WHERE id=$id", ("$id", id));
    }

    // ---------- Pomodoro ----------

    public void AddPomodoroSession(PomodoroKind kind, int minutes)
    {
        using var c = Open();
        Exec(c, "INSERT INTO pomodoro_sessions(kind,minutes,finished) VALUES($k,$m,$f)",
            ("$k", (int)kind), ("$m", minutes), ("$f", DateTime.Now.ToString("O")));
    }

    public int CountPomodorosToday()
    {
        using var c = Open();
        using var cmd = c.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM pomodoro_sessions WHERE kind=0 AND finished >= $d";
        cmd.Parameters.AddWithValue("$d", DateTime.Today.ToString("O"));
        return Convert.ToInt32(cmd.ExecuteScalar());
    }
}
