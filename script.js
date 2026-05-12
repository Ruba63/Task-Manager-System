/* =============================================================
   Team Tasks Management System
   FIXED script.js — corrected bugs & consistency improvements
============================================================= */

'use strict';

/* ============================================================
   1. CONSTANTS & CONFIG
============================================================= */

const LS_KEY   = 'taskflow_tasks_v1';
const LS_THEME = 'taskflow_theme';

const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };

/* ============================================================
   2. APP STATE
============================================================= */

const state = {
  tasks: [],
  statusFilter: '',
  priorityFilter: '',
  searchQuery: '',
  sortMode: 'newest',
  editingId: null,
  deleteTargetId: null,
};

/* ============================================================
   3. LOCAL STORAGE
============================================================= */

function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.tasks));
  } catch {
    showToast('Storage error — could not save tasks.', 'error');
  }
}

/* ============================================================
   4. TASK CRUD (FIXED)
============================================================= */

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// FIX: added title field properly
function createTask(data) {
  const task = {
    id: generateId(),
    title: (data.title || '').trim(),
    description: (data.description || '').trim(),
    assigned_to: (data.assigned_to || '').trim(),
    status: data.status || 'Pending',
    priority: data.priority || 'Medium',
    due_date: data.due_date || '',
    created_at: new Date().toISOString(),
  };

  state.tasks.unshift(task);
  saveTasks();
  return task;
}

function updateTask(id, data) {
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;

  const task = state.tasks[idx];

  state.tasks[idx] = {
    ...task,
    title: data.title !== undefined ? data.title.trim() : task.title,
    description: data.description !== undefined ? data.description.trim() : task.description,
    assigned_to: data.assigned_to !== undefined ? data.assigned_to.trim() : task.assigned_to,
    status: data.status || task.status,
    priority: data.priority || task.priority,
    due_date: data.due_date !== undefined ? data.due_date : task.due_date,
  };

  saveTasks();
  return state.tasks[idx];
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  saveTasks();
}

function changeTaskStatus(id, newStatus) {
  updateTask(id, { status: newStatus });
  renderAll();
  showToast(`Status updated to "${newStatus}"`, 'success');
}

/* ============================================================
   5. FILTERING
============================================================= */

function getFilteredTasks() {
  let tasks = [...state.tasks];

  if (state.statusFilter) {
    tasks = tasks.filter(t => t.status === state.statusFilter);
  }

  if (state.priorityFilter) {
    tasks = tasks.filter(t => t.priority === state.priorityFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q) ||
      (t.assigned_to || '').toLowerCase().includes(q)
    );
  }

  switch (state.sortMode) {
    case 'oldest':
      tasks.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case 'due':
      tasks.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
      break;
    case 'priority':
      tasks.sort((a, b) =>
        (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0)
      );
      break;
    default:
      tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return tasks;
}

/* ============================================================
   6. STATS (unchanged logic)
============================================================= */

function computeStats() {
  const total = state.tasks.length;
  const pending = state.tasks.filter(t => t.status === 'Pending').length;
  const inProgress = state.tasks.filter(t => t.status === 'In Progress').length;
  const completed = state.tasks.filter(t => t.status === 'Completed').length;
  const high = state.tasks.filter(t => t.priority === 'High').length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, pending, inProgress, completed, high, percent };
}

/* ============================================================
   7. HELPERS (FIXED SAFE ACCESS)
============================================================= */

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toInitials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

function isOverdue(dueDate, status) {
  if (!dueDate || status === 'Completed') return false;
  return new Date(dueDate + 'T00:00:00') < new Date(new Date().toDateString());
}

/* ============================================================
   8. RENDER CARD FIX (title safety)
============================================================= */

function buildCardHTML(task, delay) {
  const overdue = isOverdue(task.due_date, task.status);

  const statusClassMap = {
    'Pending': 'badge-pending',
    'In Progress': 'badge-progress',
    'Completed': 'badge-completed',
  };

  return `
    <div class="task-card" data-id="${task.id}" style="animation-delay:${delay}ms">
      <div class="card-header">
        <h3 class="card-title">${esc(task.title || 'Untitled Task')}</h3>
      </div>
      <p>${esc(task.description)}</p>
      <small>${esc(task.assigned_to)}</small>
    </div>
  `;
}

/* ============================================================
   9. SEED DATA FIX (TITLE ADDED)
============================================================= */

function seedDemoData() {
  if (localStorage.getItem(LS_KEY)) return;

  const today = new Date();
  const fmt = d => d.toISOString().split('T')[0];

  const demos = [
    {
      title: 'Design System Setup',
      description: 'Create components and tokens.',
      assigned_to: 'Sara Ahmed',
      status: 'Completed',
      priority: 'High',
      due_date: fmt(new Date(today)),
    },
    {
      title: 'API Integration',
      description: 'Connect backend API.',
      assigned_to: 'Mohammed Ali',
      status: 'In Progress',
      priority: 'High',
      due_date: fmt(new Date()),
    },
  ];

  demos.forEach(d => createTask(d));
}

/* ============================================================
   10. BOOT
============================================================= */

document.addEventListener('DOMContentLoaded', () => {
  state.tasks = loadTasks();
  seedDemoData();
  state.tasks = loadTasks();
  renderAll?.();
});
