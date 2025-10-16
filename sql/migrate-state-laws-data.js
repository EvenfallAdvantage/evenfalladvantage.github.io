// Node.js script to migrate state laws from JavaScript to SQL
// Run with: node migrate-state-laws-data.js > populate-state-laws.sql

const fs = require('fs');
const path = require('path');

// Read the state-laws.js file
const stateLawsPath = path.join(__dirname, '../student-portal/js/state-laws.js');
const content = fs.readFileSync(stateLawsPath, 'utf8');

// Extract the stateLaws object using eval (safe since it's our own code)
const stateLaws = eval('(' + content.match(/const stateLaws = ({[\s\S]*?});/)[1] + ')');

// Generate SQL INSERT statements
console.log('-- Bulk insert all 50 states into state_laws table');
console.log('-- Generated from student-portal/js/state-laws.js');
console.log('-- Run this AFTER creating the state_laws table\n');

const states = Object.keys(stateLaws).sort();

states.forEach(stateCode => {
    const state = stateLaws[stateCode];
    
    // Escape single quotes for SQL
    const escape = (str) => str ? str.replace(/'/g, "''") : '';
    
    const sql = `INSERT INTO state_laws (state_code, state_name, licensing, training_hours, min_age, use_of_force, citizens_arrest, weapons, regulatory_agency, notes)
VALUES (
    '${stateCode}',
    '${escape(state.name)}',
    '${escape(state.licensing)}',
    '${escape(state.trainingHours)}',
    '${escape(state.minAge)}',
    '${escape(state.useOfForce)}',
    '${escape(state.citizensArrest)}',
    '${escape(state.weapons)}',
    '${escape(state.agency)}',
    ${state.notes ? `'${escape(state.notes)}'` : 'NULL'}
)
ON CONFLICT (state_code) DO UPDATE SET
    state_name = EXCLUDED.state_name,
    licensing = EXCLUDED.licensing,
    training_hours = EXCLUDED.training_hours,
    min_age = EXCLUDED.min_age,
    use_of_force = EXCLUDED.use_of_force,
    citizens_arrest = EXCLUDED.citizens_arrest,
    weapons = EXCLUDED.weapons,
    regulatory_agency = EXCLUDED.regulatory_agency,
    notes = EXCLUDED.notes,
    updated_at = NOW();
`;
    
    console.log(sql);
});

console.log('\n-- Verify the migration');
console.log('SELECT state_code, state_name FROM state_laws ORDER BY state_name;');
console.log(`\n-- Total states migrated: ${states.length}`);
