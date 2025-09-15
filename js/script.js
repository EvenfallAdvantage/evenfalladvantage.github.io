// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scroll behavior for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Simple animation for service cards on scroll
    const serviceCards = document.querySelectorAll('.service-card');
    
    // Simple observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });
    
    // Observe each service card
    serviceCards.forEach(card => {
        observer.observe(card);
    });
    
    // Add click events to hashtags
    const hashtags = document.querySelectorAll('.hashtags span');
    hashtags.forEach(tag => {
        tag.addEventListener('click', function() {
            // Could open a search page or filter results
            console.log('Hashtag clicked:', this.textContent);
            
            // Visual feedback
            this.classList.add('hashtag-active');
            
            // Remove the active class after animation completes
            setTimeout(() => {
                this.classList.remove('hashtag-active');
            }, 500);
        });
    });
});

// Add some CSS for the fade-in animation
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .service-card {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.5s ease, transform 0.5s ease;
        }
        
        .service-card.fade-in {
            opacity: 1;
            transform: translateY(0);
        }
        
        .hashtag-active {
            transform: scale(1.1);
            transition: transform 0.3s ease;
        }
    </style>
`);
