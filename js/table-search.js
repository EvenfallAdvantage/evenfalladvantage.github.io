/**
 * Table search functionality for dashboard tables
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize search functionality for all tables
    initTableSearch();
    
    /**
     * Sets up search functionality for dashboard tables
     */
    function initTableSearch() {
        setupTableSearch('contracts-table', 'contracts-search');
        setupTableSearch('documents-table', 'documents-search');
    }
    
    /**
     * Sets up search for a specific table
     * @param {string} tableId - ID of the table to search
     * @param {string} searchInputId - ID of the search input field
     */
    function setupTableSearch(tableId, searchInputId) {
        const searchInput = document.getElementById(searchInputId);
        const table = document.getElementById(tableId) || document.querySelector(`.${tableId}`);
        
        if (!searchInput || !table) return;
        
        // Add event listener for input changes
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            searchTable(table, searchTerm);
        });
    }
    
    /**
     * Searches table rows for the search term
     * @param {HTMLElement} table - Table element to search
     * @param {string} searchTerm - Term to search for
     */
    function searchTable(table, searchTerm) {
        const rows = table.querySelectorAll('tbody tr');
        
        if (!rows.length) return;
        
        // Show all rows if search term is empty
        if (!searchTerm) {
            rows.forEach(row => {
                row.style.display = '';
            });
            return;
        }
        
        // Search each row
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            let found = false;
            
            // Check each cell in the row
            cells.forEach(cell => {
                const text = cell.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    found = true;
                }
            });
            
            // Show/hide based on search match
            row.style.display = found ? '' : 'none';
        });
    }
});
