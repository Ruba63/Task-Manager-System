/* =============================================================
   Team Tasks Management System
   script.js  —  Complete Frontend Logic (LocalStorage Only)
   No backend, no dependencies, pure vanilla JavaScript.
============================================================= */

'use strict';

/* ============================================================
   1. CONSTANTS & CONFIG
============================================================= */

// LocalStorage key — all tasks are saved under this key
const LS_KEY   = 'taskflow_tasks_v1';
const LS_THEME = 'taskflow_theme';

// Priority weight for sorting (higher = more urgent)
const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 };

/* ============================================================
   2. APP STATE
   Central object that holds everything the UI depends on.
============================================================= */
const state = {
  tasks:          [],   // Array of task objects
  statusFilter:   '',   // '' | 'Pending' | 'In Progress' | 'Completed'
  priorityFilter: '',   // '' | 'High' | 'Medium' | 'Low'
  searchQuery:    '',   // Free-text search string
  sortMode:       'newest', // 'newest' | 'oldest' | 'due' | 'priority'
  editingId:      null, // task id being edited, or null for "create"
  deleteTargetId: null, // task id pending deletion confirmation
};

/* ============================================================
   3. LOCAL STORAGE  — save & load
============================================================= */

/**
 * Read tasks array from LocalStorage.
 * Returns an empty array if nothing is stored yet.
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // If JSON is corrupted, start fresh
    return [];
  }
}

/**
 * Write the current state.tasks array to LocalStorage.
 */
function saveTasks() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.tasks));
  } catch {
    showToast('Storage error — could not save tasks.', 'error');
  }
}

/* ============================================================
   4. TASK CRUD OPERATIONS
============================================================= */

/**
 * Generate a simple unique ID using timestamp + random suffix.
 * Works in all browsers without crypto.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Create a new task and add it to state.
 * @param {Object} data - { title, description, assigned_to, due_date, priority, status }
 */
function createTask(data) {
  const task = {
    id:          generateId(),
    description: (data.description || '').trim(),
    assigned_to: data.assigned_to.trim(),
    status:      data.status      || 'Pending',
    priority:    data.priority    || 'Medium',
    due_date:    data.due_date    || '',
    created_at:  new Date().toISOString(), // ISO timestamp
  };

  // Add to the beginning of the array so newest appears first
  state.tasks.unshift(task);
  saveTasks();
  return task;
}

/**
 * Update an existing task by id.
 * @param {string} id
 * @param {Object} data - fields to update
 */
function updateTask(id, data) {
  const idx = state.tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;

  // Merge updates into the existing task object
  state.tasks[idx] = {
    ...state.tasks[idx],

    description: (data.description !== undefined ? data.description : state.tasks[idx].description).trim(),
    assigned_to: (data.assigned_to || state.tasks[idx].assigned_to).trim(),
    status:      data.status    || state.tasks[idx].status,
    priority:    data.priority  || state.tasks[idx].priority,
    due_date:    data.due_date !== undefined ? data.due_date : state.tasks[idx].due_date,
  };

  saveTasks();
  return state.tasks[idx];
}

/**
 * Delete a task by id.
 * @param {string} id
 */
function deleteTask(id) {
  const before = state.tasks.length;
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (state.tasks.length !== before) saveTasks();
}

/**
 * Quick status change — used by inline card dropdown.
 * @param {string} id
 * @param {string} newStatus
 */
function changeTaskStatus(id, newStatus) {
  updateTask(id, { status: newStatus });
  renderAll();
  showToast(`Status updated to "${newStatus}"`, 'success');
}

/* ============================================================
   5. FILTERING, SEARCHING & SORTING
============================================================= */

/**
 * Return the subset of state.tasks that matches current filters.
 */
function getFilteredTasks() {
  let tasks = [...state.tasks];

  // ---- Status filter ----
  if (state.statusFilter) {
    tasks = tasks.filter(t => t.status === state.statusFilter);
  }

  // ---- Priority filter ----
  if (state.priorityFilter) {
    tasks = tasks.filter(t => t.priority === state.priorityFilter);
  }

  // ---- Search ----
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      t.title.toLowerCase().includes(q)       ||
      t.description.toLowerCase().includes(q) ||
      t.assigned_to.toLowerCase().includes(q)
    );
  }

  // ---- Sort ----
  switch (state.sortMode) {
    case 'oldest':
      tasks.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case 'due':
      // Tasks with no due_date go last
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
    case 'newest':
    default:
      tasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return tasks;
}

/* ============================================================
   6. STATISTICS
============================================================= */

/**
 * Compute stats from state.tasks (not filtered — always global).
 */
function computeStats() {
  const total      = state.tasks.length;
  const pending    = state.tasks.filter(t => t.status === 'Pending').length;
  const inProgress = state.tasks.filter(t => t.status === 'In Progress').length;
  const completed  = state.tasks.filter(t => t.status === 'Completed').length;
  const high       = state.tasks.filter(t => t.priority === 'High').length;
  const percent    = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, pending, inProgress, completed, high, percent };
}

/* ============================================================
   7. DOM HELPERS
============================================================= */

/** Escape HTML special characters to prevent XSS. */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Generate 1-2 initials from a name string. */
function toInitials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/** Format ISO / YYYY-MM-DD date to "May 12, 2026" style. */
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Return true if a due date is in the past and task is not Completed. */
function isOverdue(dueDate, status) {
  if (!dueDate || status === 'Completed') return false;
  // Compare date-only strings by normalising to midnight UTC
  return new Date(dueDate + 'T00:00:00') < new Date(new Date().toDateString());
}

/**
 * Animate a counter element from its current displayed value to `target`.
 * @param {HTMLElement} el
 * @param {number} target
 */
function animateCounter(el, target) {
  const start   = parseInt(el.textContent, 10) || 0;
  if (start === target) return;
  const range   = target - start;
  const steps   = Math.min(30, Math.abs(range));
  const stepVal = range / steps;
  let   current = start;
  let   step    = 0;

  const tick = setInterval(() => {
    step++;
    current += stepVal;
    el.textContent = Math.round(current);
    if (step >= steps) {
      el.textContent = target;
      clearInterval(tick);
    }
  }, 20);
}

/* ============================================================
   8. RENDER — Stats
============================================================= */
function renderStats() {
  const s = computeStats();

  animateCounter(document.getElementById('stat-total'),    s.total);
  animateCounter(document.getElementById('stat-pending'),  s.pending);
  animateCounter(document.getElementById('stat-progress'), s.inProgress);
  animateCounter(document.getElementById('stat-completed'),s.completed);

  // Update sidebar nav badges
  document.getElementById('nav-badge-all').textContent      = s.total;
  document.getElementById('nav-badge-pending').textContent  = s.pending;
  document.getElementById('nav-badge-progress').textContent = s.inProgress;
  document.getElementById('nav-badge-completed').textContent= s.completed;
  document.getElementById('nav-badge-high').textContent     = s.high;

  // Progress bar
  const pct = s.percent;
  document.getElementById('progress-percent').textContent = pct + '%';
  document.getElementById('progress-bar').style.width     = pct + '%';
}

/* ============================================================
   9. RENDER — Task Cards
============================================================= */

/**
 * Build the HTML string for one task card.
 * @param {Object} task
 * @param {number} delay - animation delay in ms for stagger effect
 */
function buildCardHTML(task, delay) {
  // Compute display values
  const overdue      = isOverdue(task.due_date, task.status);
  const dueCls       = overdue ? 'due-chip overdue' : 'due-chip';
  const dueText      = task.due_date ? formatDate(task.due_date) : 'No date';
  const overdueNote  = overdue ? ' !' : '';

  // Status badge class mapping
  const statusClassMap = {
    'Pending':     'badge-pending',
    'In Progress': 'badge-progress',
    'Completed':   'badge-completed',
  };
  const statusCls = statusClassMap[task.status] || 'badge-pending';

  // Priority badge class
  const priorityCls = 'badge-' + (task.priority || 'medium').toLowerCase();

  return `
    <div
      class="task-card"
      data-id="${esc(task.id)}"
      data-priority="${esc(task.priority)}"
      style="animation-delay:${delay}ms"
    >
      <!-- Card Header -->
      <div class="card-header">
        <h3 class="card-title">${esc(task.title)}</h3>
        <div class="card-actions">
          <!-- Edit button -->
          <button
            class="icon-btn edit-btn"
            title="Edit task"
            data-id="${esc(task.id)}"
            aria-label="Edit task"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <!-- Delete button -->
          <button
            class="icon-btn delete delete-btn"
            title="Delete task"
            data-id="${esc(task.id)}"
            aria-label="Delete task"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Description -->
      <p class="card-description">
        ${esc(task.description) || '<span style="opacity:.5;font-style:italic">No description.</span>'}
      </p>

      <!-- Badges row -->
      <div class="card-meta">
        <span class="badge ${statusCls}">
          <span class="badge-dot"></span>
          ${esc(task.status)}
        </span>
        <span class="badge ${priorityCls}">
          ${esc(task.priority)}
        </span>
      </div>

      <!-- Quick status update selector -->
      <select
        class="card-status-select"
        data-id="${esc(task.id)}"
        aria-label="Change status"
        title="Quick status change"
      >
        <option value="Pending"     ${task.status === 'Pending'     ? 'selected' : ''}>Pending</option>
        <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option value="Completed"   ${task.status === 'Completed'   ? 'selected' : ''}>Completed</option>
      </select>

      <!-- Card Footer -->
      <div class="card-footer">
        <div class="assigned-chip">
          <div class="assigned-avatar">${toInitials(task.assigned_to)}</div>
          <span class="assigned-name">${esc(task.assigned_to)}</span>
        </div>
        <span class="${dueCls}">
          <!-- Calendar icon SVG inline -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
          ${dueText}${overdueNote}
        </span>
      </div>
    </div>
  `;
}

/**
 * Render the full tasks grid.
 * Clears the grid then injects cards for all filtered tasks.
 */
function renderTasks() {
  const grid       = document.getElementById('tasks-grid');
  const emptyState = document.getElementById('empty-state');
  const countEl    = document.getElementById('visible-count');

  const filtered = getFilteredTasks();
  countEl.textContent = filtered.length;

  if (filtered.length === 0) {
    grid.innerHTML        = '';
    grid.style.display    = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  // Show grid, hide empty state
  grid.style.display       = 'grid';
  emptyState.style.display = 'none';

  // Build all card HTML at once (faster than appending one by one)
  grid.innerHTML = filtered
    .map((task, i) => buildCardHTML(task, i * 35))   // 35ms stagger
    .join('');

  // Attach event listeners to newly inserted buttons
  grid.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  grid.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => openConfirmDialog(btn.dataset.id));
  });

  grid.querySelectorAll('.card-status-select').forEach(select => {
    select.addEventListener('change', () => {
      changeTaskStatus(select.dataset.id, select.value);
    });
  });
}

/**
 * Convenience wrapper: render both stats and tasks.
 */
function renderAll() {
  renderStats();
  renderTasks();
  updateNavActiveState();
}

/* ============================================================
   10. SIDEBAR NAVIGATION ACTIVE STATE
============================================================= */

/**
 * Highlight the correct sidebar nav link based on current filter.
 */
function updateNavActiveState() {
  document.querySelectorAll('.nav-link[data-filter]').forEach(link => {
    link.classList.toggle('active', link.dataset.filter === state.statusFilter);
  });

  document.querySelectorAll('.nav-link[data-filter-priority]').forEach(link => {
    link.classList.toggle('active', link.dataset.filterPriority === state.priorityFilter);
  });
}

/* ============================================================
   11. MODAL — Open / Close / Populate
============================================================= */

function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Focus the first input after the CSS transition ends
  setTimeout(() => {
    document.getElementById('task-title').focus();
  }, 150);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  resetForm();
  state.editingId = null;
}

function resetForm() {
  document.getElementById('task-form').reset();
  document.getElementById('task-id').value    = '';
  document.getElementById('title-error').textContent    = '';
  document.getElementById('assigned-error').textContent = '';
  document.getElementById('task-title').classList.remove('error');
  document.getElementById('task-assigned').classList.remove('error');
  document.getElementById('modal-title').textContent  = 'Add New Task';
  document.getElementById('submit-btn').textContent   = 'Create Task';
}

/**
 * Open the modal pre-filled with an existing task's data.
 * @param {string} id - task id
 */
function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  state.editingId = id;

  // Populate fields
  document.getElementById('task-id').value        = task.id;
  document.getElementById('task-title').value     = task.title;
  document.getElementById('task-desc').value      = task.description || '';
  document.getElementById('task-assigned').value  = task.assigned_to;
  document.getElementById('task-due').value       = task.due_date    || '';
  document.getElementById('task-priority').value  = task.priority    || 'Medium';
  document.getElementById('task-status').value    = task.status;

  document.getElementById('modal-title').textContent = 'Edit Task';
  document.getElementById('submit-btn').textContent  = 'Save Changes';

  openModal();
}

/* ============================================================
   12. FORM VALIDATION & SUBMISSION
============================================================= */

/**
 * Validate the add/edit form.
 * Returns true if valid, false otherwise (also shows error messages).
 */
function validateForm() {
  let valid = true;

  const titleEl    = document.getElementById('task-title');
  const assignedEl = document.getElementById('task-assigned');
  const titleErr   = document.getElementById('title-error');
  const assignErr  = document.getElementById('assigned-error');

  // Clear previous errors
  titleErr.textContent  = '';
  assignErr.textContent = '';
  titleEl.classList.remove('error');
  assignedEl.classList.remove('error');

  if (!titleEl.value.trim()) {
    titleErr.textContent = 'Task title is required.';
    titleEl.classList.add('error');
    titleEl.focus();
    valid = false;
  }

  if (!assignedEl.value.trim()) {
    assignErr.textContent = 'Please assign this task to someone.';
    assignedEl.classList.add('error');
    if (valid) assignedEl.focus(); // Focus first error
    valid = false;
  }

  return valid;
}

/**
 * Handle form submission — create or update task.
 * @param {Event} e
 */
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const submitBtn = document.getElementById('submit-btn');

  // Gather form data
  const data = {
    description: document.getElementById('task-desc').value,
    assigned_to: document.getElementById('task-assigned').value,
    due_date:    document.getElementById('task-due').value,
    priority:    document.getElementById('task-priority').value,
    status:      document.getElementById('task-status').value,
  };

  // Briefly disable button to prevent double submit
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Saving...';

  // Small timeout gives the button animation a chance to be visible
  setTimeout(() => {
    if (state.editingId) {
      // --- UPDATE ---
      updateTask(state.editingId, data);
      showToast('Task updated successfully!', 'success');
    } else {
      // --- CREATE ---
      createTask(data);
      showToast('Task created successfully!', 'success');
    }

    closeModal();
    renderAll();

    submitBtn.disabled    = false;
    submitBtn.textContent = state.editingId ? 'Save Changes' : 'Create Task';
  }, 120);
}

/* ============================================================
   13. DELETE CONFIRM DIALOG
============================================================= */

function openConfirmDialog(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  state.deleteTargetId = id;

  // Update dialog message
  document.getElementById('confirm-message').textContent =
    `"${task.title}" will be permanently removed.`;

  document.getElementById('confirm-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeConfirmDialog() {
  document.getElementById('confirm-overlay').classList.remove('open');
  document.body.style.overflow = '';
  state.deleteTargetId = null;
}

function confirmDelete() {
  if (!state.deleteTargetId) return;
  deleteTask(state.deleteTargetId);
  closeConfirmDialog();
  renderAll();
  showToast('Task deleted.', 'success');
}

/* ============================================================
   14. TOAST NOTIFICATIONS
============================================================= */

/**
 * Show a toast message.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Pick icon based on type
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  toast.innerHTML = (icons[type] || icons.info) + esc(message);
  container.appendChild(toast);

  // Auto-remove after 3.2 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    // Remove from DOM after the fade-out animation (280ms)
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3200);
}

/* ============================================================
   15. DARK MODE
============================================================= */

function applyTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem(LS_THEME, isDark ? 'dark' : 'light');

  // Update the label inside the sidebar
  const label = document.getElementById('theme-label');
  if (label) label.textContent = isDark ? 'Dark Mode' : 'Light Mode';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current !== 'dark');
}

/* ============================================================
   16. DATE DISPLAY (topbar subtitle)
============================================================= */
function updateDateDisplay() {
  const el = document.getElementById('date-display');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

/* ============================================================
   17. SEED / DEMO DATA
   Pre-loads 4 example tasks when the app is opened for the first time.
   This helps show off the UI immediately.
============================================================= */
function seedDemoData() {
  // Only seed if LocalStorage is completely empty
  if (localStorage.getItem(LS_KEY) !== null) return;

  const today = new Date();
  const fmt   = (d) => d.toISOString().split('T')[0]; // YYYY-MM-DD

  const demos = [
    {

      description: 'Create base components, typography scale, and color tokens for the design system.',
      assigned_to: 'Sara Ahmed',
      status:      'Completed',
      priority:    'High',
      due_date:    fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3)),
    },
    {
       'API Integration — Tasks Endpoint',
      description: 'Connect the frontend task CRUD operations to the REST API.',
      assigned_to: 'Mohammed Ali',
      status:      'In Progress',
      priority:    'High',
      due_date:    fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)),
    },
    {
      description: 'Cover all utility functions and API helpers with Jest unit tests.',
      assigned_to: 'Layla Hassan',
      status:      'Pending',
      priority:    'Medium',
      due_date:    fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)),
    },
    {
      description: 'Push the final build to Render.com and verify environment variables.',
      assigned_to: 'Omar Khalid',
      status:      'Pending',
      priority:    'Low',
      due_date:    fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14)),
    },
  ];

  // Use createTask so each demo gets a proper id and created_at
  // Push in reverse so the first demo appears at the top
  [...demos].reverse().forEach(d => createTask(d));
}

/* ============================================================
   18. EVENT WIRING — All listeners in one place
============================================================= */
function wireEvents() {

  /* ---- Sidebar hamburger (mobile) ---- */
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebar-overlay');
  const hamburger= document.getElementById('hamburger');

  hamburger.addEventListener('click', () => {
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    } else {
      sidebar.classList.add('open');
      overlay.classList.add('open');
    }
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  });

  /* ---- Sidebar nav status filters ---- */
  document.querySelectorAll('.nav-link[data-filter]').forEach(link => {
    link.addEventListener('click', () => {
      state.statusFilter   = link.dataset.filter;
      state.priorityFilter = '';   // Reset priority when switching status

      // Sync filter tabs
      document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.status === state.statusFilter);
      });

      // Sync priority dropdown
      document.getElementById('priority-filter').value = '';

      // Close sidebar on mobile
      if (window.innerWidth <= 900) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      }

      renderAll();
    });
  });

  /* ---- Sidebar nav priority filter ---- */
  document.querySelectorAll('.nav-link[data-filter-priority]').forEach(link => {
    link.addEventListener('click', () => {
      const pf = link.dataset.filterPriority;
      // Toggle: clicking active priority filter deactivates it
      state.priorityFilter = state.priorityFilter === pf ? '' : pf;
      state.statusFilter   = '';

      // Sync status tabs to "All"
      document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.status === '');
      });

      document.getElementById('priority-filter').value = state.priorityFilter;

      if (window.innerWidth <= 900) {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      }

      renderAll();
    });
  });

  /* ---- Dark mode toggle ---- */
  document.getElementById('theme-toggle-nav').addEventListener('click', toggleTheme);

  /* ---- Open modal (Add Task button & empty state button) ---- */
  document.getElementById('open-modal-btn').addEventListener('click', () => {
    state.editingId = null;
    resetForm();
    openModal();
  });

  document.getElementById('empty-add-btn').addEventListener('click', () => {
    state.editingId = null;
    resetForm();
    openModal();
  });

  /* ---- Close modal ---- */
  document.getElementById('close-modal-btn').addEventListener('click', closeModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);

  // Click backdrop to close
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  /* ---- Escape key closes any open dialog ---- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modal-overlay').classList.contains('open')) closeModal();
    if (document.getElementById('confirm-overlay').classList.contains('open')) closeConfirmDialog();
  });

  /* ---- Form submit ---- */
  document.getElementById('task-form').addEventListener('submit', handleFormSubmit);

  /* ---- Filter tabs ---- */
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.statusFilter = tab.dataset.status;

      // Mark active tab
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Sync nav
      document.querySelectorAll('.nav-link[data-filter]').forEach(link => {
        link.classList.toggle('active', link.dataset.filter === state.statusFilter);
      });

      renderAll();
    });
  });

  /* ---- Priority dropdown filter ---- */
  document.getElementById('priority-filter').addEventListener('change', (e) => {
    state.priorityFilter = e.target.value;
    renderAll();
  });

  /* ---- Sort dropdown ---- */
  document.getElementById('sort-select').addEventListener('change', (e) => {
    state.sortMode = e.target.value;
    renderTasks(); // Stats don't change on sort
  });

  /* ---- Search input (debounced 250ms) ---- */
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      renderTasks();
    }, 250);
  });

  /* ---- Delete confirm dialog ---- */
  document.getElementById('confirm-cancel').addEventListener('click', closeConfirmDialog);
  document.getElementById('confirm-delete').addEventListener('click', confirmDelete);

  // Click backdrop to close confirm
  document.getElementById('confirm-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('confirm-overlay')) closeConfirmDialog();
  });
}

/* ============================================================
   19. BOOT — Entry point
============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // ---- 1. Restore saved theme ----
  const savedTheme = localStorage.getItem(LS_THEME) || 'light';
  applyTheme(savedTheme === 'dark');

  // ---- 2. Display today's date in topbar ----
  updateDateDisplay();

  // ---- 3. Load tasks from LocalStorage ----
  state.tasks = loadTasks();

  // ---- 4. Seed demo tasks if first visit ----
  seedDemoData();
  // Reload tasks after seeding (seedDemoData may have added items)
  state.tasks = loadTasks();

  // ---- 5. Wire all event listeners ----
  wireEvents();

  // ---- 6. Initial render ----
  renderAll();

  // ---- 7. Set default filter tabs active state ----
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.status === state.statusFilter);
  });
});
