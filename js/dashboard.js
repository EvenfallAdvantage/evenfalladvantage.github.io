/**
 * Dashboard page functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    requireAuth();
    
    // Get current user data
    const userData = getCurrentUser();
    
    // Initialize dashboard elements
    initDashboard(userData);
    
    // Initialize tab navigation
    initTabs();
    
    // Initialize document upload functionality
    initDocumentUpload();
    
    // Initialize table actions
    initTableActions();
    
    // Initialize logout button
    initLogout();
    
    // Helper functions
    function initDashboard(user) {
        // Set user welcome message
        const welcomeText = document.querySelector('.welcome-text');
        const companyName = document.querySelector('.company-name');
        
        if (welcomeText && user) {
            const nameElement = welcomeText.querySelector('strong') || document.createElement('strong');
            nameElement.textContent = `${user.firstName} ${user.lastName}`;
            
            // If strong element wasn't already present, append it
            if (!welcomeText.querySelector('strong')) {
                welcomeText.textContent = 'Welcome, ';
                welcomeText.appendChild(nameElement);
            }
        }
        
        if (companyName && user) {
            companyName.textContent = user.companyName || '';
        }
        
        // Populate dashboard data
        populateDashboard(user);
    }
    
    function populateDashboard(user) {
        // Populate sample data for cards
        const cardCounts = {
            'active-contracts': 3,
            'documents': 8,
            'tasks': 5,
            'events': 2
        };
        
        // Update card counts
        for (const [id, count] of Object.entries(cardCounts)) {
            const cardElement = document.querySelector(`#${id} .card-number`);
            if (cardElement) {
                cardElement.textContent = count;
            }
        }
        
        // Populate contracts table
        const contractsTableBody = document.querySelector('#contracts-table tbody');
        if (contractsTableBody) {
            contractsTableBody.innerHTML = getSampleContractsHTML();
        }
        
        // Populate documents table
        const documentsTableBody = document.querySelector('#documents-table tbody');
        if (documentsTableBody) {
            documentsTableBody.innerHTML = getSampleDocumentsHTML();
        }
        
        // Populate recent activity
        const activityList = document.querySelector('.activity-list');
        if (activityList) {
            activityList.innerHTML = getSampleActivityHTML();
        }
        
        // Populate upcoming events
        const eventCards = document.querySelector('.event-cards');
        if (eventCards) {
            eventCards.innerHTML = getSampleEventsHTML();
        }
        
        // Populate profile data
        populateProfileData(user);
    }
    
    function populateProfileData(user) {
        if (!user) return;
        
        // Profile info fields
        const profileFields = {
            'profile-name': `${user.firstName} ${user.lastName}`,
            'profile-email': user.email,
            'profile-phone': user.phone,
            'profile-company': user.companyName,
            'profile-job-title': user.jobTitle,
            
            // Form fields
            'profile-first-name': user.firstName,
            'profile-last-name': user.lastName,
            'profile-email-input': user.email,
            'profile-phone-input': user.phone,
            'profile-company-input': user.companyName,
            'profile-job-input': user.jobTitle,
            'profile-address': user.address,
            'profile-city': user.city,
            'profile-state': user.state,
            'profile-zip': user.zip
        };
        
        // Set field values
        for (const [id, value] of Object.entries(profileFields)) {
            const element = document.getElementById(id);
            if (element) {
                if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                    element.value = value || '';
                } else {
                    element.textContent = value || '';
                }
            }
        }
        
        // Set industry select
        const industrySelect = document.getElementById('profile-industry');
        if (industrySelect && user.industry) {
            for (const option of industrySelect.options) {
                if (option.value === user.industry) {
                    option.selected = true;
                    break;
                }
            }
        }
        
        // Set company size select
        const sizeSelect = document.getElementById('profile-size');
        if (sizeSelect && user.companySize) {
            for (const option of sizeSelect.options) {
                if (option.value === user.companySize) {
                    option.selected = true;
                    break;
                }
            }
        }
    }
    
    function initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Get the tab to activate
                const tabId = this.getAttribute('data-tab');
                
                // Deactivate all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Activate the selected tab
                this.classList.add('active');
                document.getElementById(`${tabId}-content`).classList.add('active');
            });
        });
    }
    
    function initDocumentUpload() {
        const uploadButton = document.querySelector('.upload-button');
        const uploadArea = document.getElementById('document-upload-area');
        const cancelUpload = document.querySelector('.cancel-upload');
        const dropzone = document.querySelector('.upload-dropzone');
        const browseLink = document.querySelector('.browse-link');
        const fileInput = document.getElementById('file-upload');
        const uploadForm = document.querySelector('.upload-form');
        const submitButton = document.querySelector('.submit-upload');
        
        // Show/hide upload area
        if (uploadButton && uploadArea) {
            uploadButton.addEventListener('click', function() {
                uploadArea.style.display = 'block';
            });
        }
        
        if (cancelUpload && uploadArea) {
            cancelUpload.addEventListener('click', function() {
                uploadArea.style.display = 'none';
            });
        }
        
        // Browse button functionality
        if (browseLink && fileInput) {
            browseLink.addEventListener('click', function() {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', function() {
                if (this.files.length > 0) {
                    handleFiles(this.files);
                }
            });
        }
        
        // Form submission
        if (uploadForm) {
            uploadForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const fileInput = document.getElementById('file-upload');
                const docType = document.getElementById('document-type').value;
                const description = document.getElementById('document-description').value;
                
                if (!fileInput.files.length) {
                    alert('Please select a file to upload');
                    return;
                }
                
                if (!docType) {
                    alert('Please select a document type');
                    return;
                }
                
                // In a real app, you'd upload the file to a server here
                // For demo purposes, we'll just add it to the table
                addDocumentToTable(fileInput.files[0], docType, description);
                
                // Hide upload area and reset form
                uploadArea.style.display = 'none';
                uploadForm.reset();
            });
        }
        
        // Initialize drag and drop functionality
        if (dropzone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, preventDefaults, false);
            });
            
            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, highlight, false);
            });
            
            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, unhighlight, false);
            });
            
            function highlight() {
                dropzone.classList.add('highlight');
            }
            
            function unhighlight() {
                dropzone.classList.remove('highlight');
            }
            
            dropzone.addEventListener('drop', handleDrop, false);
            
            function handleDrop(e) {
                const dt = e.dataTransfer;
                const files = dt.files;
                
                if (files.length > 0) {
                    handleFiles(files);
                }
            }
            
            // Helper function to handle files from both drop and browse
            function handleFiles(files) {
                // Display file name in the dropzone
                const fileName = files[0].name;
                dropzone.innerHTML = `
                    <i class="fas fa-file"></i>
                    <p><strong>${fileName}</strong> selected</p>
                `;
            }
        }
        
        // Helper function to add a document to the table
        function addDocumentToTable(file, docType, description) {
            const documentsTable = document.querySelector('#documents-table tbody') || document.querySelector('.documents-table tbody');
            
            if (!documentsTable) return;
            
            // Determine file icon based on extension
            let fileIcon = 'fas fa-file';
            const fileExt = file.name.split('.').pop().toLowerCase();
            
            if (['pdf'].includes(fileExt)) {
                fileIcon = 'fas fa-file-pdf';
            } else if (['doc', 'docx'].includes(fileExt)) {
                fileIcon = 'fas fa-file-word';
            } else if (['xls', 'xlsx'].includes(fileExt)) {
                fileIcon = 'fas fa-file-excel';
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(fileExt)) {
                fileIcon = 'fas fa-file-image';
            }
            
            // Format file size
            const fileSizeInMB = (file.size / (1024 * 1024)).toFixed(1);
            
            // Get current date
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            // Create new row HTML
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td>
                    <div class="document-info">
                        <span class="document-icon"><i class="${fileIcon}"></i></span>
                        <span>${file.name}</span>
                    </div>
                </td>
                <td>${docType}</td>
                <td>${dateStr}</td>
                <td>${fileSizeInMB} MB</td>
                <td>
                    <button class="action-button view-action"><i class="fas fa-eye"></i></button>
                    <button class="action-button download-action"><i class="fas fa-download"></i></button>
                    <button class="action-button delete-action"><i class="fas fa-trash"></i></button>
                </td>
            `;
            
            // Add the new row at the top of the table
            documentsTable.insertBefore(newRow, documentsTable.firstChild);
            
            // Show success message
            alert(`File "${file.name}" has been successfully uploaded.`);
        }
        }
        
        // Document category filters
        const categoryButtons = document.querySelectorAll('.category-button');
        
        if (categoryButtons) {
            categoryButtons.forEach(button => {
                button.addEventListener('click', function() {
                    categoryButtons.forEach(btn => btn.classList.remove('active'));
                    this.classList.add('active');
                    
                    // Filter documents based on category
                    filterDocumentsByCategory(this.getAttribute('data-category'));
                });
            });
        }
    }
    
    function initLogout() {
        const logoutButton = document.getElementById('logout-button');
        
        if (logoutButton) {
            logoutButton.addEventListener('click', function(e) {
                e.preventDefault();
                logout(); // This calls the logout function from auth.js
            });
        }
    }

    // Filter documents by category
    function filterDocumentsByCategory(category) {
        const rows = document.querySelectorAll('.documents-table tbody tr');
        
        if (!rows.length) return;
        
        rows.forEach(row => {
            const documentType = row.querySelector('td:nth-child(2)').textContent.toLowerCase();
            
            if (category === 'all') {
                // Show all documents
                row.style.display = '';
            } else if (category === 'site-maps' && (documentType.includes('site map') || documentType.includes('floor plan'))) {
                row.style.display = '';
            } else if (category === 'reports' && documentType.includes('report')) {
                row.style.display = '';
            } else if (category === 'certifications' && documentType.includes('certification')) {
                row.style.display = '';
            } else if (category === 'contracts' && documentType.includes('contract')) {
                row.style.display = '';
            } else {
                // Hide documents that don't match the category
                row.style.display = 'none';
            }
        });
    }

    function initTableActions() {
        // Initialize action buttons for tables
        document.addEventListener('click', function(e) {
            // View button
            if (e.target.classList.contains('view-action') || e.target.closest('.view-action')) {
                alert('Document or contract details would open in a real application.');
            }
            
            // Download button
            if (e.target.classList.contains('download-action') || e.target.closest('.download-action')) {
                alert('Document would download in a real application.');
            }
            
            // Delete button
            if (e.target.classList.contains('delete-action') || e.target.closest('.delete-action')) {
                if (confirm('Are you sure you want to delete this item?')) {
                    alert('Item would be deleted in a real application.');
                }
            }
        });
        
        // Initialize profile save button
        const saveProfileButton = document.querySelector('.save-button');
        
        if (saveProfileButton) {
            saveProfileButton.addEventListener('click', function(e) {
                e.preventDefault();
                alert('Profile changes would be saved in a real application.');
            });
        }
    }
    
    // Sample data functions
    function getSampleContractsHTML() {
        return `
            <tr>
                <td>EA-2025-001</td>
                <td>Annual Security Assessment</td>
                <td>Jan 15, 2025</td>
                <td><span class="status active">Active</span></td>
                <td>
                    <button class="action-button view-action"><i class="fas fa-eye"></i></button>
                    <button class="action-button download-action"><i class="fas fa-download"></i></button>
                </td>
            </tr>
            <tr>
                <td>EA-2025-002</td>
                <td>Staff Training Program</td>
                <td>Feb 10, 2025</td>
                <td><span class="status active">Active</span></td>
                <td>
                    <button class="action-button view-action"><i class="fas fa-eye"></i></button>
                    <button class="action-button download-action"><i class="fas fa-download"></i></button>
                </td>
            </tr>
            <tr>
                <td>EA-2025-003</td>
                <td>Festival Safety Planning</td>
                <td>Mar 22, 2025</td>
                <td><span class="status pending">Pending</span></td>
                <td>
                    <button class="action-button view-action"><i class="fas fa-eye"></i></button>
                    <button class="action-button download-action"><i class="fas fa-download"></i></button>
                </td>
            </tr>
        `;
    }
    
    function getSampleDocumentsHTML() {
        return `
            <tr>
                <td>
                    <div class="document-info">
                        <div class="document-icon"><i class="fas fa-file-pdf"></i></div>
                        <div>Security Assessment Report</div>
                    </div>
                </td>
                <td>PDF Document</td>
                <td>Feb 2, 2025</td>
                <td>
                    <button class="action-button view-action"><i class="fas fa-eye"></i></button>
                    <button class="action-button download-action"><i class="fas fa-download"></i></button>
                    <button class="action-button delete-action"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="document-info">
                        <div class="document-icon"><i class="fas fa-file-word"></i></div>
                        <div>Training Schedule Q2</div>
                    </div>
                </td>
                <td>Word Document</td>
                <td>Feb 15, 2025</td>
                <td>
                    <button class="action-button view-action"><i class="fas fa-eye"></i></button>
                    <button class="action-button download-action"><i class="fas fa-download"></i></button>
                    <button class="action-button delete-action"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
            <tr>
                <td>
                    <div class="document-info">
                        <div class="document-icon"><i class="fas fa-file-image"></i></div>
                        <div>Venue Layout Map</div>
                    </div>
                </td>
                <td>Image</td>
                <td>Mar 5, 2025</td>
                <td>
                    <button class="action-button view-action"><i class="fas fa-eye"></i></button>
                    <button class="action-button download-action"><i class="fas fa-download"></i></button>
                    <button class="action-button delete-action"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }
    
    function getSampleActivityHTML() {
        return `
            <li>
                <div class="activity-icon"><i class="fas fa-file-upload"></i></div>
                <div class="activity-details">
                    <h4 class="activity-title">Document Uploaded</h4>
                    <p class="activity-meta">New safety protocol document added by John Doe</p>
                    <p class="activity-meta">Today at 10:23 AM</p>
                </div>
            </li>
            <li>
                <div class="activity-icon"><i class="fas fa-comment-alt"></i></div>
                <div class="activity-details">
                    <h4 class="activity-title">New Message</h4>
                    <p class="activity-meta">Sarah from Evenfall sent you a message regarding your upcoming training</p>
                    <p class="activity-meta">Yesterday at 2:45 PM</p>
                </div>
            </li>
            <li>
                <div class="activity-icon"><i class="fas fa-file-signature"></i></div>
                <div class="activity-details">
                    <h4 class="activity-title">Contract Updated</h4>
                    <p class="activity-meta">Your annual security assessment contract has been updated</p>
                    <p class="activity-meta">Mar 10, 2025</p>
                </div>
            </li>
        `;
    }
    
    function getSampleEventsHTML() {
        return `
            <div class="event-card">
                <div class="event-date">
                    <span class="event-month">MAR</span>
                    <span class="event-day">25</span>
                </div>
                <div class="event-details">
                    <h4>Staff Security Training</h4>
                    <p>9:00 AM - 4:00 PM</p>
                    <p>Onsite at your headquarters</p>
                </div>
            </div>
            <div class="event-card">
                <div class="event-date">
                    <span class="event-month">APR</span>
                    <span class="event-day">15</span>
                </div>
                <div class="event-details">
                    <h4>Festival Safety Planning Meeting</h4>
                    <p>1:00 PM - 3:00 PM</p>
                    <p>Virtual Meeting</p>
                </div>
            </div>
        `;
    }
});
