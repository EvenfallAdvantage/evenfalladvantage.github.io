/**
 * Form validation script for Evenfall Advantage estimate request forms
 */

document.addEventListener('DOMContentLoaded', function() {
    // Hidden anti-spam field added to each form (see injectHoneypot below).
    const LEAD_HONEYPOT_FIELD = 'company_website';

    // Get all forms
    const forms = document.querySelectorAll('.estimate-form');
    
    forms.forEach(form => {
        injectHoneypot(form);

        // Add submission handler
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Run validation
            if (validateForm(form)) {
                // If validation passes, send the request to the lead intake backend
                handleFormSubmission(form);
            }
        });
        
        // Add input validation on blur for required fields
        const requiredInputs = form.querySelectorAll('input[required], textarea[required], select[required]');
        requiredInputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateField(input);
            });
        });
    });
    
    /**
     * Adds a visually hidden text input that humans never fill in. Bots that
     * auto-complete every field reveal themselves; their submissions are dropped.
     * @param {HTMLFormElement} form
     */
    function injectHoneypot(form) {
        if (form.querySelector(`[name="${LEAD_HONEYPOT_FIELD}"]`)) return;
        const wrap = document.createElement('div');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.style.cssText = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;';
        const input = document.createElement('input');
        input.type = 'text';
        input.name = LEAD_HONEYPOT_FIELD;
        input.tabIndex = -1;
        input.autocomplete = 'off';
        wrap.appendChild(input);
        form.appendChild(wrap);
    }

    /**
     * Validates an individual form field
     * @param {HTMLElement} field - The field to validate
     * @return {boolean} - Whether the field is valid
     */
    function validateField(field) {
        const fieldType = field.type;
        const value = field.value.trim();
        const formGroup = field.closest('.form-group');
        let isValid = true;
        let errorMessage = '';
        
        // Remove any existing error messages
        const existingError = formGroup.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
        formGroup.classList.remove('error');
        
        // Check if field is required and empty
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }
        // Email validation
        else if (fieldType === 'email' && value) {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }
        // Phone validation (basic, allows different formats)
        else if (field.id.includes('phone') && value) {
            const phonePattern = /^[0-9()\-\s\.+]{7,20}$/;
            if (!phonePattern.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid phone number';
            }
        }
        
        // Display error message if invalid
        if (!isValid) {
            formGroup.classList.add('error');
            const errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            errorElement.textContent = errorMessage;
            formGroup.appendChild(errorElement);
        }
        
        return isValid;
    }
    
    /**
     * Validates an entire form
     * @param {HTMLFormElement} form - The form to validate
     * @return {boolean} - Whether the form is valid
     */
    function validateForm(form) {
        const requiredFields = form.querySelectorAll('input[required], textarea[required], select[required]');
        let isFormValid = true;
        
        // Validate all required fields
        requiredFields.forEach(field => {
            if (!validateField(field)) {
                isFormValid = false;
            }
        });
        
        // Checkbox validation - ensure at least one is checked when in a group
        const checkboxGroups = form.querySelectorAll('.checkbox-group');
        checkboxGroups.forEach(group => {
            // Only validate groups that contain at least one required checkbox
            const hasRequiredCheckbox = group.querySelector('input[type="checkbox"][required]');
            if (hasRequiredCheckbox) {
                const checkboxes = group.querySelectorAll('input[type="checkbox"]');
                const isChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);
                
                const formGroup = group.closest('.form-group');
                const existingError = formGroup.querySelector('.error-message');
                if (existingError) {
                    existingError.remove();
                }
                formGroup.classList.remove('error');
                
                if (!isChecked) {
                    isFormValid = false;
                    formGroup.classList.add('error');
                    const errorElement = document.createElement('div');
                    errorElement.className = 'error-message';
                    errorElement.textContent = 'Please select at least one option';
                    formGroup.appendChild(errorElement);
                }
            }
        });
        
        return isFormValid;
    }
    
    /**
     * Collects form values, preserving multi-select checkbox groups as arrays.
     * @param {HTMLFormElement} form
     * @return {Object}
     */
    function collectFormValues(form) {
        const formValues = {};
        for (const [key, value] of new FormData(form).entries()) {
            if (key === LEAD_HONEYPOT_FIELD) continue;
            if (Object.prototype.hasOwnProperty.call(formValues, key)) {
                if (!Array.isArray(formValues[key])) {
                    formValues[key] = [formValues[key]];
                }
                formValues[key].push(value);
            } else {
                formValues[key] = value;
            }
        }
        return formValues;
    }

    /**
     * Maps a form id to a human-readable service name.
     * (Each form's id is set in forms/*.html.)
     */
    function getFormType(formId) {
        switch (formId) {
            case 'security-consulting-form': return 'Security Consulting';
            case 'training-form': return 'Training & Certification';
            case 'venue-safety-form':
            case 'festival-venue-form': return 'Festival & Venue Safety';
            case 'emergency-planning-form': return 'Emergency Response Planning';
            default: return 'General';
        }
    }

    /** Plain-text summary used by the manual fallback (copy / email link). */
    function buildSummary(formType, formValues) {
        let body = `${formType.toUpperCase()} ESTIMATE REQUEST\n\n`;
        for (const [key, value] of Object.entries(formValues)) {
            if (!value || (Array.isArray(value) && value.length === 0)) continue;
            const fieldName = key.replace(/-/g, ' ').replace(/(^|\s)\S/g, t => t.toUpperCase());
            body += `${fieldName}: ${Array.isArray(value) ? value.join(', ') : value}\n`;
        }
        return body;
    }

    /**
     * Builds the JSON payload for the Overwatch `intake-ingest` edge function.
     * Canonical keys (client_name, client_email, client_phone, service, location,
     * message, start_date, notes) are populated so a company field mapping of
     * key -> same key picks them up; every original field is also sent so
     * nothing is lost (the function stores the full body in raw_payload).
     */
    function buildLeadPayload(formType, formValues) {
        const first = (...keys) => {
            for (const k of keys) {
                const v = formValues[k];
                if (v && !Array.isArray(v) && String(v).trim()) return String(v).trim();
            }
            return undefined;
        };
        const join = v => (Array.isArray(v) ? v.join(', ') : v);
        const fields = {};
        for (const [k, v] of Object.entries(formValues)) fields[k] = join(v);

        return {
            client_name: first('full-name'),
            client_email: first('email'),
            client_phone: first('phone'),
            service: formType,
            location: first('location', 'training-location', 'locations'),
            start_date: first('event-date', 'preferred-date'),
            message: first('description'),
            notes: first('specific-concerns', 'specific-goals', 'additional-info'),
            subject: `${formType} - Estimate Request`,
            organization: first('company', 'organization'),
            source: 'evenfalladvantage.com estimate form',
            page: window.location.pathname,
            ...fields
        };
    }

    /** Returns the configured intake endpoint, or null if not configured. */
    function getLeadConfig() {
        const cfg = window.EVENFALL_LEAD_INTAKE || {};
        if (!cfg.endpoint || !cfg.apiKey) return null;
        return cfg;
    }

    async function postLead(cfg, payload) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const res = await fetch(cfg.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.apiKey}`
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            if (!res.ok) throw new Error(`Lead intake returned ${res.status}`);
            return true;
        } finally {
            clearTimeout(timer);
        }
    }

    function showSuccess(form) {
        const container = form.closest('.form-container') || form.parentElement;
        const success = container.querySelector('.form-success');
        form.style.display = 'none';
        if (success) {
            success.style.display = 'block';
            success.setAttribute('role', 'status');
            success.scrollIntoView({ behavior: 'smooth' });
        }
    }

    /**
     * Shown only when the request could not be delivered automatically
     * (backend not configured, offline, or server error). The visitor keeps
     * their answers and can send them manually; nothing opens on its own.
     */
    function showFallback(form, subject, summary) {
        const container = form.closest('.form-container') || form.parentElement;
        let box = container.querySelector('.form-fallback');
        if (!box) {
            box = document.createElement('div');
            box.className = 'form-fallback error-message';
            box.setAttribute('role', 'alert');
            form.insertAdjacentElement('afterend', box);
        }
        const mailto = `mailto:contact@evenfalladvantage.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
        box.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = 'We could not send your request automatically. Your answers are still in the form. Please try again, or send them to contact@evenfalladvantage.com:';
        const actions = document.createElement('p');
        const emailLink = document.createElement('a');
        emailLink.href = mailto;
        emailLink.textContent = 'Email this request';
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'submit-button';
        copyBtn.style.marginLeft = '1rem';
        copyBtn.textContent = 'Copy details';
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(summary);
                copyBtn.textContent = 'Copied';
            } catch (err) {
                copyBtn.textContent = 'Copy failed';
            }
        });
        actions.appendChild(emailLink);
        actions.appendChild(copyBtn);
        box.appendChild(p);
        box.appendChild(actions);
        box.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Handles form submission: POSTs the lead to the backend without opening
     * the visitor's email client.
     * @param {HTMLFormElement} form - The form being submitted
     */
    async function handleFormSubmission(form) {
        // Simple bot trap: real visitors never see or fill the honeypot.
        const trap = form.querySelector(`[name="${LEAD_HONEYPOT_FIELD}"]`);
        if (trap && trap.value) {
            showSuccess(form);
            return;
        }

        const formType = getFormType(form.id);
        const subject = `${formType} - Estimate Request`;
        const formValues = collectFormValues(form);
        const summary = buildSummary(formType, formValues);
        const submitBtn = form.querySelector('[type="submit"]');
        const originalLabel = submitBtn ? submitBtn.textContent : '';

        const cfg = getLeadConfig();
        if (!cfg) {
            console.warn('[estimate-form] Lead intake not configured (js/lead-config.js); showing manual fallback.');
            showFallback(form, subject, summary);
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }
        try {
            await postLead(cfg, buildLeadPayload(formType, formValues));
            showSuccess(form);
        } catch (err) {
            console.error('[estimate-form] Submission failed:', err);
            showFallback(form, subject, summary);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalLabel;
            }
        }
    }
});
