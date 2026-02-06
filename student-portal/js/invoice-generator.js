/**
 * Invoice Generator Tool
 * Professional invoice creation for 1099 contractors
 */

const InvoiceGenerator = {
    currentInvoice: {},
    lineItems: [],
    nextItemId: 1,

    init() {
        console.log('Invoice Generator initialized');
        
        // Set default invoice date to today
        const invoiceDateField = document.getElementById('invoice-date');
        if (invoiceDateField && !invoiceDateField.value) {
            invoiceDateField.value = new Date().toISOString().split('T')[0];
        }
        
        this.loadFromLocalStorage();
        this.attachEventListeners();
        this.updatePreview();
    },

    attachEventListeners() {
        // Add line item button
        const addItemBtn = document.getElementById('add-line-item');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => this.addLineItem());
        }

        // Form inputs - update preview on change
        const formInputs = document.querySelectorAll('.invoice-form input, .invoice-form select, .invoice-form textarea');
        formInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.saveToLocalStorage();
                this.updatePreview();
            });
        });

        // Template selection
        const templateSelect = document.getElementById('invoice-template');
        if (templateSelect) {
            templateSelect.addEventListener('change', () => this.updatePreview());
        }

        // Action buttons
        const saveBtn = document.getElementById('save-invoice');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveInvoice());
        }

        const downloadBtn = document.getElementById('download-invoice');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadPDF());
        }

        const clearBtn = document.getElementById('clear-invoice');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearForm());
        }
    },

    addLineItem(description = '', quantity = 1, rate = 0) {
        const item = {
            id: this.nextItemId++,
            description,
            quantity,
            rate
        };
        this.lineItems.push(item);
        this.renderLineItems();
        this.updatePreview();
        this.saveToLocalStorage();
    },

    removeLineItem(id) {
        this.lineItems = this.lineItems.filter(item => item.id !== id);
        this.renderLineItems();
        this.updatePreview();
        this.saveToLocalStorage();
    },

    updateLineItem(id, field, value) {
        const item = this.lineItems.find(item => item.id === id);
        if (item) {
            item[field] = value;
            this.updatePreview();
            this.saveToLocalStorage();
        }
    },

    renderLineItems() {
        const container = document.getElementById('line-items-container');
        if (!container) return;

        if (this.lineItems.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 2rem;">No line items added. Click "Add Line Item" to get started.</p>';
            return;
        }

        container.innerHTML = this.lineItems.map(item => `
            <div class="line-item" data-id="${item.id}">
                <div class="line-item-field">
                    <label>Description</label>
                    <input type="text" 
                           value="${item.description}" 
                           placeholder="Service description"
                           onchange="InvoiceGenerator.updateLineItem(${item.id}, 'description', this.value)">
                </div>
                <div class="line-item-field">
                    <label>Quantity</label>
                    <input type="number" 
                           value="${item.quantity}" 
                           min="0.01" 
                           step="0.01"
                           onchange="InvoiceGenerator.updateLineItem(${item.id}, 'quantity', parseFloat(this.value))">
                </div>
                <div class="line-item-field">
                    <label>Rate ($)</label>
                    <input type="number" 
                           value="${item.rate}" 
                           min="0" 
                           step="0.01"
                           onchange="InvoiceGenerator.updateLineItem(${item.id}, 'rate', parseFloat(this.value))">
                </div>
                <div class="line-item-field">
                    <label>Amount</label>
                    <div class="line-item-amount">$${(item.quantity * item.rate).toFixed(2)}</div>
                </div>
                <button class="btn-remove-item" onclick="InvoiceGenerator.removeLineItem(${item.id})" title="Remove item">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    },

    calculateTotals() {
        const subtotal = this.lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const taxRate = parseFloat(document.getElementById('tax-rate')?.value || 0) / 100;
        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        return { subtotal, tax, total };
    },

    updatePreview() {
        const preview = document.getElementById('invoice-preview');
        if (!preview) return;

        const template = document.getElementById('invoice-template')?.value || 'professional';
        const totals = this.calculateTotals();

        // Get form data
        const data = {
            // Your info
            yourName: document.getElementById('your-name')?.value || '',
            yourBusiness: document.getElementById('your-business')?.value || '',
            yourAddress: document.getElementById('your-address')?.value || '',
            yourCity: document.getElementById('your-city')?.value || '',
            yourState: document.getElementById('your-state')?.value || '',
            yourZip: document.getElementById('your-zip')?.value || '',
            yourEmail: document.getElementById('your-email')?.value || '',
            yourPhone: document.getElementById('your-phone')?.value || '',
            
            // Client info
            clientName: document.getElementById('client-name')?.value || '',
            clientCompany: document.getElementById('client-company')?.value || '',
            clientAddress: document.getElementById('client-address')?.value || '',
            clientCity: document.getElementById('client-city')?.value || '',
            clientState: document.getElementById('client-state')?.value || '',
            clientZip: document.getElementById('client-zip')?.value || '',
            
            // Invoice details
            invoiceNumber: document.getElementById('invoice-number')?.value || '',
            invoiceDate: document.getElementById('invoice-date')?.value || new Date().toISOString().split('T')[0],
            dueDate: document.getElementById('due-date')?.value || '',
            paymentTerms: document.getElementById('payment-terms')?.value || '',
            notes: document.getElementById('invoice-notes')?.value || '',
            
            // Totals
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            taxRate: parseFloat(document.getElementById('tax-rate')?.value || 0)
        };

        preview.innerHTML = this.generateTemplate(template, data);
    },

    generateTemplate(template, data) {
        const lineItemsHTML = this.lineItems.map(item => `
            <tr>
                <td>${item.description}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right;">$${item.rate.toFixed(2)}</td>
                <td style="text-align: right;">$${(item.quantity * item.rate).toFixed(2)}</td>
            </tr>
        `).join('');

        switch (template) {
            case 'basic':
                return this.generateBasicTemplate(data, lineItemsHTML);
            case 'detailed':
                return this.generateDetailedTemplate(data, lineItemsHTML);
            case 'professional':
            default:
                return this.generateProfessionalTemplate(data, lineItemsHTML);
        }
    },

    generateProfessionalTemplate(data, lineItemsHTML) {
        return `
            <div class="invoice-template professional">
                <div class="invoice-header">
                    <div class="invoice-logo-section">
                        <h1>INVOICE</h1>
                        ${data.yourBusiness ? `<div class="business-name">${data.yourBusiness}</div>` : ''}
                    </div>
                    <div class="invoice-meta">
                        <div class="meta-item">
                            <span class="meta-label">Invoice #:</span>
                            <span class="meta-value">${data.invoiceNumber || 'N/A'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Date:</span>
                            <span class="meta-value">${data.invoiceDate || 'N/A'}</span>
                        </div>
                        <div class="meta-item">
                            <span class="meta-label">Due Date:</span>
                            <span class="meta-value">${data.dueDate || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div class="invoice-parties">
                    <div class="party-section">
                        <h3>From:</h3>
                        <div class="party-details">
                            ${data.yourName ? `<div><strong>${data.yourName}</strong></div>` : ''}
                            ${data.yourAddress ? `<div>${data.yourAddress}</div>` : ''}
                            ${data.yourCity || data.yourState || data.yourZip ? `<div>${data.yourCity}${data.yourCity && data.yourState ? ', ' : ''}${data.yourState} ${data.yourZip}</div>` : ''}
                            ${data.yourEmail ? `<div>${data.yourEmail}</div>` : ''}
                            ${data.yourPhone ? `<div>${data.yourPhone}</div>` : ''}
                        </div>
                    </div>
                    <div class="party-section">
                        <h3>Bill To:</h3>
                        <div class="party-details">
                            ${data.clientName ? `<div><strong>${data.clientName}</strong></div>` : ''}
                            ${data.clientCompany ? `<div>${data.clientCompany}</div>` : ''}
                            ${data.clientAddress ? `<div>${data.clientAddress}</div>` : ''}
                            ${data.clientCity || data.clientState || data.clientZip ? `<div>${data.clientCity}${data.clientCity && data.clientState ? ', ' : ''}${data.clientState} ${data.clientZip}</div>` : ''}
                        </div>
                    </div>
                </div>

                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align: center; width: 100px;">Quantity</th>
                            <th style="text-align: right; width: 120px;">Rate</th>
                            <th style="text-align: right; width: 120px;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineItemsHTML || '<tr><td colspan="4" style="text-align: center; color: #6c757d;">No line items</td></tr>'}
                    </tbody>
                </table>

                <div class="invoice-totals">
                    <div class="totals-row">
                        <span class="totals-label">Subtotal:</span>
                        <span class="totals-value">$${data.subtotal.toFixed(2)}</span>
                    </div>
                    ${data.taxRate > 0 ? `
                        <div class="totals-row">
                            <span class="totals-label">Tax (${data.taxRate}%):</span>
                            <span class="totals-value">$${data.tax.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="totals-row total">
                        <span class="totals-label">Total Due:</span>
                        <span class="totals-value">$${data.total.toFixed(2)}</span>
                    </div>
                </div>

                ${data.paymentTerms ? `
                    <div class="invoice-section">
                        <h4>Payment Terms</h4>
                        <p>${data.paymentTerms}</p>
                    </div>
                ` : ''}

                ${data.notes ? `
                    <div class="invoice-section">
                        <h4>Notes</h4>
                        <p>${data.notes}</p>
                    </div>
                ` : ''}

                <div class="invoice-footer">
                    <p>Thank you for your business!</p>
                </div>
            </div>
        `;
    },

    generateBasicTemplate(data, lineItemsHTML) {
        return `
            <div class="invoice-template basic">
                <h1>INVOICE</h1>
                <div style="margin-bottom: 2rem;">
                    <strong>Invoice #:</strong> ${data.invoiceNumber || 'N/A'}<br>
                    <strong>Date:</strong> ${data.invoiceDate || 'N/A'}<br>
                    <strong>Due Date:</strong> ${data.dueDate || 'N/A'}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                    <div>
                        <h3>From:</h3>
                        ${data.yourName}<br>
                        ${data.yourAddress}<br>
                        ${data.yourCity}, ${data.yourState} ${data.yourZip}<br>
                        ${data.yourEmail}<br>
                        ${data.yourPhone}
                    </div>
                    <div>
                        <h3>Bill To:</h3>
                        ${data.clientName}<br>
                        ${data.clientCompany}<br>
                        ${data.clientAddress}<br>
                        ${data.clientCity}, ${data.clientState} ${data.clientZip}
                    </div>
                </div>

                <table class="invoice-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lineItemsHTML || '<tr><td colspan="4">No line items</td></tr>'}
                    </tbody>
                </table>

                <div style="text-align: right; margin-top: 2rem;">
                    <div><strong>Subtotal:</strong> $${data.subtotal.toFixed(2)}</div>
                    ${data.taxRate > 0 ? `<div><strong>Tax (${data.taxRate}%):</strong> $${data.tax.toFixed(2)}</div>` : ''}
                    <div style="font-size: 1.5rem; margin-top: 1rem;"><strong>Total:</strong> $${data.total.toFixed(2)}</div>
                </div>
            </div>
        `;
    },

    generateDetailedTemplate(data, lineItemsHTML) {
        return this.generateProfessionalTemplate(data, lineItemsHTML);
    },

    saveInvoice() {
        this.saveToLocalStorage();
        this.showNotification('Invoice saved successfully!', 'success');
    },

    saveToLocalStorage() {
        const invoiceData = {
            lineItems: this.lineItems,
            nextItemId: this.nextItemId,
            formData: this.collectFormData()
        };
        localStorage.setItem('invoice_current', JSON.stringify(invoiceData));
    },

    loadFromLocalStorage() {
        const saved = localStorage.getItem('invoice_current');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.lineItems = data.lineItems || [];
                this.nextItemId = data.nextItemId || 1;
                this.restoreFormData(data.formData);
                this.renderLineItems();
                this.updatePreview();
            } catch (e) {
                console.error('Error loading saved invoice:', e);
            }
        }
    },

    collectFormData() {
        const inputs = document.querySelectorAll('.invoice-form input, .invoice-form select, .invoice-form textarea');
        const data = {};
        inputs.forEach(input => {
            if (input.id) {
                data[input.id] = input.value;
            }
        });
        return data;
    },

    restoreFormData(data) {
        if (!data) return;
        Object.keys(data).forEach(key => {
            const input = document.getElementById(key);
            if (input) {
                input.value = data[key];
            }
        });
    },

    clearForm() {
        if (!confirm('Are you sure you want to clear this invoice? This cannot be undone.')) {
            return;
        }

        this.lineItems = [];
        this.nextItemId = 1;
        
        const inputs = document.querySelectorAll('.invoice-form input, .invoice-form select, .invoice-form textarea');
        inputs.forEach(input => {
            if (input.type === 'date') {
                input.value = new Date().toISOString().split('T')[0];
            } else {
                input.value = '';
            }
        });

        localStorage.removeItem('invoice_current');
        this.renderLineItems();
        this.updatePreview();
        this.showNotification('Invoice cleared', 'info');
    },

    async downloadPDF() {
        const preview = document.getElementById('invoice-preview');
        if (!preview) return;

        try {
            const { jsPDF } = window.jspdf;
            const html2canvas = window.html2canvas;

            if (!jsPDF || !html2canvas) {
                alert('PDF libraries not loaded. Please refresh the page and try again.');
                return;
            }

            this.showNotification('Generating PDF...', 'info');

            const canvas = await html2canvas(preview, {
                scale: 1,
                useCORS: true,
                logging: false,
                windowWidth: preview.scrollWidth,
                windowHeight: preview.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // A4 dimensions in mm
            const pdfWidth = 210;
            const pdfHeight = 297;
            
            // Calculate image dimensions to fit on page with margins
            const margin = 10;
            const maxWidth = pdfWidth - (margin * 2);
            const maxHeight = pdfHeight - (margin * 2);
            
            // Calculate scaled dimensions maintaining aspect ratio
            let imgWidth = (canvas.width * 0.264583); // Convert px to mm (96 DPI)
            let imgHeight = (canvas.height * 0.264583);
            
            // Scale down if too large
            if (imgWidth > maxWidth) {
                const ratio = maxWidth / imgWidth;
                imgWidth = maxWidth;
                imgHeight = imgHeight * ratio;
            }
            
            if (imgHeight > maxHeight) {
                const ratio = maxHeight / imgHeight;
                imgHeight = maxHeight;
                imgWidth = imgWidth * ratio;
            }
            
            // Center on page
            const xOffset = (pdfWidth - imgWidth) / 2;
            const yOffset = margin;
            
            pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
            
            // Add additional pages if content is too tall
            let heightLeft = (canvas.height * 0.264583) - maxHeight;
            let position = -maxHeight;
            
            while (heightLeft > 0) {
                pdf.addPage();
                position -= maxHeight;
                pdf.addImage(imgData, 'PNG', xOffset, position + yOffset, imgWidth, (canvas.height * 0.264583));
                heightLeft -= maxHeight;
            }

            const invoiceNumber = document.getElementById('invoice-number')?.value || 'invoice';
            pdf.save(`Invoice_${invoiceNumber}_${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.showNotification('PDF downloaded successfully!', 'success');
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Error generating PDF. Please try again.');
        }
    },

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#3498db'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            font-weight: 500;
            animation: slideIn 0.3s ease-out;
        `;
        notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${message}`;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('invoice-generator-container')) {
        InvoiceGenerator.init();
    }
});
