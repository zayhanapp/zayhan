import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, ListTodo } from 'lucide-react';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

type FilterType = 'all' | 'active' | 'completed';

const TASKS_STORAGE_KEY = 'liquid_glass_tasks';

export const TasksManager: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(TASKS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load tasks', e);
    }
    return [
      {
        id: 'seed-1',
        text: 'Review chapter notes',
        completed: false,
        createdAt: Date.now() - 3600000,
      },
      {
        id: 'seed-2',
        text: 'Upload laboratory document to Materials',
        completed: true,
        createdAt: Date.now() - 7200000,
      },
    ];
  });

  const [inputVal, setInputVal] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    } catch (err) {
      console.error('Failed to save tasks', err);
    }
  }, [tasks]);

  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      text: trimmed,
      completed: false,
      createdAt: Date.now(),
    };

    setTasks((prev) => [newTask, ...prev]);
    setInputVal('');
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
  };

  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.completed).length;
  const activeCount = totalCount - completedCount;

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <h1 className="text-2xl font-light tracking-tight text-white">Tasks</h1>

        <div className="text-xs font-mono tabular-nums text-zinc-400 flex items-center gap-2">
          <span>{totalCount} total</span>
          <span>·</span>
          <span>{activeCount} active</span>
          <span>·</span>
          <span>{completedCount} done</span>
        </div>
      </div>

      {/* Main glass container */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 space-y-4">
        {/* Add Input */}
        <form onSubmit={handleAddTask} className="flex gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Add task..."
            className="flex-1 glass-input px-4 py-2.5 rounded-xl text-sm"
          />
          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-stone-100 hover:bg-stone-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-30 cursor-pointer shadow-sm border border-stone-300 dark:border-white/10"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>

        {/* Filter controls */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-1">
            {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                  filter === f
                    ? 'bg-stone-900 text-stone-100 dark:bg-white/15 dark:text-white font-medium shadow-sm'
                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {completedCount > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Clear Completed
            </button>
          )}
        </div>

        {/* Task rows */}
        <div className="space-y-1.5">
          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs font-mono">
              <ListTodo className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <span>No tasks in this view</span>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/30 hover:border-white/10 transition-colors"
              >
                <div
                  onClick={() => handleToggleTask(task.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer pr-3"
                >
                  <button
                    type="button"
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      task.completed
                        ? 'bg-white/80 border-white text-black'
                        : 'border-white/20 bg-transparent hover:border-white/40'
                    }`}
                  >
                    {task.completed && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <span
                    className={`text-sm truncate select-none ${
                      task.completed
                        ? 'line-through text-zinc-400'
                        : 'text-zinc-200'
                    }`}
                  >
                    {task.text}
                  </span>
                </div>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-red-400 transition-opacity cursor-pointer"
                  title="Delete task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
