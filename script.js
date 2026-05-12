/**
 * TeamFlow — Task Management System
 * app.js  |  All client-side logic
 *
 * Data is stored in localStorage as JSON.
 * Key: "teamflow_tasks"  → array of task objects
 *
 * Task schema:
 *  {
 *    id:          string  (UUID-like)
 *    title:       string
 *    description: string
 *    assigned_to: string
 *    status:      "Pending" | "In Progress" | "Completed"
 *    priority:    "High" | "Medium" | "Low"
 *    due_date:    string  (YYYY-MM-DD or "")
 *    created_at:  string  (ISO timestamp)
 *  }
 */

// ============================================================
// 1. STORAGE HELPERS
// ============================================================

const STORAGE_KEY = "teamflow_tasks";

/** Load all tasks from localStorage. Returns an array. */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Persist tasks array to localStorage. */
function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/** Generate a simple unique ID (no library needed). */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ============================================================
// 2. STATE
// ============================================================

let tasks       = loadTasks();          // master task list
let filterStatus  = "all";              // active status pill
let filterPriority = "all";             // priority dropdown
let searchQuery  = "";                  // search bar text
let deleteTargetId = null;              // id pending deletion

// ============================================================
// 3. DOM REFERENCES
// ============================================================

const tasksGrid       = document.getElementById("tasksGrid");
const emptyState      = document.getElementById("emptyState");

const statTotal       = document.getElementById("statTotal");
const statPending     = document.getElementById("statPending");
const statInProgress  = document.getElementById("statInProgress");
const statCompleted   = document.getElementById("statCompleted");

const searchInput     = document.getElementById("searchInput");
const priorityFilter  = document.getElementById("priorityFilter");

// Modal — add/edit
const modalOverlay    = document.getElementById("modalOverlay");
const openModalBtn    = document.getElementById("openModalBtn");
const closeModalBtn   = document.getElementById("closeModalBtn");
const cancelModalBtn  = document.getElementById("cancelModalBtn");
const saveTaskBtn     = document.getElementById("saveTaskBtn");
const modalTitle      = document.getElementById("modalTitle");

// Form fields
const fieldId          = document.getElementById("taskId");
const fieldTitle       = document.getElementById("taskTitle");
const fieldDescription = document.getElementById("taskDescription");
const fieldAssignee    = document.getElementById("taskAssignee");
const fieldStatus      = document.getElementById("taskStatus");
const fieldPriority    = document.getElementById("taskPriority");
const fieldDueDate     = document.getElementById("taskDueDate");

// Modal — delete confirm
const deleteOverlay    = document.getElementById("deleteOverlay");
const closeDeleteBtn   = document.getElementById("closeDeleteBtn");
const cancelDeleteBtn  = document.getElementById("cancelDeleteBtn");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const deleteTaskName   = document.getElementById("deleteTaskName");

// Toast
const toast = document.getElementById("toast");

// Theme
const themeToggle = document.getElementById("themeToggle");
const themeIcon   = document.getElementById("themeIcon");
const themeLabel  = document.getElementById("themeLabel");

// Sidebar / hamburger
const sidebar    = document.getElementById("sidebar");
const hamburger  = document.getElementById("hamburger");

// Nav items
const navItems   = document.querySelectorAll(".nav-item");
const viewDash   = document.getElementById("viewDashboard");
const viewMembers = document.getElementById("viewMembers");
const membersGrid = document.getElementById("membersGrid");
const pageTitle  = document.getElementById("pageTitle");

// ============================================================
// 4. RENDERING
// ============================================================

/**
 * Main render function — called any time state changes.
 * Filters tasks then builds card HTML.
 */
function render() {
  updateStats();

  // Apply filters
  let visible = tasks.filter(t => {
    const matchStatus   = filterStatus === "all" || t.status === filterStatus;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    const q = searchQuery.toLowerCase();
    const matchSearch   = !q
      || t.title.toLowerCase().includes(q)
      || t.description.toLowerCase().includes(q)
      || t.assigned_to.toLowerCase().includes(q);
    return matchStatus && matchPriority && matchSearch;
  });

  // Sort: newest first
  visible.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Render or empty state
  if (visible.length === 0) {
    tasksGrid.innerHTML = "";
    emptyState.style.display = "block";
  } else {
    emptyState.style.display = "none";
    tasksGrid.innerHTML = visible.map(buildCard).join("");
  }

  // Re-init icons inside dynamic HTML
  lucide.createIcons();
}

/** Build a single task card HTML string. */
function buildCard(task) {
  const statusBadge   = buildStatusBadge(task.status);
  const priorityBadge = buildPriorityBadge(task.priority);
  const initials = (task.assigned_to || "?")
    .split(" ")
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");

  const dueLabel = task.due_date ? formatDue(task.due_date) : "";
  const isOverdue = task.due_date && task.status !== "Completed" && new Date(task.due_date) < new Date();
  const dueCls = isOverdue ? "due-date overdue" : "due-date";

  const desc = task.description
    ? `<p class="task-desc">${escHtml(task.description)}</p>`
    : "";

  return `
  <div class="task-card" data-status="${escHtml(task.status)}" data-id="${task.id}">
    <div class="task-card-header">
      <span class="task-title">${escHtml(task.title)}</span>
      <div class="task-actions">
        <button class="edit-btn" title="Edit task" onclick="openEditModal('${task.id}')">
          <i data-lucide="pencil"></i>
        </button>
        <button class="delete-btn" title="Delete task" onclick="openDeleteModal('${task.id}')">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>

    ${desc}

    <div class="task-meta">
      ${statusBadge}
      ${priorityBadge}
    </div>

    <div class="task-footer">
      <div class="assignee-chip">
        <div class="assignee-avatar">${escHtml(initials)}</div>
        ${escHtml(task.assigned_to)}
      </div>
      ${dueLabel ? `<span class="${dueCls}">${dueLabel}</span>` : ""}
    </div>
  </div>`;
}

/** Status badge HTML. */
function buildStatusBadge(status) {
  const map = {
    "Pending":     "badge-pending",
    "In Progress": "badge-inprogress",
    "Completed":   "badge-completed",
  };
  return `<span class="badge ${map[status] || ''}">${escHtml(status)}</span>`;
}

/** Priority badge HTML. */
function buildPriorityBadge(priority) {
  const map = { "High": "badge-high", "Medium": "badge-medium", "Low": "badge-low" };
  return `<span class="badge ${map[priority] || ''}">${escHtml(priority)}</span>`;
}

/** Format due date for display. */
function formatDue(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Escape HTML to prevent XSS. */
function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// 5. STATISTICS
// ============================================================

function updateStats() {
  const total      = tasks.length;
  const pending    = tasks.filter(t => t.status === "Pending").length;
  const inProgress = tasks.filter(t => t.status === "In Progress").length;
  const completed  = tasks.filter(t => t.status === "Completed").length;

  statTotal.textContent      = total;
  statPending.textContent    = pending;
  statInProgress.textContent = inProgress;
  statCompleted.textContent  = completed;
}

// ============================================================
// 6. MEMBERS VIEW
// ============================================================

function renderMembers() {
  // Build a map of assignee → task count
  const map = {};
  tasks.forEach(t => {
    const name = t.assigned_to || "Unassigned";
    map[name] = (map[name] || 0) + 1;
  });

  const members = Object.entries(map);
  if (members.length === 0) {
    membersGrid.innerHTML = `<p style="color:var(--text-secondary)">No team members yet. Add tasks to see team members here.</p>`;
    return;
  }

  // Generate a consistent colour per person
  const colours = ["#7c5cfc","#3b82f6","#22c55e","#f59e0b","#ef4444","#ec4899","#06b6d4"];
  membersGrid.innerHTML = members
    .sort(([, a], [, b]) => b - a) // most tasks first
    .map(([name, count], i) => {
      const initials = name.split(" ").slice(0,2).map(w=>w[0].toUpperCase()).join("");
      const colour   = colours[i % colours.length];
      return `
      <div class="member-card">
        <div class="member-avatar-lg" style="background:${colour}">${escHtml(initials)}</div>
        <div class="member-name">${escHtml(name)}</div>
        <div class="member-task-count">${count} task${count !== 1 ? "s" : ""}</div>
      </div>`;
    })
    .join("");
}

// ============================================================
// 7. MODAL — ADD / EDIT
// ============================================================

/** Open the modal in "add new task" mode. */
function openAddModal() {
  modalTitle.textContent = "New Task";
  resetForm();
  showModal(modalOverlay);
}

/** Open the modal in "edit" mode, pre-filled with task data. */
function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  modalTitle.textContent     = "Edit Task";
  fieldId.value              = task.id;
  fieldTitle.value           = task.title;
  fieldDescription.value     = task.description;
  fieldAssignee.value        = task.assigned_to;
  fieldStatus.value          = task.status;
  fieldPriority.value        = task.priority;
  fieldDueDate.value         = task.due_date || "";

  showModal(modalOverlay);
}

/** Reset all form fields. */
function resetForm() {
  fieldId.value          = "";
  fieldTitle.value       = "";
  fieldDescription.value = "";
  fieldAssignee.value    = "";
  fieldStatus.value      = "Pending";
  fieldPriority.value    = "Medium";
  fieldDueDate.value     = "";
}

/** Save: either create or update a task. */
function saveTask() {
  const title    = fieldTitle.value.trim();
  const assignee = fieldAssignee.value.trim();

  // Basic validation
  if (!title) { shake(fieldTitle); return; }
  if (!assignee) { shake(fieldAssignee); return; }

  const id = fieldId.value;

  if (id) {
    // --- UPDATE existing ---
    tasks = tasks.map(t => t.id !== id ? t : {
      ...t,
      title:       title,
      description: fieldDescription.value.trim(),
      assigned_to: assignee,
      status:      fieldStatus.value,
      priority:    fieldPriority.value,
      due_date:    fieldDueDate.value,
    });
    showToast("✅ Task updated!");
  } else {
    // --- CREATE new ---
    const newTask = {
      id:          uid(),
      title,
      description: fieldDescription.value.trim(),
      assigned_to: assignee,
      status:      fieldStatus.value,
      priority:    fieldPriority.value,
      due_date:    fieldDueDate.value,
      created_at:  new Date().toISOString(),
    };
    tasks.unshift(newTask); // add to front
    showToast("🎉 Task created!");
  }

  saveTasks(tasks);
  closeModal(modalOverlay);
  render();
}

/** Subtle shake animation on invalid fields. */
function shake(el) {
  el.style.transition = "none";
  el.style.borderColor = "var(--danger)";
  el.classList.add("shake");
  setTimeout(() => {
    el.style.borderColor = "";
    el.classList.remove("shake");
  }, 600);
  el.focus();
}

// ============================================================
// 8. MODAL — DELETE CONFIRM
// ============================================================

function openDeleteModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  deleteTargetId = id;
  deleteTaskName.textContent = task.title;
  showModal(deleteOverlay);
}

function confirmDelete() {
  if (!deleteTargetId) return;
  tasks = tasks.filter(t => t.id !== deleteTargetId);
  saveTasks(tasks);
  deleteTargetId = null;
  closeModal(deleteOverlay);
  render();
  showToast("🗑️ Task deleted.");
}

// ============================================================
// 9. MODAL HELPERS
// ============================================================

function showModal(overlay) {
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal(overlay) {
  overlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ============================================================
// 10. TOAST NOTIFICATION
// ============================================================

let toastTimer = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

// ============================================================
// 11. THEME
// ============================================================

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("teamflow_theme", mode);
  if (mode === "dark") {
    themeLabel.textContent = "Light Mode";
    // swap icon — lucide can't hot-swap, so update attribute + recreate
    document.querySelector("#themeToggle i").setAttribute("data-lucide", "sun");
  } else {
    themeLabel.textContent = "Dark Mode";
    document.querySelector("#themeToggle i").setAttribute("data-lucide", "moon");
  }
  lucide.createIcons();
}

function initTheme() {
  const saved = localStorage.getItem("teamflow_theme") || "light";
  applyTheme(saved);
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

// ============================================================
// 12. NAVIGATION
// ============================================================

function switchView(view) {
  viewDash.classList.add("hidden");
  viewMembers.classList.add("hidden");
  navItems.forEach(n => n.classList.remove("active"));

  if (view === "dashboard" || view === "tasks") {
    viewDash.classList.remove("hidden");
    pageTitle.textContent = view === "dashboard" ? "Dashboard" : "All Tasks";
  } else if (view === "members") {
    viewMembers.classList.remove("hidden");
    pageTitle.textContent = "Team Members";
    renderMembers();
  }

  document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add("active");

  // Close sidebar on mobile after nav
  if (window.innerWidth <= 768) {
    sidebar.classList.remove("open");
  }
}

navItems.forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    switchView(item.dataset.view);
  });
});

// ============================================================
// 13. SIDEBAR TOGGLE (MOBILE)
// ============================================================

hamburger.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Close sidebar when clicking outside (mobile)
document.addEventListener("click", e => {
  if (window.innerWidth <= 768
    && sidebar.classList.contains("open")
    && !sidebar.contains(e.target)
    && e.target !== hamburger
    && !hamburger.contains(e.target)) {
    sidebar.classList.remove("open");
  }
});

// ============================================================
// 14. EVENT LISTENERS
// ============================================================

// Open add modal
openModalBtn.addEventListener("click", openAddModal);

// Close modal (X button, cancel button, overlay click)
closeModalBtn.addEventListener("click", () => closeModal(modalOverlay));
cancelModalBtn.addEventListener("click", () => closeModal(modalOverlay));
modalOverlay.addEventListener("click", e => {
  if (e.target === modalOverlay) closeModal(modalOverlay);
});

// Save task
saveTaskBtn.addEventListener("click", saveTask);

// Allow Enter to submit in title field
fieldTitle.addEventListener("keydown", e => {
  if (e.key === "Enter") saveTask();
});

// Delete modal
closeDeleteBtn.addEventListener("click", () => closeModal(deleteOverlay));
cancelDeleteBtn.addEventListener("click", () => closeModal(deleteOverlay));
deleteOverlay.addEventListener("click", e => {
  if (e.target === deleteOverlay) closeModal(deleteOverlay);
});
confirmDeleteBtn.addEventListener("click", confirmDelete);

// Filter pills
document.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    filterStatus = pill.dataset.filter;
    render();
  });
});

// Priority dropdown
priorityFilter.addEventListener("change", () => {
  filterPriority = priorityFilter.value;
  render();
});

// Search
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  render();
});

// Escape key closes any open modal
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal(modalOverlay);
    closeModal(deleteOverlay);
  }
});

// ============================================================
// 15. SEED DATA (first-time users)
// ============================================================

function seedIfEmpty() {
  if (tasks.length > 0) return;

  const seeds = [
    {
      id: uid(), title: "Design landing page mockup",
      description: "Create high-fidelity Figma mockups for the new marketing landing page.",
      assigned_to: "Sara Ahmed", status: "In Progress", priority: "High",
      due_date: futureDate(3), created_at: new Date().toISOString(),
    },
    {
      id: uid(), title: "Set up CI/CD pipeline",
      description: "Configure GitHub Actions for automated tests and Render deployment.",
      assigned_to: "Khalid Hassan", status: "Pending", priority: "High",
      due_date: futureDate(5), created_at: new Date().toISOString(),
    },
    {
      id: uid(), title: "Write API documentation",
      description: "Document all REST endpoints using OpenAPI / Swagger.",
      assigned_to: "Lena Müller", status: "Pending", priority: "Medium",
      due_date: futureDate(7), created_at: new Date().toISOString(),
    },
    {
      id: uid(), title: "Database optimisation",
      description: "Add indexes and optimise slow queries identified in profiling.",
      assigned_to: "Omar Farouq", status: "Completed", priority: "Medium",
      due_date: futureDate(-2), created_at: new Date().toISOString(),
    },
    {
      id: uid(), title: "User acceptance testing",
      description: "Run UAT sessions with 5 real users and collect feedback.",
      assigned_to: "Sara Ahmed", status: "Pending", priority: "Low",
      due_date: futureDate(10), created_at: new Date().toISOString(),
    },
    {
      id: uid(), title: "Fix mobile nav overflow bug",
      description: "Sidebar overlaps content on screens < 375 px.",
      assigned_to: "Khalid Hassan", status: "In Progress", priority: "High",
      due_date: futureDate(1), created_at: new Date().toISOString(),
    },
  ];

  tasks = seeds;
  saveTasks(tasks);
}

/** Helper: return a date string N days from today. */
function futureDate(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

// ============================================================
// 16. INIT
// ============================================================

(function init() {
  initTheme();
  seedIfEmpty();
  render();
  lucide.createIcons();
})();
