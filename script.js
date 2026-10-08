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
            if (window.innerWidth > 768) setMenu(false);
        });
    }
});
