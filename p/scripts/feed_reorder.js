/**
 * Feed Reordering Logic for Subscription Management
 * * Implements "Edit Mode" toggle, Up/Down button functionality for accessibility,
 * and HTML5 Drag & Drop with minimal-invasive lexical sorting.
 */
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('btn-toggle-reorder');
    if (!toggleBtn) return;

    let isEditMode = false;

    // --- 1. TOGGLE EDIT MODE ---
    toggleBtn.addEventListener('click', () => {
        isEditMode = !isEditMode;
        
        // Show or hide the drag handles and buttons
        document.querySelectorAll('.reorder-controls').forEach(el => {
            el.style.display = isEditMode ? 'inline-block' : 'none';
        });
        
        // Enable or disable HTML5 draggable property
        document.querySelectorAll('.item.feed').forEach(el => {
            el.draggable = isEditMode;
        });
        
        // Visual feedback for the button
        toggleBtn.style.opacity = isEditMode ? '0.7' : '1';
    });

    // --- 2. UP / DOWN BUTTONS (Accessibility & Touch Fallback) ---
    document.querySelectorAll('.feeds').forEach(feedList => {
        feedList.addEventListener('click', (e) => {
            if (!isEditMode) return;

            const btnUp = e.target.closest('.btn-reorder-up');
            const btnDown = e.target.closest('.btn-reorder-down');
            const currentItem = e.target.closest('.item.feed');

            if (!currentItem) return;

            if (btnUp && currentItem.previousElementSibling) {
                // Move item DOM element UP
                currentItem.parentNode.insertBefore(currentItem, currentItem.previousElementSibling);
                updatePriority(currentItem);
            } else if (btnDown && currentItem.nextElementSibling) {
                // Move item DOM element DOWN
                currentItem.parentNode.insertBefore(currentItem.nextElementSibling, currentItem);
                updatePriority(currentItem);
            }
        });
    });

    // --- 3. HTML5 DRAG & DROP ---
    let draggedItem = null;

    document.querySelectorAll('.item.feed').forEach(item => {
        item.addEventListener('dragstart', function(e) {
            if (!isEditMode) {
                e.preventDefault();
                return;
            }
            draggedItem = this;
            e.dataTransfer.effectAllowed = 'move';
            
            // Timeout to allow the DOM to attach the ghost image before hiding the source
            setTimeout(() => this.style.opacity = '0.4', 0);
        });

        item.addEventListener('dragend', function() {
            this.style.opacity = '1';
            if (draggedItem) {
                updatePriority(draggedItem);
                draggedItem = null;
            }
        });
    });

    document.querySelectorAll('.feeds').forEach(list => {
        list.addEventListener('dragover', e => {
            e.preventDefault(); // Necessary to allow dropping
            if (!draggedItem || !isEditMode) return;

            const afterElement = getDragAfterElement(list, e.clientY);
            if (afterElement == null) {
                list.appendChild(draggedItem);
            } else {
                list.insertBefore(draggedItem, afterElement);
            }
        });
    });

    /**
     * Determines which element we are currently hovering over to insert the dragged item
     */
    function getDragAfterElement(container, y) {
        // Exclude the currently dragged item from the calculation
        const draggableElements = [...container.querySelectorAll('.item.feed:not([style*="opacity: 0.4"])')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // --- 4. PRIORITY CALCULATION & AJAX ---
    /**
     * Calculates the new priority based on neighbors and sends the AJAX request
     */
    function updatePriority(item) {
        const prev = item.previousElementSibling;
        const next = item.nextElementSibling;

        // Extract priority integers from data attributes. Default gap is 10.
        let prevPriority = prev ? parseInt(prev.getAttribute('data-priority') || 0) : 0;
        let nextPriority = next ? parseInt(next.getAttribute('data-priority') || prevPriority + 20) : prevPriority + 20;

        let newPriority = 0;
        let needsReindex = false;

        // Check if we have enough integer space between the two items
        if (nextPriority - prevPriority > 1) {
            // Space available: Assign the middle value
            newPriority = Math.floor((prevPriority + nextPriority) / 2);
        } else {
            // Collision: No integer space left. 
            // Assign the previous priority and request a full category re-index from backend.
            newPriority = prevPriority;
            needsReindex = true;
        }

        // Update the DOM to reflect the new state locally
        item.setAttribute('data-priority', newPriority);

        // Fetch required data for the backend request
        const feedId = item.getAttribute('data-feed-id');
        const categoryId = item.closest('.feeds').getAttribute('data-category');
        
        // FreshRSS sets a global CSRF token, usually inside a hidden input or context
        const csrfToken = document.querySelector('input[name="_csrf"]')?.value || '';

        // Send AJAX request to our new PHP controller action
        fetch('?c=subscription&a=reorderFeed', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                _csrf: csrfToken,
                feed_id: feedId,
                category_id: categoryId,
                new_priority: newPriority,
                needs_reindex: needsReindex ? 1 : 0
            })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Failed to save new priority');
            } else if (needsReindex) {
                // If a collision happened, the backend completely rewrote all priorities.
                // We reload the page to pull the fresh, clean priority numbers.
                window.location.reload();
            }
        })
        .catch(err => console.error('AJAX error:', err));
    }
});
