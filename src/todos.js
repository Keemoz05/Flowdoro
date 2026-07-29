/**
 * todos.js — Todo List Logic
 * Stores tasks in localStorage. Supports add, complete, delete.
 */

const STORAGE_KEY = 'flowdoro_tasks';

// Migrate from old storage key (one-time)
(() => {
  const old = localStorage.getItem('pomobodo_tasks');
  if (old !== null && !localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, old);
    localStorage.removeItem('pomobodo_tasks');
  }
})();

let tasks = [];

// ── DOM refs ──
const elInput    = document.getElementById('todo-input');
const elAddBtn   = document.getElementById('btn-add-task');
const elList     = document.getElementById('todo-list');
const elEmpty    = document.getElementById('todo-empty');
const elCount    = document.getElementById('todo-count');

// ─────────────────────────────────────────────────────
//  Persistence
// ─────────────────────────────────────────────────────
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch (_) {
    tasks = [];
  }
}

// ─────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────
function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const task = {
    id:        crypto.randomUUID(),
    text:      trimmed,
    completed: false,
    createdAt: Date.now(),
  };

  tasks.unshift(task); // newest first
  saveTasks();
  renderList();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderList();
}

function deleteTask(id) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    item.style.opacity    = '0';
    item.style.transform  = 'translateX(20px)';
    setTimeout(() => {
      tasks = tasks.filter(t => t.id !== id);
      saveTasks();
      renderList();
    }, 200);
    return;
  }
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  renderList();
}

// ─────────────────────────────────────────────────────
//  Render
// ─────────────────────────────────────────────────────
function renderList() {
  elList.innerHTML = '';

  const pending   = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);
  const ordered   = [...pending, ...completed]; // pending first

  if (ordered.length === 0) {
    elEmpty.classList.add('visible');
    updateCount(0);
    return;
  }

  elEmpty.classList.remove('visible');
  updateCount(pending.length);

  ordered.forEach(task => {
    const li = createTaskElement(task);
    elList.appendChild(li);
  });
}

function updateCount(pending) {
  elCount.textContent = pending;
}

function createTaskElement(task) {
  const li = document.createElement('li');
  li.className = `todo-item${task.completed ? ' completed' : ''}`;
  li.dataset.id = task.id;
  li.setAttribute('role', 'listitem');

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type    = 'checkbox';
  checkbox.checked = task.completed;
  checkbox.className = 'todo-checkbox';
  checkbox.id        = `chk-${task.id}`;
  checkbox.addEventListener('change', () => toggleTask(task.id));

  // Label / text
  const label = document.createElement('label');
  label.htmlFor   = `chk-${task.id}`;
  label.className = 'todo-text';
  label.textContent = task.text;

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-delete-task';
  deleteBtn.title = 'Delete task';
  deleteBtn.setAttribute('aria-label', `Delete: ${task.text}`);
  deleteBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`;
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  li.appendChild(checkbox);
  li.appendChild(label);
  li.appendChild(deleteBtn);
  return li;
}

// ─────────────────────────────────────────────────────
//  Init
// ─────────────────────────────────────────────────────
export function initTodos() {
  loadTasks();
  renderList();

  elAddBtn.addEventListener('click', () => {
    addTask(elInput.value);
    elInput.value = '';
    elInput.focus();
  });

  elInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask(elInput.value);
      elInput.value = '';
    }
  });
}
