/**
 * Unit Manager — loads unit resources CSV and maps units to sprites/stats.
 *
 * Loads: levels/default.resources.txt (or level-specific override)
 * Format: CSV with headers: Unit,StartQty,Health,Attack,DefenseModifier
 *
 * Maps unit names from CSV to sprite names:
 *   "Archer/Crossbowman"         → unit-archer, unit-crossbowman
 *   "Spearman/Heavy infantry"    → unit-spearman, unit-heavy-infantry
 *   "Men-at-arms (heavy trooper)"→ unit-knight
 *   "Engineer/Siege crew"        → unit-engineer
 *   "Militia/Watchmen"           → unit-militia
 */

const UnitManager = {
    units: [],       // parsed unit definitions with stats
    placed: [],      // units placed on the map: { unitDef, row, col }

    /**
     * Load and parse the resources CSV file.
     * Call this after level loading.
     */
    async loadResources(filename) {
        const file = filename || 'levels/default.resources.txt';
        try {
            const text = await loadTextFile(file);
            this.units = this.parseCSV(text);
            console.log(`Units loaded: ${this.units.length} types, ${this.units.reduce((s, u) => s + u.qty, 0)} total`);
        } catch (e) {
            console.warn('Could not load resources file:', e.message);
            this.units = [];
        }
    },

    /**
     * Parse CSV text into unit definitions.
     * Returns array of { name, sprites[], qty, health, attack, defense }
     */
    parseCSV(text) {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        // Skip header row
        const data = lines.slice(1);
        return data.map(line => {
            const [name, qty, health, attack, defense] = line.split(',');
            return {
                name: name.trim(),
                sprites: this.nameToSprites(name.trim()),
                qty: parseInt(qty, 10),
                qtyRemaining: parseInt(qty, 10),
                health: parseInt(health, 10),
                attack: parseInt(attack, 10),
                defense: parseFloat(defense),
            };
        }).filter(u => u.name && !isNaN(u.qty));
    },

    /**
     * Map a CSV unit name to one or more sprite names.
     */
    nameToSprites(name) {
        const lower = name.toLowerCase();
        if (lower.includes('archer') || lower.includes('crossbow')) {
            return ['unit-archer', 'unit-crossbowman'];
        }
        if (lower.includes('spearman') || lower.includes('heavy infantry')) {
            return ['unit-spearman', 'unit-heavy-infantry'];
        }
        if (lower.includes('men-at-arms') || lower.includes('heavy troop') || lower.includes('knight')) {
            return ['unit-knight'];
        }
        if (lower.includes('engineer') || lower.includes('siege')) {
            return ['unit-engineer'];
        }
        if (lower.includes('militia') || lower.includes('watch')) {
            return ['unit-militia'];
        }
        if (lower.includes('artillery') || lower.includes('cannon')) {
            return ['unit-artillery'];
        }
        if (lower.includes('skirmish') || lower.includes('javelin')) {
            return ['unit-skirmisher'];
        }
        // Fallback
        return ['unit-militia'];
    },

    /**
     * Get all available unit types (for HUD display / placement UI).
     */
    getAvailableUnits() {
        return this.units.filter(u => u.qtyRemaining > 0);
    },

    /**
     * Place a unit on the map at (row, col).
     * Returns the placed unit object or null if none available.
     */
    placeUnit(unitName, row, col) {
        const def = this.units.find(u => u.name === unitName && u.qtyRemaining > 0);
        if (!def) return null;

        def.qtyRemaining--;
        const sprite = def.sprites[Math.floor(Math.random() * def.sprites.length)];
        const placed = {
            def,
            sprite,
            row,
            col,
            currentHealth: def.health,
        };
        this.placed.push(placed);
        return placed;
    },

    /**
     * Get all placed units (for rendering).
     */
    getPlacedUnits() {
        return this.placed;
    },

    /**
     * Check if a tile is occupied by a placed unit.
     */
    getUnitAt(row, col) {
        return this.placed.find(u => u.row === row && u.col === col) || null;
    },

    /**
     * Remove a placed unit and restore its quantity.
     */
    removeUnit(unit) {
        const idx = this.placed.indexOf(unit);
        if (idx >= 0) {
            this.placed.splice(idx, 1);
            unit.def.qtyRemaining++;
        }
    },

    /**
     * Reset all placements (e.g., on level restart).
     */
    reset() {
        this.placed = [];
        this.units.forEach(u => { u.qtyRemaining = u.qty; });
    }
};
