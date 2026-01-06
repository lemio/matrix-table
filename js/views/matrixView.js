import { store } from '../store.js';

export class MatrixView {
    constructor(container) {
        this.container = container;

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

        const rowKey = store.config.matrixRow;
        const colKey = store.config.matrixCol;
        // Ensure cellLabelKey is array
        let cellLabelIds = store.config.matrixCellLabel;
        if (!Array.isArray(cellLabelIds)) cellLabelIds = [cellLabelIds];

        const cellColorKey = store.config.matrixCellColor;
        const cellShapeKey = store.config.matrixCellShape;
        const cellSizeKey = store.config.matrixCellSize;

        // Calculate Max Value for size scaling if needed
        let maxSizeVal = 1;
        if (cellSizeKey && cellSizeKey !== 'None') {
            const vals = store.data.map(d => parseFloat(d[cellSizeKey])).filter(v => !isNaN(v));
            if (vals.length) maxSizeVal = Math.max(...vals);
        }

        // 1. Get Sorted Row Labels
        const rowLabels = [...new Set(store.data.map(r => r[rowKey]))].sort();
        this.rowLabels = rowLabels; // Store for selection

        // 2. Get Sorted Col Labels
        const sampleVal = store.data[0][colKey] || '';
        let isTime = typeof sampleVal === 'string' && /^\d{1,2}:\d{2}/.test(sampleVal);

        let colLabels = [];
        if (isTime) {
            for (let i = 0; i < 24; i++) {
                colLabels.push(i.toString().padStart(2, '0') + ':00');
            }
        } else {
            colLabels = [...new Set(store.data.map(r => r[colKey]))].sort();
        }
        this.colLabels = colLabels; // Store for selection

        // 3. Grid Data Calculation
        const gridData = {};
        const colCounts = {};
        colLabels.forEach(c => colCounts[c] = 0);

        store.data.forEach(item => {
            const rVal = item[rowKey];
            const cVal = item[colKey];

            let matchedCol = null;
            if (isTime && cVal) {
                const hour = cVal.substring(0, 2);
                matchedCol = hour + ':00';
            } else {
                matchedCol = cVal;
            }

            if (colLabels.includes(matchedCol)) {
                if (!gridData[rVal]) gridData[rVal] = {};
                if (!gridData[rVal][matchedCol]) gridData[rVal][matchedCol] = [];
                gridData[rVal][matchedCol].push(item);
                colCounts[matchedCol]++;
            }
        });

        // Filter Cols
        const finalCols = colLabels.filter(c => colCounts[c] > 0);
        this.finalCols = finalCols; // Store for selection

        // 4. Build DOM
        this.container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'matrix-grid';
        grid.style.gridTemplateColumns = `minmax(80px, auto) repeat(${finalCols.length}, minmax(40px, auto))`;

        // -- Config Header (Top Left)
        const tl = document.createElement('div');
        tl.className = 'matrix-header-col matrix-config-trigger';
        tl.title = 'Click to change rows/cols';

        const renderHeaderContent = () => {
            const spanRow = document.createElement('span');
            spanRow.textContent = rowKey;
            spanRow.style.cursor = 'pointer';

            const separator = document.createElement('span');
            separator.textContent = ' / ';
            separator.style.color = 'var(--text-muted)';
            separator.style.margin = '0 4px';

            const spanCol = document.createElement('span');
            spanCol.textContent = colKey;
            spanCol.style.cursor = 'pointer';

            tl.innerHTML = '';
            tl.appendChild(spanRow);
            tl.appendChild(separator);
            tl.appendChild(spanCol);
        };

        const availableKeys = store.data.length ? Object.keys(store.data[0]).filter(k => k !== '_id') : [];

        tl.onclick = (e) => {
            // If already editing, don't re-trigger
            if (tl.querySelector('select')) return;

            tl.innerHTML = '';
            const selRow = document.createElement('select');
            selRow.style.fontSize = '10px';
            selRow.style.width = '60px';
            availableKeys.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = k;
                if (k === rowKey) opt.selected = true;
                selRow.appendChild(opt);
            });

            const separator = document.createElement('span');
            separator.textContent = ' / ';

            const selCol = document.createElement('select');
            selCol.style.fontSize = '10px';
            selCol.style.width = '60px';
            availableKeys.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = k;
                if (k === colKey) opt.selected = true;
                selCol.appendChild(opt);
            });

            const update = () => {
                store.config.matrixRow = selRow.value;
                store.config.matrixCol = selCol.value;
                store.save();
                store.emit('dataChanged');
            };

            selRow.onchange = update;
            selCol.onchange = update;

            // Blur handling to return to text if nothing changed? 
            // Actually, once they change it re-renders. If they click away?
            // Multi-listener for blur is tricky on two selects. Let's just keep it simple.

            tl.appendChild(selRow);
            tl.appendChild(separator);
            tl.appendChild(selCol);
            selRow.focus();
        };

        renderHeaderContent();
        grid.appendChild(tl);

        // -- Col Headers
        finalCols.forEach(c => {
            const th = document.createElement('div');
            th.className = 'matrix-header-row';
            th.textContent = c;
            grid.appendChild(th);
        });

        // -- Data Rows
        rowLabels.forEach((rLabel, rIdx) => {
            // Row Header
            const rh = document.createElement('div');
            rh.className = 'matrix-header-col';
            rh.textContent = rLabel;
            grid.appendChild(rh);

            // Cells
            finalCols.forEach((cLabel, cIdx) => {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell';

                const matches = (gridData[rLabel] && gridData[rLabel][cLabel]) || [];

                // --- Selection Logic ---
                // We use coordinates (rIdx, cIdx) for range selection
                cell.dataset.r = rIdx;
                cell.dataset.c = cIdx;

                cell.onmousedown = (e) => {
                    e.preventDefault();

                    // 1. Capture Start
                    this.isDragging = true;
                    this.anchorRow = rIdx;
                    this.anchorCol = cIdx;

                    // 2. Base Selection Snapshot
                    const isAdditive = e.shiftKey || e.metaKey || e.ctrlKey;
                    this.selectionSnapshot = isAdditive ? new Set(store.selection) : new Set();

                    // 3. Initial Update
                    this.updateDragSelection(rIdx, cIdx);
                };

                cell.onmouseover = (e) => {
                    if (this.isDragging) {
                        this.updateDragSelection(rIdx, cIdx);
                    }
                };

                cell.onmouseup = () => {
                    this.isDragging = false;
                    this.selectionSnapshot = null;
                };

                if (matches.length > 0) {
                    cell.classList.add('has-data');
                    cell.style.display = 'block';
                    cell.style.overflowY = 'auto';

                    matches.forEach(m => {
                        const itemDiv = document.createElement('div');
                        itemDiv.className = 'matrix-item';
                        itemDiv.style.marginBottom = '3px';
                        itemDiv.style.display = 'flex';
                        itemDiv.style.alignItems = 'center';
                        itemDiv.style.gap = '4px';

                        // --- Visual Indicator (Shape/Color/Size) ---
                        if (store.config.matrixCellShapeEnabled) {
                            const indicator = document.createElement('div');

                            // Color Logic (handled by store.getColor which already respects mode)
                            const color = store.getColor(cellColorKey, m[cellColorKey]);

                            const shape = store.getShape(cellShapeKey, m[cellShapeKey]);

                            // Size Logic (Area-based scaling)
                            let size = 8; // Default
                            if (store.config.matrixCellSizeMode === 'fixed') {
                                size = store.config.matrixCellStaticValues.size;
                            } else if (cellSizeKey !== 'None') {
                                const val = parseFloat(m[cellSizeKey]);
                                if (!isNaN(val)) {
                                    // Side length is proportional to square root of value (Area scaling)
                                    size = Math.max(4, Math.sqrt(val / (maxSizeVal || 1)) * 20);
                                }
                            }

                            indicator.className = `shape shape-${this.getShapeName(shape)}`;
                            indicator.style.width = `${size}px`;
                            indicator.style.height = `${size}px`;
                            indicator.style.backgroundColor = color;
                            indicator.style.flexShrink = '0';
                            itemDiv.appendChild(indicator);
                        }

                        // --- Labels ---
                        const activeLabelIds = cellLabelIds.filter(id => id && id !== '');

                        // Centering if no labels
                        if (activeLabelIds.length === 0) {
                            itemDiv.style.justifyContent = 'center';
                            itemDiv.style.width = '100%';
                        }

                        const labelSpan = document.createElement('span');
                        labelSpan.style.fontSize = '9px';
                        labelSpan.style.whiteSpace = 'nowrap';

                        activeLabelIds.forEach(labelKey => {
                            const val = m[labelKey];
                            const span = document.createElement('span');
                            span.textContent = (val === '' ? '-' : val) + ' ';
                            span.style.marginRight = '3px';
                            labelSpan.appendChild(span);
                        });

                        if (activeLabelIds.length > 0) {
                            itemDiv.appendChild(labelSpan);
                        }

                        // Visual Item Highlight
                        if (store.selection.has(m._id)) {
                            itemDiv.style.background = 'var(--selection-color)';
                            itemDiv.style.color = 'white';
                        }

                        cell.appendChild(itemDiv);
                    });

                    const anySelected = matches.some(m => store.selection.has(m._id));
                    if (anySelected) cell.classList.add('selected-dim');
                }
                grid.appendChild(cell);
            });
        });


        this.container.appendChild(grid);
        this.gridData = gridData; // Store for selection lookup
    }

    updateDragSelection(targetR, targetC) {
        if (this.anchorRow === undefined || !this.selectionSnapshot) return;

        // Calculate Bounds
        const startR = Math.min(this.anchorRow, targetR);
        const endR = Math.max(this.anchorRow, targetR);
        const startC = Math.min(this.anchorCol, targetC);
        const endC = Math.max(this.anchorCol, targetC);

        const newSelection = new Set(this.selectionSnapshot);

        // Iterate Area
        for (let r = startR; r <= endR; r++) {
            const rLabel = this.rowLabels[r];
            for (let c = startC; c <= endC; c++) {
                const cLabel = this.finalCols[c];
                const items = (this.gridData[rLabel] && this.gridData[rLabel][cLabel]) || [];
                items.forEach(i => newSelection.add(i._id));
            }
        }

        store.setSelection(newSelection);
    }

    showConfigDialog(e) {
        // Quick prompt or reused modal?
        // Let's use a simple prompt for now or trigger the form view config?
        // User asked to "change ... by pressing on the text".
        // Let's scroll FormView config into view?
        const configPanel = document.querySelector('.matrix-config-panel');
        if (configPanel) {
            configPanel.scrollIntoView({ behavior: 'smooth' });
            configPanel.style.border = '1px solid var(--primary-color)';
            setTimeout(() => configPanel.style.border = '', 1000);
        }
    }

    updateSelectionHighlight() {
        // Re-rendering entire matrix might be heavy, but easiest for now to update 'selected' class logic
        // Optimization: iterate cells and check
        this.render();
    }

    updateHoverHighlight() {
        // For matrix, we'll apply hover-match class to cells containing matching items
        // Since cells are re-rendered often, we can do a lightweight update here
        const cells = this.container.querySelectorAll('.matrix-cell');
        cells.forEach(cell => {
            cell.classList.remove('hover-match');
        });

        if (!store.hoverFilter || !this.gridData) return;

        const { property, value } = store.hoverFilter;

        // Iterate through grid and mark cells
        this.rowLabels.forEach((rLabel, rIdx) => {
            this.finalCols.forEach((cLabel, cIdx) => {
                const items = (this.gridData[rLabel] && this.gridData[rLabel][cLabel]) || [];
                const hasMatch = items.some(item => item[property] == value);

                if (hasMatch) {
                    // Find the cell by its data attributes
                    const cell = this.container.querySelector(`.matrix-cell[data-r="${rIdx}"][data-c="${cIdx}"]`);
                    if (cell) {
                        cell.classList.add('hover-match');
                    }
                }
            });
        });
    }

    getShapeName(val) {
        if (!val) return 'block';
        const s = String(val).toLowerCase();
        if (s.includes('block')) return 'block';
        if (s.includes('circle')) return 'circle';
        if (s.includes('diamond')) return 'diamond';
        if (s.includes('triangle-up') || s.includes('triangle up') || s === 'up') return 'triangle-up';
        if (s.includes('triangle-down') || s.includes('triangle down') || s === 'down') return 'triangle-down';
        if (s.includes('triangle-left') || s.includes('triangle left')) return 'triangle-left';
        if (s.includes('triangle-right') || s.includes('triangle right')) return 'triangle-right';

        // Map common categorical values to shapes if user didn't specify
        const shapes = ['block', 'circle', 'diamond', 'triangle-up', 'triangle-down'];
        const hash = String(val).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
        return shapes[Math.abs(hash) % shapes.length];
    }
}
