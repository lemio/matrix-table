import { store } from './store.js';
import { TableView } from './views/tableView.js';
import { FormView } from './views/formView.js';
import { MatrixView } from './views/matrixView.js';

// Initialize Components
const tableView = new TableView(document.getElementById('table-container'));
const formView = new FormView(document.getElementById('form-container'));
const matrixView = new MatrixView(document.getElementById('matrix-container'));

// Global Event Routing
store.subscribe((event, payload) => {
    if (event === 'dataChanged') {
        tableView.render();
        matrixView.render();
        formView.render();
    }
    if (event === 'selectionChanged') {
        tableView.updateSelectionHighlight();
        formView.render();
        matrixView.updateSelectionHighlight();
    }
    if (event === 'activeCellChanged') {
        // Payload is {rowId, key}
        // Re-render form to update highlight?
        // Or just update highlight style to avoid full re-render?
        // Full render is safer for now.
        formView.render();
    }
});

// --- Resizable Panels Logic ---
const panels = document.querySelectorAll('.view-panel');
panels.forEach((panel, idx) => {
    if (idx < panels.length - 1) {
        // Create handle
        const handle = document.createElement('div');
        handle.className = 'resize-handle';
        // handle appended to panel, positioned absolute right
        panel.appendChild(handle);

        handle.onmousedown = (e) => {
            e.preventDefault();
            const startX = e.clientX;
            const startWidth = panel.offsetWidth;

            const onMove = (mv) => {
                const newWidth = startWidth + (mv.clientX - startX);
                panel.style.flex = 'none'; // Disable flex grow to set specific width
                panel.style.width = `${newWidth}px`;
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
    }
});

// Import Logic
document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-modal').classList.remove('hidden');
});

document.getElementById('cancel-import-btn').addEventListener('click', () => {
    document.getElementById('import-modal').classList.add('hidden');
});

document.getElementById('confirm-import-btn').addEventListener('click', () => {
    const content = document.getElementById('import-textarea').value;
    if (content) {
        store.importData(content);
        document.getElementById('import-modal').classList.add('hidden');
    }
});

document.getElementById('copy-json-btn').addEventListener('click', () => {
    const selected = store.getSelectedRows();
    const dataToCopy = selected.length > 0 ? selected : store.data;
    // Strip _id before copy? Request says "copy it in JSON format; so it could be pasted in any text editor"
    navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2))
        .then(() => alert('Data copied to clipboard!'))
        .catch(e => console.error(e));
});

// --- Copy/Paste Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
    // Check if we're in an editable field (don't intercept normal editing)
    const activeElement = document.activeElement;
    const isEditable = activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' /*||
        activeElement.isContentEditable;*/

    // Copy: Cmd/Ctrl+C
    if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !isEditable) {
        e.preventDefault();
        store.copySelection();
    }

    // Paste: Cmd/Ctrl+V
    if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !isEditable) {
        e.preventDefault();
        store.pasteSelection();
    }

    // Delete: Delete or Backspace
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditable) {
        e.preventDefault();
        store.deleteSelection();
    }
});



// Initial Render
tableView.render();
matrixView.render();
formView.render();
