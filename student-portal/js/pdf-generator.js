/**
 * PDF Generator Utility
 * Reusable PDF generation for reports, certificates, and documents
 * Uses jsPDF and html2canvas
 */

const PDFGenerator = {
    /**
     * Generate PDF from HTML element
     * @param {HTMLElement|string} element - DOM element or selector
     * @param {Object} options - Configuration options
     * @returns {Promise} - Resolves when PDF is generated
     */
    async generateFromHTML(element, options = {}) {
        const defaults = {
            filename: `Document_${new Date().toISOString().split('T')[0]}.pdf`,
            orientation: 'portrait',
            format: 'letter',
            quality: 0.95,
            scale: 2,
            showLoading: true,
            showSuccess: true,
            pageSelector: '.report-page, .certificate-page, .pdf-page',
            onProgress: null
        };

        const config = { ...defaults, ...options };
        
        // Get element
        const targetElement = typeof element === 'string' 
            ? document.querySelector(element) 
            : element;
            
        if (!targetElement) {
            throw new Error('Target element not found');
        }

        // Show loading
        let loadingDiv;
        if (config.showLoading) {
            loadingDiv = this.showLoading('Generating PDF...');
        }

        try {
            const { jsPDF } = window.jspdf;
            
            // Create PDF
            const pdf = new jsPDF({
                orientation: config.orientation,
                unit: 'mm',
                format: config.format,
                compress: true
            });

            // Get pages (or use entire element as single page)
            const pages = targetElement.querySelectorAll(config.pageSelector);
            const elements = pages.length > 0 ? Array.from(pages) : [targetElement];

            // Process each page
            for (let i = 0; i < elements.length; i++) {
                if (i > 0) {
                    pdf.addPage();
                }

                // Progress callback
                if (config.onProgress) {
                    config.onProgress(i + 1, elements.length);
                }

                // Capture as canvas
                const canvas = await html2canvas(elements[i], {
                    scale: config.scale,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    windowWidth: elements[i].scrollWidth || 900,
                    onclone: (clonedDoc) => {
                        // Ensure images load properly
                        const imgs = clonedDoc.querySelectorAll('img');
                        imgs.forEach(img => {
                            img.style.maxWidth = '100%';
                            img.style.height = 'auto';
                        });
                    }
                });

                // Calculate dimensions
                const imgWidth = 210; // A4/Letter width in mm
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                const imgData = canvas.toDataURL('image/jpeg', config.quality);

                // Add to PDF
                pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
            }

            // Save PDF
            pdf.save(config.filename);

            // Hide loading
            if (loadingDiv) {
                document.body.removeChild(loadingDiv);
            }

            // Show success
            if (config.showSuccess) {
                this.showSuccess('PDF downloaded successfully!');
            }

            return pdf;

        } catch (error) {
            if (loadingDiv) {
                document.body.removeChild(loadingDiv);
            }
            this.showError('Error generating PDF. Please try again.');
            throw error;
        }
    },

    /**
     * Generate certificate PDF
     * @param {Object} certificateData - Certificate information
     * @returns {Promise}
     */
    async generateCertificate(certificateData) {
        const {
            studentName,
            courseName,
            completionDate,
            certificateNumber,
            instructorName,
            templateElement
        } = certificateData;

        const filename = `${studentName.replace(/\s+/g, '_')}_${courseName.replace(/\s+/g, '_')}_Certificate.pdf`;

        return this.generateFromHTML(templateElement, {
            filename,
            orientation: 'landscape',
            format: 'letter',
            quality: 1.0,
            scale: 3,
            pageSelector: '.certificate-page'
        });
    },

    /**
     * Generate assessment report PDF
     * @param {string} clientName - Client name for filename
     * @param {HTMLElement} reportElement - Report element
     * @returns {Promise}
     */
    async generateAssessmentReport(clientName, reportElement) {
        const filename = `${clientName.replace(/\s+/g, '_')}_Security_Assessment_${new Date().toISOString().split('T')[0]}.pdf`;

        return this.generateFromHTML(reportElement, {
            filename,
            orientation: 'portrait',
            format: 'letter',
            quality: 0.95,
            scale: 2,
            pageSelector: '.report-page'
        });
    },

    /**
     * Show loading indicator
     * @param {string} message - Loading message
     * @returns {HTMLElement} - Loading div element
     */
    showLoading(message = 'Processing...') {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'pdf-loading-overlay';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        loadingDiv.innerHTML = `
            <div style="background: rgba(29, 52, 81, 0.95); color: white; padding: 2rem 3rem; border-radius: 1rem; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; margin-bottom: 1rem; color: #dd8c33;"></i>
                <br>
                <strong style="font-size: 1.2rem;">${message}</strong>
                <br>
                <small style="opacity: 0.8;">This may take a moment</small>
            </div>
        `;
        
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    },

    /**
     * Show success message
     * @param {string} message - Success message
     */
    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'pdf-success-notification';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            animation: slideIn 0.3s ease;
        `;
        
        successDiv.innerHTML = `
            <i class="fas fa-check-circle" style="font-size: 1.5rem;"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(successDiv);
        setTimeout(() => {
            successDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(successDiv), 300);
        }, 3000);
    },

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'pdf-error-notification';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            animation: slideIn 0.3s ease;
        `;
        
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle" style="font-size: 1.5rem;"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(errorDiv);
        setTimeout(() => {
            errorDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(errorDiv), 300);
        }, 4000);
    },

    /**
     * Batch generate multiple PDFs
     * @param {Array} items - Array of {element, options} objects
     * @returns {Promise}
     */
    async generateBatch(items) {
        const results = [];
        
        for (let i = 0; i < items.length; i++) {
            const { element, options } = items[i];
            try {
                const pdf = await this.generateFromHTML(element, {
                    ...options,
                    showLoading: i === 0,
                    showSuccess: i === items.length - 1
                });
                results.push({ success: true, pdf });
            } catch (error) {
                results.push({ success: false, error });
            }
        }
        
        return results;
    }
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Export for use in other modules
window.PDFGenerator = PDFGenerator;
