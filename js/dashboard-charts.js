/**
 * Dashboard charts and data visualization
 * Using Chart.js for interactive charts
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard charts when the page loads
    initDashboardCharts();
    
    /**
     * Initializes all dashboard charts
     */
    function initDashboardCharts() {
        // Get chart containers
        const contractStatusChartEl = document.getElementById('contract-status-chart');
        const serviceTypeChartEl = document.getElementById('service-type-chart');
        const activityChartEl = document.getElementById('activity-chart');
        
        // Only initialize if the elements exist
        if (contractStatusChartEl) {
            createContractStatusChart(contractStatusChartEl);
        }
        
        if (serviceTypeChartEl) {
            createServiceTypeChart(serviceTypeChartEl);
        }
        
        if (activityChartEl) {
            createActivityChart(activityChartEl);
        }
    }
    
    /**
     * Creates a doughnut chart for contract statuses
     */
    function createContractStatusChart(canvas) {
        // Sample data - in a real app, this would come from your database
        const data = {
            labels: ['Active', 'Pending', 'Completed'],
            datasets: [{
                data: [3, 1, 2],
                backgroundColor: ['#2ecc71', '#f39c12', '#3498db'],
                borderWidth: 0
            }]
        };
        
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 14
                        },
                        padding: 20
                    }
                },
                title: {
                    display: true,
                    text: 'Contract Status Distribution',
                    font: {
                        size: 16
                    }
                }
            },
            cutout: '70%'
        };
        
        new Chart(canvas, {
            type: 'doughnut',
            data: data,
            options: options
        });
    }
    
    /**
     * Creates a bar chart for service types distribution
     */
    function createServiceTypeChart(canvas) {
        // Sample data
        const data = {
            labels: ['Security Consulting', 'Staff Training', 'Emergency Planning', 'Event Security'],
            datasets: [{
                label: 'Number of Contracts',
                data: [2, 2, 1, 1],
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        };
        
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: true,
                    text: 'Services Distribution',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        };
        
        new Chart(canvas, {
            type: 'bar',
            data: data,
            options: options
        });
    }
    
    /**
     * Creates a line chart for activity over time
     */
    function createActivityChart(canvas) {
        // Generate dates for the last 7 days
        const dates = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
        
        // Sample data for document uploads and messages
        const data = {
            labels: dates,
            datasets: [
                {
                    label: 'Document Activity',
                    data: [1, 0, 3, 2, 0, 1, 2],
                    borderColor: '#d59b3c',
                    backgroundColor: 'rgba(213, 155, 60, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Message Activity',
                    data: [2, 3, 1, 0, 2, 4, 3],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        };
        
        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 14
                        },
                        padding: 20
                    }
                },
                title: {
                    display: true,
                    text: 'Activity Over Last 7 Days',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        };
        
        new Chart(canvas, {
            type: 'line',
            data: data,
            options: options
        });
    }
});
