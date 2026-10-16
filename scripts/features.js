// ===== Extra Features: Side Panel, Calendar, Task List =====

document.addEventListener('DOMContentLoaded', () => {
    initSidePanel();
    initCalendar();
    initTaskList();
});

// ---------- Side Panel (Calendar + Current Task) ----------
const panelToggleBtn = document.querySelector('.panel-toggle-btn');
const sidePanel = document.querySelector('.side-panel');
const panelOverlay = document.querySelector('.panel-overlay');
const panelClose = document.querySelector('.panel-close');

function initSidePanel() {
    if (!panelToggleBtn) return;

    panelToggleBtn.addEventListener('click', () => sidePanel.classList.toggle('open'));
    panelOverlay.addEventListener('click', () => sidePanel.classList.remove('open'));
    panelClose.addEventListener('click', () => sidePanel.classList.remove('open'));
}

// ---------- Calendar ----------
const HISTORY_KEY = 'pomodoro-history'; // { "Wed Sep 18 2026": 3, ... }
let calendarDate = new Date();

const calMonthLabel = document.querySelector('.cal-month-label');
const calGrid = document.querySelector('.cal-grid');
const calPrev = document.querySelector('.cal-prev');
const calNext = document.querySelector('.cal-next');

function initCalendar() {
    if (!calGrid) return;

    calPrev.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar();
    });
    calNext.addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar();
    });

    renderCalendar();
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || {};
    } catch {
        return {};
    }
}

function renderCalendar() {
    const history = getHistory();
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    calMonthLabel.textContent = `${monthNames[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toDateString();

    calGrid.innerHTML = '';

    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d) => {
        const el = document.createElement('div');
        el.className = 'cal-weekday';
        el.textContent = d;
        calGrid.appendChild(el);
    });

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        calGrid.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(year, month, day);
        const dateKey = dateObj.toDateString();
        const cell = document.createElement('div');
        cell.className = 'cal-day';
        if (dateKey === todayStr) cell.classList.add('today');

        const num = document.createElement('span');
        num.textContent = day;
        cell.appendChild(num);

        if (history[dateKey]) {
            const dot = document.createElement('span');
            dot.className = 'cal-dot';
            cell.appendChild(dot);
            cell.classList.add('has-sessions');
            cell.title = `${history[dateKey]} focus session(s)`;
        }

        calGrid.appendChild(cell);
    }
}

function recordPomodoroSession() {
    const history = getHistory();
    const key = new Date().toDateString();
    history[key] = (history[key] || 0) + 1;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderCalendar();
}

window.recordPomodoroSession = recordPomodoroSession;

// ---------- Task List ----------
const TODO_KEY = 'pomodoro-todos';
const newTaskInput = document.querySelector('.new-task-input');
const addTaskBtn = document.querySelector('.add-task-btn');
const taskListEl = document.querySelector('.task-list');

function initTaskList() {
    if (!taskListEl) return;

    addTaskBtn.addEventListener('click', addTask);
    newTaskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTask();
    });

    renderTasks();
}

function getTasks() {
    try {
        return JSON.parse(localStorage.getItem(TODO_KEY)) || [];
    } catch {
        return [];
    }
}

function saveTasks(tasks) {
    localStorage.setItem(TODO_KEY, JSON.stringify(tasks));
    if (window.scheduleCloudSave) window.scheduleCloudSave();
}

function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;

    const tasks = getTasks();
    tasks.push({ id: Date.now().toString(), text, completed: false });
    saveTasks(tasks);

    newTaskInput.value = '';
    renderTasks();
}

function toggleTask(id) {
    const tasks = getTasks();
    const task = tasks.find((t) => t.id === id);
    if (task) task.completed = !task.completed;
    saveTasks(tasks);
    renderTasks();
}

function deleteTask(id) {
    const tasks = getTasks().filter((t) => t.id !== id);
    saveTasks(tasks);
    renderTasks();
}

function renderTasks() {
    const tasks = getTasks();
    taskListEl.innerHTML = '';

    if (tasks.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'task-empty';
        empty.textContent = 'No tasks yet — add one above.';
        taskListEl.appendChild(empty);
        return;
    }

    // Show open tasks first, completed ones below
    const sorted = [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));

    sorted.forEach((task) => {
        const li = document.createElement('li');
        li.className = 'task-item' + (task.completed ? ' completed' : '');

        const checkbox = document.createElement('button');
        checkbox.className = 'task-checkbox' + (task.completed ? ' checked' : '');
        checkbox.setAttribute('aria-label', task.completed ? 'Mark as not done' : 'Mark as done');
        checkbox.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        checkbox.addEventListener('click', () => toggleTask(task.id));

        const text = document.createElement('span');
        text.className = 'task-text';
        text.textContent = task.text;

        const del = document.createElement('button');
        del.className = 'task-delete';
        del.setAttribute('aria-label', 'Delete task');
        del.textContent = '\u00D7';
        del.addEventListener('click', () => deleteTask(task.id));

        li.appendChild(checkbox);
        li.appendChild(text);
        li.appendChild(del);
        taskListEl.appendChild(li);
    });
}

// ---------- Cloud Sync Bridge (used by cloud.js) ----------
window.pomodoroFeatures = {
    getHistory: () => getHistory(),
    setHistory: (historyObj) => {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(historyObj || {}));
        renderCalendar();
    },
    getTasks: () => getTasks(),
    setTasks: (tasksArr) => {
        localStorage.setItem(TODO_KEY, JSON.stringify(tasksArr || []));
        renderTasks();
    }
};