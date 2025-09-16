class TodoApp {
  static STORAGE_KEY = "todo_app_tasks";
  static NOTIFICATION_DURATION = 3000;
  static DEBOUNCE_DELAY = 300;

  constructor() {
    this.tasks = new Map();
    this.selectedTaskId = null;
    this.elements = this._cacheElements();
    this._outsideClickHandler = null;

    if (this._validateElements()) {
      this._init();
    } else {
      console.error(
        "TodoApp: Required DOM elements not found. Initialization aborted."
      );
    }
  }

  _cacheElements(){
    return {
      inputTask: document.getElementById("input-task"),
      addBtn: document.getElementById("add-task-btn"),
      editButton: document.getElementById("edit-task-btn"),
      clearAllButton: document.getElementById("clear-all-btn"),
      taskList: document.getElementById("task-list"),
      totalTasksSpan: document.getElementById("totalTasks"),
      completedTasksSpan: document.getElementById("completedTasks"),
      emptyState: document.querySelector(".empty-state"),
      notificationContainer: this._createNotificationContainer(),
    };
  }

  _validateElements() {
    const required = [
      "inputTask",
      "addBtn",
      "taskList",
      "totalTasksSpan",
      "completedTasksSpan",
    ];
    return required.every((key) => this.elements[key] !== null);
  }

  _createNotificationContainer() {
    let container = document.getElementById("notification-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "notification-container";
      document.body.appendChild(container);
    }
    return container;
  }

  _init() {
    this._loadTasks();
    this._bindEvents();
    this.render();
    this.elements.inputTask.focus();
  }

  _bindEvents() {
    this.elements.addBtn.addEventListener("click", () => this.handleAddTask());
    this.elements.inputTask.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleAddTask();
      }
    });
    this.elements.taskList.addEventListener("click", (e) =>
      this._handleTaskListClick(e)
    );
    this.elements.editButton.addEventListener("click", () =>
      this.handleEditTask()
    );
    this.elements.clearAllButton.addEventListener("click", () =>
      this.handleClearAllTasks()
    );
    this.elements.inputTask.addEventListener(
      "input",
      this._debounce(() => this._validateInput(), TodoApp.DEBOUNCE_DELAY)
    );
  }

  _loadTasks() {
    try {
      const tasksData = localStorage.getItem(TodoApp.STORAGE_KEY);
      if (tasksData) {
        const tasksArray = JSON.parse(tasksData);
        if (Array.isArray(tasksArray)) {
          this.tasks = new Map(
            tasksArray.map((task) => [
              task.id,
              this._validateTaskStructure(task),
            ])
          );
        }
      }
    } catch (error) {
      console.error("Error loading tasks from localStorage:", error);
      this._showNotification("Failed to load saved tasks", "error");
      this.tasks = new Map();
    }
  }

  _saveTasks() {
    try {
      const tasksArray = Array.from(this.tasks.values());
      localStorage.setItem(TodoApp.STORAGE_KEY, JSON.stringify(tasksArray));
    } catch (error) {
      console.error("Error saving tasks to localStorage:", error);
      this._showNotification("Failed to save tasks", "error");
    }
  }

  _validateTaskStructure(task) {
    return {
      id: task.id || this._generateUniqueId(),
      text: this._sanitizeText(task.text || ""),
      completed: Boolean(task.completed),
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString(),
    };
  }

  _generateUniqueId() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _sanitizeText(text) {
    const div = document.createElement("div");
    div.textContent = text.trim();
    return div.innerHTML;
  }

  _validateTaskText(text) {
    if (!text) {
      this._showNotification("Please enter a task", "warning");
      return false;
    }
    if (text.length > 500) {
      this._showNotification(
        "Task text is too long (max 500 characters)",
        "warning"
      );
      return false;
    }
    return true;
  }

  _isDuplicateTask(text, excludeId = null) {
    const normalizedText = text.toLowerCase().trim();
    return Array.from(this.tasks.values()).some(
      (task) =>
        task.id !== excludeId &&
        task.text.toLowerCase().trim() === normalizedText
    );
  }

  _createTask(text) {
    const now = new Date().toISOString();
    return {
      id: this._generateUniqueId(),
      text: this._sanitizeText(text),
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  _handleTaskListClick(event) {
    const taskItem = event.target.closest(".task-item");
    if (!taskItem) return;
    const taskId = taskItem.dataset.id;

    if (event.target.closest(".task-checkbox")) {
      this._toggleTaskCompletion(taskId);
    } else if (event.target.closest(".delete-btn")) {
      this._handleDeleteTask(taskId);
    } else {
      this._selectTask(taskId);
    }
  }

  _toggleTaskCompletion(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.completed = !task.completed;
    task.updatedAt = new Date().toISOString();
    this._saveTasks();
    this.render();
    const message = task.completed
      ? "Task completed!"
      : "Task marked as incomplete";
    this._showNotification(message, "success");
  }

  _handleDeleteTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;
    const message = `Are you sure you want to delete "<strong>${task.text}</strong>"?`;
    this._showConfirmationPopup("Delete Task?", message, "Delete", () => {
      this.tasks.delete(taskId);
      if (this.selectedTaskId === taskId) {
        this.selectedTaskId = null;
      }
      this._saveTasks();
      this.render();
      this._showNotification("Task deleted successfully!", "success");
    });
  }

  _selectTask(taskId) {
    const currentSelected = this.elements.taskList.querySelector(
      ".task-item.selected"
    );
    if (currentSelected) {
      currentSelected.classList.remove("selected");
    }

    this.selectedTaskId = taskId;

    const newSelected = this.elements.taskList.querySelector(
      `.task-item[data-id="${taskId}"]`
    );
    if (newSelected) {
      newSelected.classList.add("selected");
    }

    if (!this._outsideClickHandler) {
      this._outsideClickHandler = (event) => {
        if (!this.elements.taskList.contains(event.target)) {
          const selectedTask = this.elements.taskList.querySelector(
            ".task-item.selected"
          );
          if (selectedTask) {
            selectedTask.classList.remove("selected");
          }
          this.selectedTaskId = null;
          document.removeEventListener("click", this._outsideClickHandler);
          this._outsideClickHandler = null;
        }
      };
      document.addEventListener("click", this._outsideClickHandler);
    }
  }

  handleAddTask() {
    const taskText = this.elements.inputTask.value.trim();
    if (!this._validateTaskText(taskText)) return;
    if (this._isDuplicateTask(taskText)) {
      this._showNotification("This task already exists!", "warning");
      return;
    }
    const newTask = this._createTask(taskText);
    this.tasks.set(newTask.id, newTask);
    this.elements.inputTask.value = "";
    this._saveTasks();
    this.render();
    this._showNotification("Task added successfully!", "success");
  }

  handleEditTask() {
    if (!this.selectedTaskId) {
      this._showNotification("Please select a task to edit first", "warning");
      return;
    }
    const task = this.tasks.get(this.selectedTaskId);
    if (!task) {
      this._showNotification("Selected task not found", "error");
      return;
    }
    this._showEditPopup(task);
  }

  _showEditPopup(task) {
    const popup = document.createElement("div");
    popup.className = "custom-confirm";
    popup.innerHTML = `
      <div class="confirm-box">
        <h3>Edit Task</h3>
        <p>Modify your task below:</p>
        <input type="text" class="edit-input" value="${task.text}" maxlength="100" />
        <div class="confirm-actions">
          <button class="confirm-btn confirm-yes">Save</button>
          <button class="confirm-btn confirm-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);
    const inputField = popup.querySelector(".edit-input");
    inputField.focus();

    popup.querySelector(".confirm-yes").addEventListener("click", () => {
      const newText = inputField.value.trim();
      if (!this._validateTaskText(newText)) return;
      if (this._isDuplicateTask(newText, this.selectedTaskId)) {
        this._showNotification("This task already exists!", "warning");
        return;
      }
      task.text = this._sanitizeText(newText);
      task.updatedAt = new Date().toISOString();
      this._saveTasks();
      this.render();
      this._showNotification("Task updated successfully!", "success");
      popup.remove();
    });

    popup
      .querySelector(".confirm-cancel")
      .addEventListener("click", () => popup.remove());
    popup.addEventListener("click", (e) => {
      if (e.target === popup) popup.remove();
    });
  }

  handleClearAllTasks() {
    if (this.tasks.size === 0) {
      this._showNotification("No tasks to clear!", "info");
      return;
    }
    const message = `Are you sure you want to delete <strong>${this.tasks.size}</strong> tasks?<br><small>This cannot be undone.</small>`;
    this._showConfirmationPopup(
      "Clear All Tasks?",
      message,
      "Clear All",
      () => {
        this.tasks.clear();
        this.selectedTaskId = null;
        this._saveTasks();
        this.render();
        this._showNotification("All tasks cleared!", "success");
      }
    );
  }

  _showConfirmationPopup(title, message, yesText, onYes) {
    const confirmBox = document.createElement("div");
    confirmBox.className = "custom-confirm";
    confirmBox.innerHTML = `
      <div class="confirm-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-actions">
          <button class="confirm-btn confirm-yes">${yesText}</button>
          <button class="confirm-btn confirm-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(confirmBox);

    confirmBox.querySelector(".confirm-yes").addEventListener("click", () => {
      onYes();
      confirmBox.remove();
    });
    confirmBox
      .querySelector(".confirm-cancel")
      .addEventListener("click", () => confirmBox.remove());
    confirmBox.addEventListener("click", (e) => {
      if (e.target === confirmBox) confirmBox.remove();
    });
  }

  _validateInput() {
    const text = this.elements.inputTask.value.trim();
    this.elements.addBtn.disabled = !text || text.length > 500;
  }

  render() {
    this._renderTasks();
    this._updateCounters();
    this._toggleEmptyState();
  }

  _renderTasks() {
    this.elements.taskList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const sortedTasks = Array.from(this.tasks.values()).sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed - b.completed;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    sortedTasks.forEach((task) => {
      fragment.appendChild(this._createTaskElement(task));
    });
    this.elements.taskList.appendChild(fragment);
  }

  _createTaskElement(task) {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""} ${
      this.selectedTaskId === task.id ? "selected" : ""
    }`;
    li.setAttribute("data-id", task.id);
    li.setAttribute("aria-label", `Task: ${task.text}`);
    li.innerHTML = `
      <div class="task-checkbox ${
        task.completed ? "checked" : ""
      }" role="checkbox" aria-checked="${task.completed}" tabindex="0" title="${
      task.completed ? "Mark as incomplete" : "Mark as complete"
    }"></div>
      <div class="task-text">${task.text}</div>
      <div class="task-actions">
        <button class="delete-btn" title="Delete Task" aria-label="Delete task: ${
          task.text
        }">
          <i class='bx bx-trash'></i>
        </button>
      </div>
    `;
    return li;
  }

  _updateCounters() {
    const total = this.tasks.size;
    const completed = Array.from(this.tasks.values()).filter(
      (task) => task.completed
    ).length;
    this.elements.totalTasksSpan.textContent = total;
    this.elements.completedTasksSpan.textContent = completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    this.elements.totalTasksSpan.setAttribute(
      "title",
      `${progress}% completed`
    );
  }

  _toggleEmptyState() {
    const isEmpty = this.tasks.size === 0;
    this.elements.taskList.classList.toggle("empty", isEmpty);
    if (isEmpty) {
      if (!this.elements.taskList.contains(this.elements.emptyState)) {
        this.elements.taskList.appendChild(this.elements.emptyState);
      }
      this.elements.emptyState.style.display = "flex";
    } else {
      this.elements.emptyState.style.display = "none";
      if (this.elements.taskList.contains(this.elements.emptyState)) {
        this.elements.taskList.removeChild(this.elements.emptyState);
      }
    }
  }

  _showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification ${type}`;
    notification.textContent = message;
    this.elements.notificationContainer.appendChild(notification);
    requestAnimationFrame(() => notification.classList.add("show"));
    setTimeout(() => {
      notification.classList.remove("show");
      notification.addEventListener(
        "transitionend",
        () => notification.remove(),
        { once: true }
      );
    }, TodoApp.NOTIFICATION_DURATION);
  }

  _debounce(func, wait) {
    let timeout;
    return function (...args) {
      const context = this;
      const later = () => {
        timeout = null;
        func.apply(context, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    window.todoApp = new TodoApp();
  } catch (error) {
    console.error("Failed to initialize TodoApp:", error);
  }
});
