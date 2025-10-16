// State Laws Management
let allStates = [];
let currentEditingState = null;

// Load all states on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadStates();
    
    // Setup search
    document.getElementById('searchInput').addEventListener('input', filterStates);
    
    // Setup form submission
    document.getElementById('stateForm').addEventListener('submit', handleFormSubmit);
});

// Check authentication
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '../index.html';
    }
}

// Load all states from database
async function loadStates() {
    try {
        const { data: states, error } = await supabase
            .from('state_laws')
            .select('*')
            .order('state_name');

        if (error) throw error;

        allStates = states || [];
        displayStates(allStates);
    } catch (error) {
        console.error('Error loading states:', error);
        document.getElementById('statesList').innerHTML = '<p class="error">Error loading states. Please try again.</p>';
    }
}

// Display states in grid
function displayStates(states) {
    const container = document.getElementById('statesList');
    
    if (states.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #666;">No states found. Click "Add New State" to get started.</p>';
        return;
    }

    container.innerHTML = states.map(state => `
        <div class="state-card">
            <div class="state-header">
                <h3>${state.state_code} - ${state.state_name}</h3>
                <button class="btn btn-sm btn-primary" onclick="editState('${state.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
            </div>
            <div class="state-info">
                <p><strong>Licensing:</strong> ${truncate(state.licensing, 80)}</p>
                <p><strong>Training:</strong> ${state.training_hours}</p>
                <p><strong>Min Age:</strong> ${state.min_age}</p>
                <p><strong>Agency:</strong> ${truncate(state.regulatory_agency, 60)}</p>
            </div>
        </div>
    `).join('');
}

// Truncate text helper
function truncate(text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

// Filter states by search
function filterStates() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allStates.filter(state => 
        state.state_name.toLowerCase().includes(searchTerm) ||
        state.state_code.toLowerCase().includes(searchTerm)
    );
    displayStates(filtered);
}

// Show add state modal
function showAddStateModal() {
    currentEditingState = null;
    document.getElementById('modalTitle').textContent = 'Add New State';
    document.getElementById('stateForm').reset();
    document.getElementById('stateId').value = '';
    document.getElementById('stateCode').removeAttribute('readonly');
    document.getElementById('editStateModal').style.display = 'flex';
}

// Edit existing state
async function editState(stateId) {
    try {
        const { data: state, error } = await supabase
            .from('state_laws')
            .select('*')
            .eq('id', stateId)
            .single();

        if (error) throw error;

        currentEditingState = state;
        document.getElementById('modalTitle').textContent = `Edit ${state.state_name} Laws`;
        document.getElementById('stateId').value = state.id;
        document.getElementById('stateCode').value = state.state_code;
        document.getElementById('stateCode').setAttribute('readonly', 'readonly');
        document.getElementById('stateName').value = state.state_name;
        document.getElementById('licensing').value = state.licensing;
        document.getElementById('trainingHours').value = state.training_hours;
        document.getElementById('minAge').value = state.min_age;
        document.getElementById('useOfForce').value = state.use_of_force;
        document.getElementById('citizensArrest').value = state.citizens_arrest;
        document.getElementById('weapons').value = state.weapons;
        document.getElementById('agency').value = state.regulatory_agency;
        document.getElementById('notes').value = state.notes || '';

        document.getElementById('editStateModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading state:', error);
        alert('Error loading state details. Please try again.');
    }
}

// Close modal
function closeEditModal() {
    document.getElementById('editStateModal').style.display = 'none';
    currentEditingState = null;
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const stateData = {
        state_code: document.getElementById('stateCode').value.toUpperCase().trim(),
        state_name: document.getElementById('stateName').value.trim(),
        licensing: document.getElementById('licensing').value.trim(),
        training_hours: document.getElementById('trainingHours').value.trim(),
        min_age: document.getElementById('minAge').value.trim(),
        use_of_force: document.getElementById('useOfForce').value.trim(),
        citizens_arrest: document.getElementById('citizensArrest').value.trim(),
        weapons: document.getElementById('weapons').value.trim(),
        regulatory_agency: document.getElementById('agency').value.trim(),
        notes: document.getElementById('notes').value.trim() || null,
        updated_at: new Date().toISOString()
    };

    try {
        const stateId = document.getElementById('stateId').value;

        if (stateId) {
            // Update existing state
            const { error } = await supabase
                .from('state_laws')
                .update(stateData)
                .eq('id', stateId);

            if (error) throw error;
            alert('State laws updated successfully!');
        } else {
            // Insert new state
            const { error } = await supabase
                .from('state_laws')
                .insert([stateData]);

            if (error) throw error;
            alert('State laws added successfully!');
        }

        closeEditModal();
        loadStates();
    } catch (error) {
        console.error('Error saving state:', error);
        alert('Error saving state laws: ' + error.message);
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editStateModal');
    if (event.target === modal) {
        closeEditModal();
    }
}
