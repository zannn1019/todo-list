document.addEventListener('DOMContentLoaded', () => {
    const todoForm = document.getElementById('todo-form');
    const todoInput = document.getElementById('todo-input');
    const todoList = document.getElementById('todo-list');
    const filterButtonsContainer = document.querySelector('.filter-buttons');
    const clearCompletedBtn = document.getElementById('clear-completed-btn');

    let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    let currentFilter = 'all';

    function saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }

    /**
     * Renders the tasks to the DOM based on the current filter.
     * Includes animations for adding and removing tasks.
     */
    function renderTasks() {
        const fragment = document.createDocumentFragment(); // Use a fragment for better performance

        // Clear the current list of tasks in the DOM more efficiently
        while (todoList.firstChild) {
            todoList.removeChild(todoList.firstChild);
        }

        let tasksToRender;
        if (currentFilter === 'active') {
            tasksToRender = tasks.filter(task => !task.completed);
        } else if (currentFilter === 'completed') {
            tasksToRender = tasks.filter(task => task.completed);
        } else { // 'all'
            tasksToRender = tasks;
        }

        if (tasksToRender.length === 0) {
            const emptyMessage = document.createElement('li');
            emptyMessage.className = 'empty-message';
            if (tasks.length === 0) {
                emptyMessage.textContent = 'No tasks yet. Add one above!';
            } else {
                emptyMessage.textContent = `No ${currentFilter} tasks to show.`;
            }
            fragment.appendChild(emptyMessage);
        } else {
            tasksToRender.forEach(task => {
                const listItem = document.createElement('li');
                listItem.className = 'todo-item';
                if (task.completed) {
                    listItem.classList.add('completed');
                }
                listItem.dataset.id = task.id;

                // For new item animation: check if this task was just added
                if (task.isNew) {
                    listItem.classList.add('new-item-animation');
                    // Remove the 'isNew' flag after a short delay so it's not persisted
                    // and to allow the animation to play
                    setTimeout(() => {
                        delete task.isNew; // Remove the temporary flag
                        // We don't need to call saveTasks() here as isNew is not meant to be persistent
                        // listItem.classList.remove('new-item-animation'); // CSS handles fade-in, no need to remove class
                    }, 0); // Execute after current stack, allowing CSS to apply initial state
                }


                const taskTextSpan = document.createElement('span');
                taskTextSpan.className = 'task-text';
                taskTextSpan.textContent = task.text;
                taskTextSpan.addEventListener('click', () => toggleTaskCompletion(task.id));

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'actions';

                const completeButton = document.createElement('button');
                completeButton.className = 'complete-btn';
                completeButton.innerHTML = task.completed ? '↶' : '✔'; // Undo (U+21B6) or Checkmark (U+2714)
                completeButton.title = task.completed ? 'Mark as Incomplete' : 'Mark as Complete';
                completeButton.addEventListener('click', () => toggleTaskCompletion(task.id));

                const deleteButton = document.createElement('button');
                deleteButton.className = 'delete-btn';
                deleteButton.innerHTML = ''; // Trash can icon (U+1F5D1)
                deleteButton.title = 'Delete Task';
                deleteButton.addEventListener('click', () => deleteTaskWithAnimation(task.id));

                actionsDiv.appendChild(completeButton);
                actionsDiv.appendChild(deleteButton);
                listItem.appendChild(taskTextSpan);
                listItem.appendChild(actionsDiv);
                fragment.appendChild(listItem); // Add to fragment
            });
        }

        todoList.appendChild(fragment); // Append fragment to the DOM once

        // Force reflow to ensure animation plays for newly added items.
        // This is a common trick to trigger CSS transitions on dynamically added elements.
        // Accessing offsetHeight is one way to do this.
        if (todoList.querySelector('.new-item-animation')) {
            void todoList.offsetHeight; // Trigger reflow
            document.querySelectorAll('.todo-item.new-item-animation').forEach(item => {
                item.classList.remove('new-item-animation'); // This will trigger the transition to the "normal" state
            });
        }
        updateClearCompletedButtonState();
    }


    function addTask(text) {
        const newTask = {
            id: Date.now(),
            text: text,
            completed: false,
            isNew: true // Temporary flag for animation
        };
        tasks.unshift(newTask);
        saveTasks();
        renderTasks();
    }

    function toggleTaskCompletion(id) {
        const task = tasks.find(task => task.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks(); // Re-render to reflect the change and update button states
        }
    }

    /**
     * Deletes a task with a preceding animation.
     * @param {number} id - The ID of the task to delete.
     */
    function deleteTaskWithAnimation(id) {
        const taskElement = todoList.querySelector(`.todo-item[data-id="${id}"]`);
        if (taskElement) {
            taskElement.classList.add('removing'); // Add class to trigger removal animation

            // Wait for the animation to complete before actually removing from data and DOM
            taskElement.addEventListener('transitionend', () => {
                // Ensure this runs only once, in case of multiple transitions
                if (taskElement.classList.contains('removing')) {
                    tasks = tasks.filter(task => task.id !== id);
                    saveTasks();
                    renderTasks(); // Re-render the list to reflect the change
                    // This will naturally remove the element if it's still there
                    // Or you could just remove taskElement from the DOM directly
                    // but re-rendering ensures consistency with filters.
                }
            }, { once: true }); // Important: ensure the listener is called only once
        } else {
            // Fallback if element not found (shouldn't happen in normal flow)
            tasks = tasks.filter(task => task.id !== id);
            saveTasks();
            renderTasks();
        }
    }


    function setFilter(filter) {
        currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(button => {
            button.classList.toggle('active', button.dataset.filter === filter);
        });
        renderTasks();
    }

    function clearCompletedTasks() {
        // Animate removal of completed tasks
        const completedTaskElements = todoList.querySelectorAll('.todo-item.completed');
        let animatedCount = 0;
        const totalCompleted = completedTaskElements.length;

        if (totalCompleted === 0) return; // Nothing to clear

        completedTaskElements.forEach(taskElement => {
            taskElement.classList.add('removing');
            taskElement.addEventListener('transitionend', () => {
                animatedCount++;
                // Once all animations are done, update the tasks array and re-render
                if (animatedCount === totalCompleted) {
                    tasks = tasks.filter(task => !task.completed);
                    saveTasks();
                    renderTasks();
                }
            }, { once: true });
        });

        // If for some reason transitionend doesn't fire for all (e.g., elements removed by other means)
        // provide a fallback. This is a bit more robust.
        setTimeout(() => {
            if (animatedCount < totalCompleted) {
                console.warn("Fallback: Not all completed tasks animated out. Forcing update.");
                tasks = tasks.filter(task => !task.completed);
                saveTasks();
                renderTasks();
            }
        }, 500); // 500ms should be more than transition duration
    }

    /**
     * Updates the state (enabled/disabled, visibility) of the "Clear Completed" button.
     */
    function updateClearCompletedButtonState() {
        const hasCompletedTasks = tasks.some(task => task.completed);
        clearCompletedBtn.disabled = !hasCompletedTasks;
        // You can also use the .hidden class if you prefer to hide it entirely
        // clearCompletedBtn.classList.toggle('hidden', !hasCompletedTasks);
    }

    todoForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const taskText = todoInput.value.trim();
        if (taskText) {
            addTask(taskText);
            todoInput.value = '';
            todoInput.focus();
        } else {
            // Simple visual feedback for empty input could be a shake animation on the input
            todoInput.style.animation = 'shake 0.5s';
            setTimeout(() => todoInput.style.animation = '', 500);
            // alert("Please enter a task!"); // Or keep alert
        }
    });

    filterButtonsContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('filter-btn')) {
            setFilter(event.target.dataset.filter);
        }
    });

    clearCompletedBtn.addEventListener('click', clearCompletedTasks);

    // Initial Render
    renderTasks();
    setFilter(currentFilter); // Ensure filter buttons are correctly styled on load

    // Add a simple shake animation for the input if submission is empty
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(styleSheet);
});