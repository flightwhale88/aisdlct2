'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { generateCalendarGrid, parseMonthParam, toMonthParam, addMonth } from '@/lib/calendar';
import type { Todo, Holiday } from '@/lib/db';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRIORITY_PILL: Record<string, string> = {
  high:   'bg-red-500 text-white',
  medium: 'bg-yellow-500 text-white',
  low:    'bg-blue-500 text-white',
};

function DayTodosModal({ date, todos, holiday, onClose }: {
  date: string;
  todos: Todo[];
  holiday: Holiday | undefined;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">{date}</h2>
        {holiday && (
          <p className="text-sm text-orange-600 dark:text-orange-400 mb-3 font-medium">🎉 {holiday.name}</p>
        )}
        {todos.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No todos due on this day.</p>}
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {todos.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <input type="checkbox" checked={Boolean(t.completed)} readOnly className="h-4 w-4" />
              <span className={`flex-1 text-sm ${t.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{t.title}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_PILL[t.priority] ?? ''}`}>{t.priority}</span>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-4 text-sm text-gray-500 dark:text-gray-400">Close</button>
      </div>
    </div>
  );
}

function CalendarInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { year, month } = parseMonthParam(searchParams.get('month'));

  const [todos, setTodos] = useState<Todo[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/todos').then((r) => r.json()),
      fetch(`/api/holidays?year=${year}&month=${month}`).then((r) => r.json()),
    ]).then(([todosData, holidaysData]) => {
      setTodos(Array.isArray(todosData) ? todosData : []);
      setHolidays(holidaysData.holidays ?? []);
      setLoading(false);
    });
  }, [year, month]);

  const navigate = (nextYear: number, nextMonth: number) => {
    router.push(`/calendar?month=${toMonthParam(nextYear, nextMonth)}`);
  };

  const goToToday = () => {
    const now = new Date();
    navigate(now.getFullYear(), now.getMonth() + 1);
  };

  const cells = generateCalendarGrid(year, month);
  const holidayMap = Object.fromEntries(holidays.map((h) => [h.date, h]));
  const todosByDate: Record<string, Todo[]> = {};
  for (const todo of todos) {
    if (todo.due_date) {
      const dateKey = todo.due_date.slice(0, 10);
      if (!todosByDate[dateKey]) todosByDate[dateKey] = [];
      todosByDate[dateKey].push(todo);
    }
  }

  const prev = addMonth(year, month, -1);
  const next = addMonth(year, month, 1);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">← List</Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate(prev.year, prev.month)} className="px-3 py-1 rounded border text-sm dark:border-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">◀</button>
          <button onClick={goToToday} className="px-3 py-1 rounded border text-sm dark:border-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Today</button>
          <button onClick={() => navigate(next.year, next.month)} className="px-3 py-1 rounded border text-sm dark:border-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">▶</button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-gray-500 py-12">Loading…</p>
      ) : (
        <>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map((d) => (
              <div key={d} className={`text-xs font-semibold text-center py-1 ${d === 'Sun' || d === 'Sat' ? 'text-blue-500 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 border-l border-t dark:border-gray-700">
            {cells.map((day) => {
              const dayTodos = todosByDate[day.date] ?? [];
              const holiday = holidayMap[day.date];
              const visible = dayTodos.slice(0, 3);
              const overflow = dayTodos.length - visible.length;

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={[
                    'border-r border-b dark:border-gray-700 p-1 min-h-[80px] text-left align-top transition-colors',
                    day.isToday ? 'bg-blue-50 dark:bg-blue-900/20' : '',
                    !day.isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/50' : 'bg-white dark:bg-gray-800',
                    day.isWeekend && day.isCurrentMonth ? 'bg-blue-50/30 dark:bg-blue-900/10' : '',
                    'hover:bg-gray-100 dark:hover:bg-gray-700',
                  ].join(' ')}
                >
                  <span className={[
                    'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-0.5',
                    day.isToday ? 'bg-blue-600 text-white' : '',
                    !day.isCurrentMonth ? 'text-gray-400 dark:text-gray-600' : day.isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200',
                  ].join(' ')}>
                    {Number(day.date.slice(-2))}
                  </span>
                  {holiday && (
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 truncate leading-tight">{holiday.name}</p>
                  )}
                  {visible.map((t) => (
                    <p key={t.id} className={`text-[10px] truncate px-1 rounded leading-tight mb-0.5 ${PRIORITY_PILL[t.priority] ?? 'bg-gray-200'}`}>
                      {t.title}
                    </p>
                  ))}
                  {overflow > 0 && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">+{overflow} more</p>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {selectedDate && (
        <DayTodosModal
          date={selectedDate}
          todos={todosByDate[selectedDate] ?? []}
          holiday={holidayMap[selectedDate]}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </main>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<p className="text-center py-12 text-gray-500">Loading…</p>}>
      <CalendarInner />
    </Suspense>
  );
}
