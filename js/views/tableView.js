import { store } from '../store.js';

export class TableView {
    constructor(container) {
        this.container = container;
        this.sortField = null;
        this.sortAsc = true;

        // Global Drag Release
        // Global Drag Release (Capture Phase)
        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.selectionSnapshot = null;
            }
        }, { capture: true });

        window.addEventListener('blur', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.selectionSnapshot = null;
            }
        });

        // Listen for hover changes
        store.subscribe((event) => {
            if (event === 'hoverChanged') {
                this.updateHoverHighlight();
            }
        });
    }

    render() {
        if (store.data.length === 0) {
            this.container.innerHTML = '<div class="empty-state">No Data</div>';
            return;
        }

        const keys = Object.keys(store.data[0]).filter(k => k !== '_id');

        let displayData = [...store.data];
        if (this.sortField) {
            displayData.sort((a, b) => {
                const valA = a[this.sortField];
                const valB = b[this.sortField];
                if (valA < valB) return this.sortAsc ? -1 : 1;
                if (valA > valB) return this.sortAsc ? 1 : -1;
                return 0;
            });
        }

        // Keep reference to sorted IDs for range selection
        this.sortedIds = displayData.map(d => d._id);

        const table = document.createElement('table');
        table.className = 'data-table';

        // Determine Column Types (Number/Time/String) based on majority of data
        const colTypes = {};
        keys.forEach(k => {
            let numCount = 0;
            let timeCount = 0;
            let validCount = 0;

            // Check first 20 rows or all
            const limit = Math.min(store.data.length, 50);
            for (let i = 0; i < limit; i++) {
                const val = store.data[i][k];
                if (val === '' || val === '-') continue;
                validCount++;
                if (typeof val === 'number') numCount++;
                else if (this.isTime(val)) timeCount++;
            }

            if (validCount > 0) {
                if (numCount / validCount > 0.8) colTypes[k] = 'number';
                else if (timeCount / validCount > 0.8) colTypes[k] = 'time';
                else colTypes[k] = 'string';
            } else {
                colTypes[k] = 'string';
            }
        });

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        keys.forEach(k => {
            const th = document.createElement('th');
            th.textContent = k;
            if (colTypes[k] === 'number') th.classList.add('header-number');
            th.onclick = () => {
                if (this.sortField === k) this.sortAsc = !this.sortAsc;
                else { this.sortField = k; this.sortAsc = true; }
                this.render();
            };
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        displayData.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            tr.dataset.id = row._id;
            tr.dataset.index = rowIndex; // Store index for range calc

            if (store.selection.has(row._id)) tr.className = 'selected';

            keys.forEach(k => {
                const td = document.createElement('td');
                td.contentEditable = true;
                const value = row[k];
                const type = colTypes[k];

                if (type === 'number') {
                    td.classList.add('cell-number');
                    if (typeof value === 'number') {
                        const parts = value.toString().split('.');
                        const left = parts[0];
                        const right = parts[1] || '';

                        const container = document.createElement('div');
                        container.className = 'decimal-align';

                        const spanLeft = document.createElement('span');
                        spanLeft.className = 'decimal-left';
                        spanLeft.textContent = left.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

                        const spanPoint = document.createElement('span');
                        spanPoint.className = 'decimal-point';
                        spanPoint.textContent = right ? '.' : '';

                        const spanRight = document.createElement('span');
                        spanRight.className = 'decimal-right';
                        spanRight.textContent = right;

                        container.appendChild(spanLeft);
                        container.appendChild(spanPoint);
                        container.appendChild(spanRight);
                        td.appendChild(container);
                    } else {
                        td.textContent = value;
                    }
                } else if (type === 'time') {
                    td.classList.add('cell-time');
                    td.textContent = value;
                } else {
                    td.textContent = value;
                }

                // --- Interaction Logic ---

                td.onmousedown = (e) => {
                    if (document.activeElement !== td) {
                        e.preventDefault();
                        td.focus();
                    }

                    // 1. Capture State Start
                    this.isDragging = true;
                    this.anchorIndex = rowIndex;
                    store.setActiveCell(row._id, k);

                    // 2. Determine Base Selection
                    // If modifier key: Base is current selection.
                    // If no modifier: Base is empty (we are starting fresh).
                    const isAdditive = e.metaKey || e.ctrlKey || e.shiftKey;
                    this.selectionSnapshot = isAdditive ? new Set(store.selection) : new Set();

                    // 3. Initial Select (Range of size 1)
                    this.updateDragSelection(rowIndex);
                };

                td.onmouseover = (e) => {
                    if (this.isDragging) {
                        this.updateDragSelection(rowIndex);
                    }
                };

                td.onmouseup = () => {
                    this.isDragging = false;
                    this.selectionSnapshot = null;
                };

                // Inline Edit
                td.onblur = () => {
                    const newVal = td.textContent;
                    let typedVal = newVal;
                    // Simple number check, but preserve string if needed
                    if (!isNaN(Number(newVal)) && newVal.trim() !== '') {
                        typedVal = Number(newVal);
                    }

                    if (typedVal != row[k]) {
                        store.updateRow(row._id, k, typedVal);
                    }
                };

                td.onfocus = () => {
                    store.setActiveCell(row._id, k);
                };

                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });

        table.appendChild(tbody);

        this.container.innerHTML = '';
        this.container.appendChild(table);
    }

    // We should move listener attachment to constructor to avoid leak, 
    // or just check flag. The above flag approach is fine for this scope.

    updateDragSelection(targetIndex) {
        if (this.anchorIndex === undefined || !this.selectionSnapshot) return;

        // Calculate Range
        const start = Math.min(this.anchorIndex, targetIndex);
        const end = Math.max(this.anchorIndex, targetIndex);

        // New Selection = Snapshot U CurrentRange
        const newSelection = new Set(this.selectionSnapshot);

        for (let i = start; i <= end; i++) {
            const id = this.sortedIds[i];
            if (id) newSelection.add(id);
        }

        store.setSelection(newSelection);
    }

    updateSelectionHighlight() {
        // ... (can optimize: only update class)
        const rows = this.container.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            if (store.selection.has(tr.dataset.id)) tr.classList.add('selected');
            else tr.classList.remove('selected');
        });
    }

    isTime(val) {
        // Simple 00:00 format check
        return typeof val === 'string' && /^\d{1,2}:\d{2}(:\d{2})?$/.test(val);
    }

    updateHoverHighlight() {
        const rows = this.container.querySelectorAll('tbody tr');
        rows.forEach(tr => {
            tr.classList.remove('hover-match');

            if (store.hoverFilter) {
                const rowId = tr.dataset.id;
                const row = store.data.find(r => r._id === rowId);
                if (row && row[store.hoverFilter.property] == store.hoverFilter.value) {
                    tr.classList.add('hover-match');
                }
            }
        });
    }
}
