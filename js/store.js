/**
 * Store.js
 * Central State Management
 */

class Store {
    constructor() {
        this.data = [];       // Array of row objects
        this.selection = new Set(); // Set of row IDs
        this.listeners = new Set();
        this.clipboard = [];  // Clipboard buffer for copy/paste
        this.hoverFilter = null; // {property, value} for hover highlighting

        // Matrix Configuration
        this.config = {
            matrixRow: 'Origin',
            matrixCol: 'Arrive',
            matrixCellLabel: 'Delay',
            matrixCellColor: 'Type',
            matrixCellShape: 'None',
            matrixCellSize: 'None',

            matrixCellShapeEnabled: true,

            // Advanced Customization Modes
            matrixCellColorMode: 'variable', // 'variable' or 'fixed'
            matrixCellShapeMode: 'variable',
            matrixCellSizeMode: 'variable',

            matrixCellStaticValues: {
                color: '#1f77b4',
                shape: 'block',
                size: 8
            },

            matrixCellLinearColors: {
                start: '#ffffff',
                end: '#1f77b4'
            },

            hiddenCols: []
        };

        this.colorMaps = {}; // { propertyName: { value: color } }
        this.shapeMaps = {}; // { propertyName: { value: shape } }
        this.d3Palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];
        this.availableShapes = ['block', 'circle', 'diamond', 'triangle-up', 'triangle-down', 'triangle-left', 'triangle-right'];

        this.init();
    }

    init() {
        // Load from LocalStorage
        const savedData = localStorage.getItem('synData');
        const savedConfig = localStorage.getItem('synConfig');

        if (savedData) {
            try {
                this.data = JSON.parse(savedData);
                console.log('Loaded data from storage:', this.data.length, 'rows');
            } catch (e) {
                console.error('Failed to load data', e);
                this.loadDefaultData();
            }
        } else {
            this.loadDefaultData();
        }

        if (savedConfig) {
            try {
                this.config = { ...this.config, ...JSON.parse(savedConfig) };
            } catch (e) { console.error(e); }
        }

        const savedColorMaps = localStorage.getItem('synColorMaps');
        if (savedColorMaps) {
            try {
                this.colorMaps = JSON.parse(savedColorMaps);
            } catch (e) { console.error(e); }
        }

        const savedShapeMaps = localStorage.getItem('synShapeMaps');
        if (savedShapeMaps) {
            try {
                this.shapeMaps = JSON.parse(savedShapeMaps);
            } catch (e) { console.error(e); }
        }
    }

    // Default Data from User Request
    loadDefaultData() {
        // Raw TSV style string
        const raw = `Origin	Arrive	transportCode	Type	Service	Delay	DelaySeconds	platform
Frankfurt (M) Hbf	17:29	ICE	ICE International	124	07:53	473	7a
Frankfurt (M) Hbf	15:29	ICE	ICE International	126	-	0	7a
Düsseldorf Hbf	13:29	ICE	ICE International	128	05:13	313	2b
Osnabrück Hbf	16:49	IC	Intercity	146	-	0	14b
Osnabrück Hbf	15:00	IC	Intercity	148	01:48	108	13b
Frankfurt (M) Hbf	11:29	ICE	ICE International	220	-	0	7a
Köln Hbf	09:29	ICE	ICE International	222	-	0	7b
Osnabrück Hbf	13:00	IC	Intercity	240	15:39	939	14a
Hannover Hbf	11:00	IC	Intercity	242	53:51	3231	15b
Frankfurt (M) Hbf	09:13	NJ	Nightjet	402	-	0	10
Nürnberg Hbf	09:59	NJ	Nightjet	420	-	0	10a
Maastricht	09:55	IC	Intercity	826	-	0	5b
Maastricht	10:25	IC	Intercity	828	19	19	5b
Maastricht	10:55	IC	Intercity	830	59	59	5
Maastricht	11:25	IC	Intercity	832	-	0	5
Maastricht	12:25	IC	Intercity	836	30	30	5b
Maastricht	12:55	IC	Intercity	838	-	0	7b
Maastricht	13:25	IC	Intercity	840	1	1	5b
Maastricht	13:55	IC	Intercity	842	02:41	161	5b
Maastricht	14:25	IC	Intercity	844	4	4	5b
Maastricht	14:55	IC	Intercity	846	-	0	5`;

        this.importData(raw);
    }

    importData(rawString) {
        const rows = rawString.trim().split('\n');
        if (rows.length < 2) return;

        const headers = rows[0].split(/\t|,/).map(h => h.trim().replace(/^¤/, ''));
        const newData = [];

        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(/\t|,/);
            const obj = { _id: crypto.randomUUID() };

            headers.forEach((h, idx) => {
                let val = cols[idx] ? cols[idx].trim().replace(/^¤/, '') : '';
                // Simple auto-typing (can be improved)
                if (val !== '' && !isNaN(Number(val))) {
                    // Keep as string if it looks like platform '7a', but parse if pure number
                    // Actually user said 'DelaySeconds' is integer, 'platform' is string.
                    // We will do a generic check: check entire column later? Or per cell?
                    // For now, let's keep it simple: if it parses as number, store as number ONLY if it is not a mixed col.
                    // But row-based parsing doesn't know about other rows.
                    // Let's just try to parse numbers if they look like numbers and aren't obviously IDs or codes mixed with letters
                    if (/^-?\d+(\.\d+)?$/.test(val)) {
                        val = Number(val);
                    }
                }
                obj[h] = val;
            });
            newData.push(obj);
        }

        this.data = newData;
        this.save();
        this.emit('dataChanged');
    }

    // --- Actions ---

    setData(newData) {
        this.data = newData;
        this.save();
        this.emit('dataChanged');
    }

    updateRow(id, field, value) {
        const row = this.data.find(r => r._id === id);
        if (row) {
            row[field] = value;
            this.save();
            this.emit('dataChanged');
        }
    }

    updateSelectionMultiple(ids, valueMap) {
        // valueMap = { 'TransportCode': 'ICE', 'Delay': 0 }
        this.data.forEach(row => {
            if (ids.has(row._id)) {
                Object.assign(row, valueMap);
            }
        });
        this.save();
        this.emit('dataChanged');
    }

    // New: Update specific subset where field == matchValue (for Tag editing)
    updateRowsByValue(ids, field, matchValue, newValue) {
        this.data.forEach(row => {
            if (ids.has(row._id) && row[field] === matchValue) {
                row[field] = newValue;
            }
        });
        this.save();
        this.emit('dataChanged');
    }

    // --- Selection ---

    select(id, multi = false) {
        if (!multi) this.selection.clear();
        this.selection.add(id);
        this.emit('selectionChanged');
    }

    deselect(id) {
        this.selection.delete(id);
        this.emit('selectionChanged');
    }

    toggleSelect(id) {
        if (this.selection.has(id)) this.selection.delete(id);
        else this.selection.add(id);
        this.emit('selectionChanged');
    }

    selectRange(ids, additive = false) {
        if (!additive) this.selection.clear();
        ids.forEach(id => this.selection.add(id));
        this.emit('selectionChanged');
    }

    setSelection(ids) {
        this.selection = new Set(ids);
        this.emit('selectionChanged');
    }

    clearSelection() {
        this.selection.clear();
        this.emit('selectionChanged');
    }

    clearSelection() {
        this.selection.clear();
        this.emit('selectionChanged');
    }

    // --- Copy/Paste ---

    copySelection() {
        const selectedRows = this.getSelectedRows();
        if (selectedRows.length === 0) {
            console.log('No rows selected to copy');
            return;
        }
        // Store deep copies without _id (will be regenerated on paste)
        this.clipboard = selectedRows.map(row => {
            const { _id, ...rest } = row;
            return { ...rest };
        });
        console.log(`Copied ${this.clipboard.length} row(s)`);
    }

    pasteSelection() {
        if (this.clipboard.length === 0) {
            console.log('Clipboard is empty');
            return;
        }

        // Create new rows with new IDs
        const newRows = this.clipboard.map(rowData => ({
            _id: crypto.randomUUID(),
            ...rowData
        }));

        // Add to data
        this.data.push(...newRows);

        // Select the newly pasted rows
        this.selection.clear();
        newRows.forEach(row => this.selection.add(row._id));

        this.save();
        this.emit('dataChanged');
        console.log(`Pasted ${newRows.length} row(s)`);
    }

    deleteSelection() {
        if (this.selection.size === 0) {
            console.log('No rows selected to delete');
            return;
        }

        const count = this.selection.size;
        // Filter out selected rows
        this.data = this.data.filter(row => !this.selection.has(row._id));

        // Clear selection
        this.selection.clear();

        this.save();
        this.emit('dataChanged');
        console.log(`Deleted ${count} row(s)`);
    }

    // --- Hover Filter ---

    setHoverFilter(property, value) {
        this.hoverFilter = { property, value };
        this.emit('hoverChanged');
    }

    clearHoverFilter() {
        this.hoverFilter = null;
        this.emit('hoverChanged');
    }

    // --- Active Cell (Focus) ---
    setActiveCell(rowId, key) {
        this.activeCell = { rowId, key };
        this.emit('activeCellChanged', this.activeCell);
    }

    getSelectedRows() {
        return this.data.filter(r => this.selection.has(r._id));
    }

    // --- Visualization Helpers ---

    getColor(property, value) {
        if (this.config.matrixCellColorMode === 'fixed') {
            return this.config.matrixCellStaticValues.color;
        }

        if (!property || value === undefined || value === null) return 'var(--text-muted)';

        // Check if property is numeric for Linear Mapping
        const isNumeric = !isNaN(parseFloat(value)) && isFinite(value);

        if (isNumeric) {
            // Linear Mapping
            const vals = this.data.map(d => parseFloat(d[property])).filter(v => !isNaN(v));
            if (vals.length === 0) return 'var(--text-muted)';
            const min = Math.min(...vals);
            const max = Math.max(...vals);
            const t = max === min ? 0.5 : (parseFloat(value) - min) / (max - min);
            return this.interpolateColor(this.config.matrixCellLinearColors.start, this.config.matrixCellLinearColors.end, t);
        }

        // Categorical Mapping
        if (!this.colorMaps[property]) this.colorMaps[property] = {};

        if (this.colorMaps[property][value]) {
            return this.colorMaps[property][value];
        }

        // Assign from D3 Palette based on hash
        const values = [...new Set(this.data.map(r => r[property]))].sort();
        const idx = values.indexOf(value);
        const color = this.d3Palette[idx % this.d3Palette.length];

        this.colorMaps[property][value] = color;
        this.save();
        return color;
    }

    interpolateColor(color1, color2, t) {
        // Simple hex/rgb interpolation
        const parse = (c) => {
            if (c.startsWith('#')) {
                const r = parseInt(c.slice(1, 3), 16);
                const g = parseInt(c.slice(3, 5), 16);
                const b = parseInt(c.slice(5, 7), 16);
                return [r, g, b];
            }
            return [0, 0, 0];
        };
        const c1 = parse(color1);
        const c2 = parse(color2);
        const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
        const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
        const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
        return `rgb(${r},${g},${b})`;
    }

    setColorMapping(property, value, color) {
        if (!this.colorMaps[property]) this.colorMaps[property] = {};
        this.colorMaps[property][value] = color;
        this.save();
        this.emit('dataChanged');
    }

    getShape(property, value) {
        if (this.config.matrixCellShapeMode === 'fixed') {
            return this.config.matrixCellStaticValues.shape;
        }

        if (!property || value === undefined || value === null) return 'block';

        if (!this.shapeMaps[property]) this.shapeMaps[property] = {};

        if (this.shapeMaps[property][value]) {
            return this.shapeMaps[property][value];
        }

        // Default: Assign based on hash
        const values = [...new Set(this.data.map(r => r[property]))].sort();
        const idx = values.indexOf(value);
        const shape = this.availableShapes[idx % this.availableShapes.length];

        this.shapeMaps[property][value] = shape;
        this.save();
        return shape;
    }

    setShapeMapping(property, value, shape) {
        if (!this.shapeMaps[property]) this.shapeMaps[property] = {};
        this.shapeMaps[property][value] = shape;
        this.save();
        this.emit('dataChanged');
    }

    // --- Persistence ---

    save() {
        localStorage.setItem('synData', JSON.stringify(this.data));
        localStorage.setItem('synConfig', JSON.stringify(this.config));
        localStorage.setItem('synColorMaps', JSON.stringify(this.colorMaps));
        localStorage.setItem('synShapeMaps', JSON.stringify(this.shapeMaps));
    }

    // --- Pub/Sub ---

    subscribe(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    emit(event, payload) {
        this.listeners.forEach(fn => fn(event, payload));
    }
}

export const store = new Store();
window.store = store; // For debugging
