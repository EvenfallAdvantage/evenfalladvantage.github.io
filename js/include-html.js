document.addEventListener('DOMContentLoaded', function() {
    // Load header
    const headerPlaceholder = document.querySelector('#header-placeholder');
    if (headerPlaceholder) {
        fetch('/includes/header.html')
            .then(response => response.text())
            .then(data => {
                headerPlaceholder.innerHTML = data;
                setActiveNavLink();
                initMobileNav();
            })
            .catch(error => console.error('Error loading header:', error));
    }

    // Load footer
    const footerPlaceholder = document.querySelector('#footer-placeholder');
    if (footerPlaceholder) {
        fetch('/includes/footer.html')
            .then(response => response.text())
            .then(data => {
                footerPlaceholder.innerHTML = data;
                setActiveNavLink();
            })
            .catch(error => console.error('Error loading footer:', error));
    }

    // Set active navigation link based on current page
    function setActiveNavLink() {
        const path = window.location.pathname;
        const page = path.split('/').pop();
        
        const navHomeElements = document.querySelectorAll('#nav-home');
        const navBlogElements = document.querySelectorAll('#nav-blog');
        const navAboutElements = document.querySelectorAll('#nav-about');
        const navLoginElements = document.querySelectorAll('#nav-login');
        
        const footerNavHomeElements = document.querySelectorAll('#footer-nav-home');
        const footerNavBlogElements = document.querySelectorAll('#footer-nav-blog');
        const footerNavAboutElements = document.querySelectorAll('#footer-nav-about');
        const footerNavLoginElements = document.querySelectorAll('#footer-nav-login');
        
        // Add active class to appropriate navigation elements
        if (path === '/' || page === 'index.html' || path.endsWith('/')) {
            navHomeElements.forEach(el => el.classList.add('active'));
            footerNavHomeElements.forEach(el => el.classList.add('active'));
        } else if (page === 'blog.html' || path.includes('case-studies')) {
            navBlogElements.forEach(el => el.classList.add('active'));
            footerNavBlogElements.forEach(el => el.classList.add('active'));
        } else if (page === 'about.html') {
            navAboutElements.forEach(el => el.classList.add('active'));
            footerNavAboutElements.forEach(el => el.classList.add('active'));
        } else if (page === 'login.html' || page === 'register.html' || page === 'dashboard.html') {
            navLoginElements.forEach(el => el.classList.add('active'));
            footerNavLoginElements.forEach(el => el.classList.add('active'));
        }
    }
});


function initMobileNav() {
    const toggle = document.getElementById('nav-toggle');
    const nav = document.getElementById('primary-nav');
    if (!toggle || !nav || toggle.dataset.bound === '1') return;
    toggle.dataset.bound = '1';

    const setOpen = (open) => {
        document.body.classList.toggle('nav-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setOpen(false);
    });
    window.addEventListener('resize', () => {
        if (window.matchMedia('(min-width: 769px)').matches) setOpen(false);
    });
}
