import { store } from '../store.js';

export class FormView {
    constructor(container) {
        this.container = container;
    }

    render() {
        this.container.innerHTML = '';

        // 1. Matrix Configuration Panel (Always visible or collapsible?)
        // Let's put it at the bottom or top.
        this.renderMatrixConfig();

        const selectedrows = store.getSelectedRows();
        if (selectedrows.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'Select items to view properties';
            this.container.appendChild(empty);
            return;
        }

        // Header info
        const info = document.createElement('div');
        info.innerHTML = `<small style="color:var(--text-muted); margin-bottom:12px; display:block;">${selectedrows.length} item(s) selected</small>`;
        this.container.appendChild(info);

        const keys = Object.keys(store.data[0]).filter(k => k !== '_id');

        keys.forEach(key => {
            const group = document.createElement('div');
            group.className = 'form-group';

            // Highlight if active
            if (store.activeCell && store.activeCell.key === key) {
                group.style.borderLeft = '2px solid var(--primary-color)';
                group.style.paddingLeft = '8px';
            }

            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = key;
            group.appendChild(label);

            // Analyze values
            const values = selectedrows.map(r => r[key]);
            // Count frequency
            const freq = {};
            values.forEach(v => freq[v] = (freq[v] || 0) + 1);
            const uniqueValues = Object.keys(freq).sort();

            const input = document.createElement('input');
            input.className = 'form-input';

            // Datalist setup
            const listId = `list-${key}`;
            const dataList = document.createElement('datalist');
            dataList.id = listId;
            const allValues = [...new Set(store.data.map(r => r[key]))].sort();
            allValues.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                dataList.appendChild(opt);
            });
            input.setAttribute('list', listId);
            this.container.appendChild(dataList);

            // --- Drop Zone Logic (Applies to all property inputs) ---
            input.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                input.classList.add('drag-over');
            };

            input.ondragleave = () => {
                input.classList.remove('drag-over');
            };

            input.ondrop = (e) => {
                e.preventDefault();
                input.classList.remove('drag-over');
                const droppedValue = e.dataTransfer.getData('text');
                if (droppedValue !== null && droppedValue !== undefined) {
                    store.updateSelectionMultiple(store.selection, { [key]: droppedValue });
                }
            };

            if (uniqueValues.length === 1) {
                // Single Value Case
                input.value = uniqueValues[0];
                input.onchange = (e) => {
                    store.updateSelectionMultiple(store.selection, { [key]: e.target.value });
                };
                group.appendChild(input);
            } else {
                // Mixed Value Case
                input.placeholder = `(${uniqueValues.length} mixed values) - Type to overwrite all`;
                input.value = '';
                input.onchange = (e) => {
                    // Overwrite ALL
                    if (e.target.value) {
                        store.updateSelectionMultiple(store.selection, { [key]: e.target.value });
                    }
                };
                group.appendChild(input);

                // Render Tags
                const tagContainer = document.createElement('div');
                tagContainer.style.display = 'flex';
                tagContainer.style.flexWrap = 'wrap';
                tagContainer.style.gap = '4px';
                tagContainer.style.marginTop = '4px';

                uniqueValues.forEach(val => {
                    const count = freq[val];
                    const tag = document.createElement('span');
                    tag.className = 'value-tag'; // We need to add css for this
                    tag.style.background = '#333';
                    tag.style.padding = '2px 6px';
                    tag.style.borderRadius = '3px';
                    tag.style.fontSize = '10px';
                    tag.style.cursor = 'grab';
                    tag.style.border = '1px solid transparent';
                    tag.textContent = `${val} (${count})`;
                    tag.draggable = true;

                    // Drag Start Logic
                    tag.addEventListener('dragstart', (evt) => {
                        evt.dataTransfer.setData('text', val);
                        evt.dataTransfer.effectAllowed = 'copy';
                        tag.style.opacity = '0.5';
                    });

                    tag.addEventListener('dragend', () => {
                        tag.style.opacity = '1';
                    });

                    // Hover to highlight matching rows/cells
                    tag.onmouseenter = () => {
                        store.setHoverFilter(key, val);
                    };

                    tag.onmouseleave = () => {
                        store.clearHoverFilter();
                    };

                    // Click to edit specific value
                    tag.onclick = () => {
                        // Replace tag with small input
                        tag.style.display = 'none';
                        const miniInput = document.createElement('input');
                        miniInput.type = 'text';
                        miniInput.value = val;
                        miniInput.style.fontSize = '10px';
                        miniInput.style.width = '60px'; // small

                        miniInput.onblur = () => {
                            const newVal = miniInput.value;
                            if (newVal !== val) {
                                store.updateRowsByValue(store.selection, key, val, newVal);
                            }
                            miniInput.remove();
                            tag.style.display = 'inline-block'; // Will be re-rendered anyway by store update
                        };

                        miniInput.onkeydown = (e) => {
                            if (e.key === 'Enter') miniInput.blur();
                        }

                        tagContainer.insertBefore(miniInput, tag);
                        miniInput.focus();
                    };

                    tagContainer.appendChild(tag);
                });
                group.appendChild(tagContainer);
            }

            this.container.appendChild(group);
        });
    }

    renderMatrixConfig() {
        const wrapper = document.createElement('div');
        wrapper.className = 'matrix-config-panel';
        wrapper.style.marginBottom = '20px';
        wrapper.style.padding = '10px';
        wrapper.style.background = 'var(--bg-header)';
        wrapper.style.borderBottom = '1px solid var(--border-color)';

        wrapper.innerHTML = `<div style="font-weight:600; margin-bottom:12px;">Matrix Options</div>`;

        // Available keys
        const keys = store.data.length ? Object.keys(store.data[0]).filter(k => k !== '_id') : [];

        // 1. Core Layout Fields
        const layoutFields = [
            { label: 'Rows', prop: 'matrixRow' },
            { label: 'Columns', prop: 'matrixCol' },
            { label: 'Labels', prop: 'matrixCellLabel', multiple: true }
        ];

        layoutFields.forEach(f => {
            const row = this.createConfigRow(f.label);
            const select = document.createElement('select');
            select.style.fontSize = '11px';
            select.style.width = '120px';
            if (f.multiple) {
                select.multiple = true;
                select.style.height = '60px';
            }

            keys.forEach(k => {
                const opt = document.createElement('option');
                opt.value = k;
                opt.textContent = k;
                const current = store.config[f.prop];
                if (f.multiple) {
                    if (Array.isArray(current) && current.includes(k)) opt.selected = true;
                    else if (current === k) opt.selected = true;
                } else {
                    if (current === k) opt.selected = true;
                }
                select.appendChild(opt);
            });

            select.onchange = () => {
                store.config[f.prop] = f.multiple ? Array.from(select.selectedOptions).map(o => o.value) : select.value;
                store.save();
                store.emit('dataChanged');
            };
            row.appendChild(select);
            wrapper.appendChild(row);
        });

        // 2. Encoding Fields (Color, Shape, Size)
        const encodings = [
            { label: 'Color', prop: 'matrixCellColor', modeProp: 'matrixCellColorMode', type: 'color' },
            { label: 'Shape', prop: 'matrixCellShape', modeProp: 'matrixCellShapeMode', type: 'shape' },
            { label: 'Size', prop: 'matrixCellSize', modeProp: 'matrixCellSizeMode', type: 'size' }
        ];

        // Master Shape Toggle
        const masterRow = document.createElement('div');
        masterRow.style.display = 'flex';
        masterRow.style.justifyContent = 'space-between';
        masterRow.style.alignItems = 'center';
        masterRow.style.margin = '12px 0';
        masterRow.style.padding = '8px 0';
        masterRow.style.borderTop = '1px solid #333';

        const masterLabel = document.createElement('span');
        masterLabel.textContent = 'Enable Indicators (Shapes)';
        masterLabel.style.fontSize = '12px';
        masterLabel.style.fontWeight = '600';

        const masterCheckbox = document.createElement('input');
        masterCheckbox.type = 'checkbox';
        masterCheckbox.checked = store.config.matrixCellShapeEnabled;
        masterCheckbox.onchange = () => {
            store.config.matrixCellShapeEnabled = masterCheckbox.checked;
            store.save();
            store.emit('dataChanged');
        };

        masterRow.appendChild(masterLabel);
        masterRow.appendChild(masterCheckbox);
        wrapper.appendChild(masterRow);

        encodings.forEach(enc => {
            const isDisabled = !store.config.matrixCellShapeEnabled && (enc.type === 'shape' || enc.type === 'size');

            const section = document.createElement('div');
            section.className = 'encoding-section';
            section.style.marginTop = '12px';
            section.style.paddingTop = '8px';
            section.style.borderTop = '1px solid #333';
            if (isDisabled) {
                section.style.opacity = '0.3';
                section.style.pointerEvents = 'none';
            }

            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.style.marginBottom = '8px';

            const title = document.createElement('span');
            title.textContent = enc.label;
            title.style.fontSize = '12px';
            title.style.fontWeight = '600';

            const modeToggle = document.createElement('div');
            modeToggle.className = 'mode-toggle';
            modeToggle.style.display = 'flex';
            modeToggle.style.background = '#222';
            modeToggle.style.borderRadius = '3px';
            modeToggle.style.overflow = 'hidden';

            ['variable', 'fixed'].forEach(m => {
                const btn = document.createElement('button');
                btn.textContent = m.toUpperCase();
                btn.style.fontSize = '9px';
                btn.style.padding = '2px 6px';
                btn.style.border = 'none';
                btn.style.cursor = 'pointer';
                btn.style.background = store.config[enc.modeProp] === m ? 'var(--primary-color)' : 'transparent';
                btn.style.color = store.config[enc.modeProp] === m ? 'white' : '#888';
                btn.onclick = () => {
                    store.config[enc.modeProp] = m;
                    store.save();
                    store.emit('dataChanged');
                };
                modeToggle.appendChild(btn);
            });

            header.appendChild(title);
            header.appendChild(modeToggle);
            section.appendChild(header);

            // Mode Specific Controls
            const controls = document.createElement('div');
            controls.style.paddingLeft = '8px';

            if (store.config[enc.modeProp] === 'variable') {
                const keySelect = document.createElement('select');
                keySelect.style.fontSize = '11px';
                keySelect.style.width = '100%';
                keySelect.style.marginBottom = '8px';

                ['None', ...keys].forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = k;
                    opt.textContent = k;
                    if (store.config[enc.prop] === k) opt.selected = true;
                    keySelect.appendChild(opt);
                });
                keySelect.onchange = () => {
                    store.config[enc.prop] = keySelect.value;
                    store.save();
                    store.emit('dataChanged');
                };
                controls.appendChild(keySelect);

                // Meta-controls (Linear/Categorical colors)
                if (enc.type === 'color' && store.config.matrixCellColor !== 'None') {
                    const prop = store.config.matrixCellColor;
                    const sampleVal = store.data[0][prop];
                    const isNumeric = !isNaN(parseFloat(sampleVal)) && isFinite(sampleVal);

                    if (isNumeric) {
                        const gradLabel = document.createElement('div');
                        gradLabel.textContent = 'Gradient:';
                        gradLabel.style.fontSize = '10px';
                        gradLabel.style.marginBottom = '4px';
                        controls.appendChild(gradLabel);

                        const startColor = this.createColorPicker(store.config.matrixCellLinearColors.start, (val) => {
                            store.config.matrixCellLinearColors.start = val;
                            store.save();
                            store.emit('dataChanged');
                        });
                        const endColor = this.createColorPicker(store.config.matrixCellLinearColors.end, (val) => {
                            store.config.matrixCellLinearColors.end = val;
                            store.save();
                            store.emit('dataChanged');
                        });

                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.gap = '8px';
                        row.appendChild(startColor);
                        row.appendChild(endColor);
                        controls.appendChild(row);
                    } else {
                        // Categorical Customizer (Color)
                        const catLabel = document.createElement('div');
                        catLabel.textContent = 'Colors (Categorical):';
                        catLabel.style.fontSize = '10px';
                        catLabel.style.marginBottom = '4px';
                        controls.appendChild(catLabel);

                        const counts = {};
                        store.data.forEach(d => {
                            const val = d[prop];
                            counts[val] = (counts[val] || 0) + 1;
                        });

                        const uniqueVals = Object.keys(counts).sort();
                        const colorList = document.createElement('div');
                        colorList.style.maxHeight = '100px';
                        colorList.style.overflowY = 'auto';
                        uniqueVals.forEach(v => {
                            const row = document.createElement('div');
                            row.style.display = 'flex';
                            row.style.alignItems = 'center';
                            row.style.justifyContent = 'space-between';
                            row.style.marginBottom = '2px';
                            row.style.padding = '2px 4px';
                            row.style.borderRadius = '3px';

                            row.onmouseenter = () => store.setHoverFilter(prop, v);
                            row.onmouseleave = () => store.clearHoverFilter();

                            const name = document.createElement('span');
                            name.textContent = `${v} (${counts[v] || 0})`;
                            name.style.fontSize = '10px';
                            name.style.whiteSpace = 'nowrap';
                            name.style.overflow = 'hidden';
                            name.style.textOverflow = 'ellipsis';
                            name.style.maxWidth = '150px';

                            const picker = this.createColorPicker(store.getColor(prop, v), (newColor) => {
                                store.setColorMapping(prop, v, newColor);
                            });

                            row.appendChild(name);
                            row.appendChild(picker);
                            colorList.appendChild(row);
                        });
                        controls.appendChild(colorList);
                    }
                }

                // Shape Customizer (Variable Mode)
                if (enc.type === 'shape' && store.config.matrixCellShape !== 'None') {
                    const prop = store.config.matrixCellShape;
                    const catLabel = document.createElement('div');
                    catLabel.textContent = 'Shapes (Categorical):';
                    catLabel.style.fontSize = '10px';
                    catLabel.style.marginTop = '8px';
                    catLabel.style.marginBottom = '4px';
                    controls.appendChild(catLabel);

                    // Count occurrences
                    const selectedRows = store.getSelectedRows();
                    const targetData = selectedRows.length > 0 ? selectedRows : store.data;
                    const counts = {};
                    targetData.forEach(d => {
                        const val = d[prop];
                        counts[val] = (counts[val] || 0) + 1;
                    });

                    const uniqueVals = [...new Set(store.data.map(d => d[prop]))].sort();
                    const shapeList = document.createElement('div');
                    shapeList.style.maxHeight = '150px';
                    shapeList.style.overflowY = 'auto';
                    uniqueVals.forEach(v => {
                        const row = document.createElement('div');
                        row.style.display = 'flex';
                        row.style.alignItems = 'center';
                        row.style.justifyContent = 'space-between';
                        row.style.marginBottom = '2px';
                        row.style.padding = '2px 4px';
                        row.style.borderRadius = '3px';

                        row.onmouseenter = () => store.setHoverFilter(prop, v);
                        row.onmouseleave = () => store.clearHoverFilter();

                        const name = document.createElement('span');
                        name.textContent = `${v} (${counts[v] || 0})`;
                        name.style.fontSize = '10px';
                        name.style.whiteSpace = 'nowrap';
                        name.style.overflow = 'hidden';
                        name.style.textOverflow = 'ellipsis';
                        name.style.maxWidth = '150px';

                        const select = document.createElement('select');
                        select.className = 'custom-select';
                        select.style.width = '40px';
                        select.style.minWidth = '40px';

                        const currentShape = store.getShape(prop, v);

                        // Button for closed state (Compact - No text)
                        const button = document.createElement('button');
                        button.setAttribute('slot', 'button');
                        button.style.width = '40px';
                        button.style.justifyContent = 'center';
                        button.innerHTML = this.getShapeIconMarkup(currentShape);
                        select.appendChild(button);

                        store.availableShapes.forEach(s => {
                            const opt = this.renderShapeOption(s, currentShape === s);
                            select.appendChild(opt);
                        });
                        select.onchange = () => {
                            store.setShapeMapping(prop, v, select.value);
                            button.innerHTML = this.getShapeIconMarkup(select.value);
                        };

                        row.appendChild(name);
                        row.appendChild(select);
                        shapeList.appendChild(row);
                    });
                    controls.appendChild(shapeList);
                }
            } else {
                // Fixed Mode Controls
                if (enc.type === 'color') {
                    controls.appendChild(this.createColorPicker(store.config.matrixCellStaticValues.color, (val) => {
                        store.config.matrixCellStaticValues.color = val;
                        store.save();
                        store.emit('dataChanged');
                    }));
                } else if (enc.type === 'shape') {
                    const shapes = store.availableShapes;
                    const select = document.createElement('select');
                    select.className = 'custom-select';
                    select.style.width = '40px';
                    select.style.minWidth = '40px';

                    const currentShape = store.config.matrixCellStaticValues.shape;
                    const button = document.createElement('button');
                    button.setAttribute('slot', 'button');
                    button.style.width = '40px';
                    button.style.justifyContent = 'center';
                    button.innerHTML = this.getShapeIconMarkup(currentShape);
                    select.appendChild(button);

                    shapes.forEach(s => {
                        const opt = this.renderShapeOption(s, currentShape === s);
                        select.appendChild(opt);
                    });
                    select.onchange = () => {
                        store.config.matrixCellStaticValues.shape = select.value;
                        button.innerHTML = this.getShapeIconMarkup(select.value);
                        store.save();
                        store.emit('dataChanged');
                    };
                    controls.appendChild(select);
                } else if (enc.type === 'size') {
                    const sliderLabel = document.createElement('div');
                    sliderLabel.textContent = `Side: ${store.config.matrixCellStaticValues.size}px`;
                    sliderLabel.style.fontSize = '10px';

                    const slider = document.createElement('input');
                    slider.type = 'range';
                    slider.min = '4';
                    slider.max = '32';
                    slider.value = store.config.matrixCellStaticValues.size;
                    slider.style.width = '100%';
                    slider.oninput = () => {
                        store.config.matrixCellStaticValues.size = parseInt(slider.value);
                        sliderLabel.textContent = `Side: ${slider.value}px`;
                        store.save();
                        store.emit('dataChanged');
                    };
                    controls.appendChild(sliderLabel);
                    controls.appendChild(slider);
                }
            }

            section.appendChild(controls);
            wrapper.appendChild(section);
        });

        this.container.appendChild(wrapper);
    }

    renderShapeOption(shape, isSelected) {
        const opt = document.createElement('option');
        opt.value = shape;
        if (isSelected) opt.selected = true;

        // Compact Option - Just Icon
        opt.innerHTML = `
            <div class="option-content" style="justify-content: center; width: 100%;">
                ${this.getShapeIconMarkup(shape)}
            </div>
        `;
        return opt;
    }

    getShapeIconMarkup(shape) {
        const iconMap = {
            'block': 'M0,0 H100 V100 H0 Z',
            'circle': 'M50,50 m-50,0 a50,50 0 1,0 100,0 a50,50 0 1,0 -100,0',
            'diamond': 'M50,0 L100,50 L50,100 L0,50 Z',
            'triangle-up': 'M50,0 L0,100 L100,100 Z',
            'triangle-down': 'M0,0 L100,0 L50,100 Z',
            'triangle-left': 'M100,0 L0,50 L100,100 Z',
            'triangle-right': 'M0,0 L100,50 L0,100 Z'
        };

        const path = iconMap[shape] || iconMap['block'];

        return `
            <div class="select-icon-wrapper">
                <svg viewBox="0 0 100 100">
                    <path d="${path}" />
                </svg>
            </div>
        `;
    }

    createConfigRow(labelText) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '6px';
        const lbl = document.createElement('label');
        lbl.textContent = labelText;
        lbl.style.fontSize = '11px';
        row.appendChild(lbl);
        return row;
    }

    createColorPicker(initialValue, onchange) {
        const input = document.createElement('input');
        input.type = 'color';
        input.value = this.rgbToHex(initialValue);
        input.style.width = '30px';
        input.style.height = '20px';
        input.style.padding = '0';
        input.style.border = 'none';
        input.style.background = 'none';
        input.onchange = () => onchange(input.value);
        return input;
    }

    rgbToHex(rgb) {
        if (!rgb) return '#ffffff';
        if (rgb.startsWith('#')) return rgb;
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return '#ffffff';
        const r = parseInt(match[1]);
        const g = parseInt(match[2]);
        const b = parseInt(match[3]);
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
}
