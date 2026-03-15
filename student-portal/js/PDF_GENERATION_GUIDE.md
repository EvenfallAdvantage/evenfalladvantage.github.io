# PDF Generation Guide
## Using jsPDF and html2canvas for Reports and Certificates

This guide explains how to use the PDF generation system for creating downloadable PDFs from HTML content.

---

## 📚 Libraries Used

- **jsPDF 2.5.1** - PDF document creation
- **html2canvas 1.4.1** - HTML to canvas conversion
- **PDFGenerator utility** - Custom wrapper for common use cases

---

## 🚀 Quick Start

### Basic Usage

```javascript
// Generate PDF from any HTML element
await PDFGenerator.generateFromHTML('#myElement', {
    filename: 'MyDocument.pdf',
    orientation: 'portrait',
    format: 'letter'
});
```

### Assessment Reports

```javascript
// Already implemented in Site Assessments
await PDFGenerator.generateAssessmentReport(clientName, reportElement);
```

### Certificates (Future Implementation)

```javascript
await PDFGenerator.generateCertificate({
    studentName: 'John Doe',
    courseName: 'Security Fundamentals',
    completionDate: '2026-02-06',
    certificateNumber: 'CERT-2026-001',
    instructorName: 'Michael Pino',
    templateElement: document.getElementById('certificateTemplate')
});
```

---

## 🎓 Certificate Generation Template

### HTML Structure

```html
<div id="certificateTemplate" class="certificate-page" style="display: none;">
    <div style="width: 1056px; height: 816px; padding: 60px; background: white; position: relative;">
        <!-- Logo -->
        <img src="../images/logo.png" style="width: 200px; margin: 0 auto; display: block;">
        
        <!-- Title -->
        <h1 style="text-align: center; font-size: 48px; color: #1d3451; margin: 40px 0;">
            Certificate of Completion
        </h1>
        
        <!-- Content -->
        <div style="text-align: center; margin: 40px 0;">
            <p style="font-size: 20px; margin: 20px 0;">This certifies that</p>
            <h2 style="font-size: 36px; color: #dd8c33; margin: 20px 0;" id="cert-student-name">
                [Student Name]
            </h2>
            <p style="font-size: 20px; margin: 20px 0;">has successfully completed</p>
            <h3 style="font-size: 28px; color: #1d3451; margin: 20px 0;" id="cert-course-name">
                [Course Name]
            </h3>
        </div>
        
        <!-- Date and Signatures -->
        <div style="display: flex; justify-content: space-between; margin-top: 80px;">
            <div style="text-align: center;">
                <p id="cert-date" style="font-size: 18px; margin-bottom: 10px;">[Date]</p>
                <div style="border-top: 2px solid #1d3451; width: 200px; margin: 0 auto;"></div>
                <p style="font-size: 14px; margin-top: 10px;">Date</p>
            </div>
            <div style="text-align: center;">
                <p id="cert-instructor" style="font-size: 18px; margin-bottom: 10px;">[Instructor]</p>
                <div style="border-top: 2px solid #1d3451; width: 200px; margin: 0 auto;"></div>
                <p style="font-size: 14px; margin-top: 10px;">Instructor</p>
            </div>
        </div>
        
        <!-- Certificate Number -->
        <p id="cert-number" style="position: absolute; bottom: 20px; right: 20px; font-size: 12px; color: #6c757d;">
            Certificate No: [Number]
        </p>
    </div>
</div>
```

### JavaScript Implementation

```javascript
// Function to generate certificate when student completes course
async function generateCourseCertificate(studentId, courseId) {
    // Fetch student and course data
    const student = await getStudentData(studentId);
    const course = await getCourseData(courseId);
    
    // Populate certificate template
    document.getElementById('cert-student-name').textContent = student.name;
    document.getElementById('cert-course-name').textContent = course.name;
    document.getElementById('cert-date').textContent = new Date().toLocaleDateString();
    document.getElementById('cert-instructor').textContent = course.instructor;
    document.getElementById('cert-number').textContent = `CERT-${Date.now()}`;
    
    // Generate PDF
    await PDFGenerator.generateCertificate({
        studentName: student.name,
        courseName: course.name,
        completionDate: new Date().toISOString().split('T')[0],
        certificateNumber: `CERT-${Date.now()}`,
        instructorName: course.instructor,
        templateElement: document.getElementById('certificateTemplate')
    });
}
```

---

## ⚙️ Configuration Options

### PDFGenerator.generateFromHTML() Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `filename` | string | `Document_[date].pdf` | Output filename |
| `orientation` | string | `'portrait'` | `'portrait'` or `'landscape'` |
| `format` | string | `'letter'` | Page format (`'letter'`, `'a4'`, etc.) |
| `quality` | number | `0.95` | JPEG quality (0-1) |
| `scale` | number | `2` | Rendering scale (higher = better quality) |
| `showLoading` | boolean | `true` | Show loading overlay |
| `showSuccess` | boolean | `true` | Show success notification |
| `pageSelector` | string | `.report-page, .certificate-page, .pdf-page` | CSS selector for pages |
| `onProgress` | function | `null` | Callback: `(current, total) => {}` |

---

## 🎨 Best Practices

### 1. Page Structure
- Use `.report-page`, `.certificate-page`, or `.pdf-page` class for multi-page documents
- Each page should be self-contained
- Set explicit dimensions for certificates (e.g., 1056x816px for landscape letter)

### 2. Styling
- Use inline styles or ensure CSS is loaded before generation
- Avoid complex CSS animations or transitions
- Use web-safe fonts or ensure custom fonts are loaded
- Test with different content lengths

### 3. Images
- Use absolute URLs or data URIs for images
- Ensure images are loaded before PDF generation
- Set explicit width/height to prevent layout shifts
- Use `useCORS: true` for external images

### 4. Performance
- Higher `scale` = better quality but slower generation
- Use `quality: 0.95` for good balance
- Consider showing progress for multi-page documents
- Cache templates when generating multiple similar PDFs

---

## 🔧 Troubleshooting

### Images Not Appearing
```javascript
// Ensure images are loaded
await new Promise(resolve => {
    const images = document.querySelectorAll('#myElement img');
    let loaded = 0;
    images.forEach(img => {
        if (img.complete) loaded++;
        else img.onload = () => { loaded++; if (loaded === images.length) resolve(); };
    });
    if (loaded === images.length) resolve();
});
```

### Text Blurry
```javascript
// Increase scale for sharper text
await PDFGenerator.generateFromHTML(element, {
    scale: 3, // Higher scale = sharper text
    quality: 1.0
});
```

### Layout Issues
```javascript
// Set explicit dimensions
element.style.width = '900px';
element.style.minHeight = '1100px';
```

---

## 📝 Example: Course Completion Certificate System

```javascript
// Add to course completion handler
async function onCourseComplete(studentId, courseId) {
    try {
        // Mark course complete in database
        await markCourseComplete(studentId, courseId);
        
        // Generate certificate
        await generateCourseCertificate(studentId, courseId);
        
        // Show success message
        showNotification('Congratulations! Your certificate has been downloaded.');
        
        // Store certificate record
        await storeCertificateRecord({
            studentId,
            courseId,
            issueDate: new Date(),
            certificateNumber: `CERT-${Date.now()}`
        });
        
    } catch (error) {
        console.error('Certificate generation failed:', error);
        showNotification('Certificate generation failed. Please contact support.');
    }
}
```

---

## 🚀 Future Enhancements

### Batch Certificate Generation
```javascript
// Generate certificates for multiple students
const students = await getCompletedStudents(courseId);
const certificates = students.map(student => ({
    element: populateCertificateTemplate(student),
    options: {
        filename: `${student.name}_Certificate.pdf`,
        showLoading: false,
        showSuccess: false
    }
}));

await PDFGenerator.generateBatch(certificates);
```

### Email Integration
```javascript
// Generate and email certificate
const pdfBlob = await generateCertificateBlob(studentId, courseId);
await emailCertificate(student.email, pdfBlob);
```

### Certificate Verification
```javascript
// Add QR code with verification URL
const qrCode = await generateQRCode(`https://evenfalladvantage.com/verify/${certNumber}`);
document.getElementById('cert-qr').src = qrCode;
```

---

## 📚 Additional Resources

- [jsPDF Documentation](https://github.com/parallax/jsPDF)
- [html2canvas Documentation](https://html2canvas.hertzen.com/)
- [PDF Best Practices](https://www.adobe.com/acrobat/hub/pdf-best-practices.html)

---

**Last Updated:** February 6, 2026
**Maintained By:** Evenfall Advantage Development Team
