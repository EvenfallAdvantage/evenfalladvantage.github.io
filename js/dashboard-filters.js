/**
 * Dashboard filters functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize contract filters
    initContractFilters();
    
    /**
     * Sets up contract table filters
     */
    function initContractFilters() {
        const statusFilter = document.getElementById('contract-status-filter');
        const typeFilter = document.getElementById('contract-type-filter');
        
        if (statusFilter && typeFilter) {
            // Initial filtering
            filterContracts();
            
            // Add event listeners
            statusFilter.addEventListener('change', filterContracts);
            typeFilter.addEventListener('change', filterContracts);
        }
    }
    
    /**
     * Filters contracts based on selected status and type
     */
    function filterContracts() {
        const statusFilter = document.getElementById('contract-status-filter');
        const typeFilter = document.getElementById('contract-type-filter');
        const rows = document.querySelectorAll('.contracts-table tbody tr');
        
        if (!rows.length) return;
        
        const selectedStatus = statusFilter.value;
        const selectedType = typeFilter.value;
        
        rows.forEach(row => {
            const statusCell = row.querySelector('td:nth-child(5) .status');
            const typeCell = row.querySelector('td:nth-child(2)');
            
            if (!statusCell || !typeCell) return;
            
            const status = statusCell.classList.contains('active') ? 'active' : 
                          statusCell.classList.contains('pending') ? 'pending' : 
                          statusCell.classList.contains('completed') ? 'completed' : '';
            
            const type = typeCell.textContent.toLowerCase();
            
            const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
            const matchesType = selectedType === 'all' || 
                              (selectedType === 'security' && type.includes('security')) ||
                              (selectedType === 'training' && type.includes('training')) ||
                              (selectedType === 'emergency' && type.includes('emergency'));
            
            // Show row only if it matches both filters
            row.style.display = (matchesStatus && matchesType) ? '' : 'none';
        });
    }
});
