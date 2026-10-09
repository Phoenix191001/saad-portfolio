document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Theme Toggle Logic
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const themeIcon = themeToggle.querySelector('i');

    let savedTheme = 'dark';
    try { savedTheme = localStorage.getItem('theme') || 'dark'; } catch (e) { /* storage unavailable */ }
    htmlElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const newTheme = htmlElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        htmlElement.setAttribute('data-theme', newTheme);
        try { localStorage.setItem('theme', newTheme); } catch (e) { /* storage unavailable */ }
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Typing effect for the hero headline
    const typed = document.getElementById('typed');
    if (typed) {
        const words = typed.dataset.words.split('|');
        if (reduceMotion) {
            typed.textContent = words[0];
        } else {
            let w = 0;
            let i = 0;
            let deleting = false;
            const tick = () => {
                const word = words[w];
                i += deleting ? -1 : 1;
                typed.textContent = word.slice(0, i);

                let delay = deleting ? 40 : 80;
                if (!deleting && i === word.length) {
                    deleting = true;
                    delay = 1600;
                } else if (deleting && i === 0) {
                    deleting = false;
                    w = (w + 1) % words.length;
                    delay = 350;
                }
                setTimeout(tick, delay);
            };
            tick();
        }
    }

    // Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });
        revealElements.forEach(el => observer.observe(el));
    } else {
        revealElements.forEach(el => el.classList.add('active'));
    }

    // Smooth scroll for nav links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href === '#') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
                return;
            }
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offsetPosition = target.getBoundingClientRect().top + window.pageYOffset - 70;
                window.scrollTo({ top: offsetPosition, behavior: reduceMotion ? 'auto' : 'smooth' });
            }
        });
    });

    // Click-to-play YouTube embeds (loads the player only when requested)
    document.querySelectorAll('.video-embed').forEach(box => {
        box.addEventListener('click', () => {
            if (box.classList.contains('playing')) return;
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(box.dataset.videoId) + '?autoplay=1&rel=0';
            iframe.title = box.dataset.title || 'Video';
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
            iframe.allowFullscreen = true;
            box.replaceChildren(iframe);
            box.classList.add('playing');
            box.removeAttribute('aria-label');
        });
    });

    // Tabs (gallery groups)
    document.querySelectorAll('.tabs').forEach(list => {
        const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
        const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
        const select = (index, focus) => {
            tabs.forEach((t, i) => {
                const on = i === index;
                t.setAttribute('aria-selected', String(on));
                t.tabIndex = on ? 0 : -1;
                panels[i].hidden = !on;
            });
            if (focus) tabs[index].focus();
        };
        tabs.forEach((t, i) => {
            t.addEventListener('click', () => select(i));
            t.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % tabs.length, true); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + tabs.length) % tabs.length, true); }
            });
        });
        select(0);
    });

    // Gallery lightbox (click a photo to view it larger)
    const lightbox = document.createElement('dialog');
    lightbox.className = 'lightbox';
    lightbox.setAttribute('aria-label', 'Photo viewer');
    lightbox.innerHTML = '<button type="button" class="lb-btn lb-close" aria-label="Close">&times;</button>' +
        '<button type="button" class="lb-btn lb-prev" aria-label="Previous photo">&#8249;</button>' +
        '<figure><img alt=""><figcaption></figcaption></figure>' +
        '<button type="button" class="lb-btn lb-next" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(lightbox);
    const lbImg = lightbox.querySelector('img');
    const lbCap = lightbox.querySelector('figcaption');
    let lbItems = [];
    let lbIndex = 0;

    const showPhoto = (i) => {
        lbIndex = (i + lbItems.length) % lbItems.length;
        const item = lbItems[lbIndex];
        const img = item.querySelector('img');
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        const cap = item.querySelector('figcaption');
        lbCap.textContent = (cap ? cap.textContent : (item.dataset.caption || img.alt)) + '  (' + (lbIndex + 1) + '/' + lbItems.length + ')';
        lightbox.classList.toggle('single', lbItems.length < 2);
    };

    const wireGalleryItem = (item) => {
        if (item.dataset.wired) return;
        item.dataset.wired = '1';
        const cap = item.querySelector('figcaption');
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', 'View larger: ' + (cap ? cap.textContent : (item.dataset.caption || item.querySelector('img').alt || 'photo')));
        const open = () => {
            const group = item.closest('.gallery-grid, .project-gallery, .cert-box');
            lbItems = Array.from(group.querySelectorAll('.gallery-item, figure'));
            showPhoto(lbItems.indexOf(item));
            if (typeof lightbox.showModal === 'function') lightbox.showModal();
        };
        item.addEventListener('click', open);
        item.addEventListener('keydown', (e) => {
            if (e.target !== item) return;
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
    };
    document.querySelectorAll('.gallery-item, .project-gallery figure, .cert-box figure').forEach(wireGalleryItem);
    window.PortfolioUI = { wireGalleryItem };

    lightbox.querySelector('.lb-close').addEventListener('click', () => lightbox.close());
    lightbox.querySelector('.lb-prev').addEventListener('click', () => showPhoto(lbIndex - 1));
    lightbox.querySelector('.lb-next').addEventListener('click', () => showPhoto(lbIndex + 1));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') showPhoto(lbIndex + 1);
        if (e.key === 'ArrowLeft') showPhoto(lbIndex - 1);
    });

    // Navbar background on scroll
    const navbar = document.querySelector('.navbar');
    const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        const setMenu = (open) => {
            navLinks.classList.toggle('open', open);
            mobileMenuBtn.classList.toggle('open', open);
            mobileMenuBtn.setAttribute('aria-expanded', String(open));
        };

        mobileMenuBtn.addEventListener('click', () => {
            setMenu(!navLinks.classList.contains('open'));
        });

        // Close after choosing a link, pressing Escape, or resizing to desktop
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => setMenu(false));
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') setMenu(false);
        });
        window.addEventListener('resize', () => {
            if (window.innerWidth > 960) setMenu(false);
        });
    }
});
