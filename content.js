/* Public content loader.
 * Shows photos and projects added through the owner tools (data/*.json) to every visitor.
 * All text is inserted with textContent, never as HTML.
 */
(function () {
    'use strict';

    const TOKEN_KEY = 'portfolio_gh_token';

    const safeImagePath = (p) => typeof p === 'string' && /^uploads\/[A-Za-z0-9._-]+$/.test(p) ? p : null;
    const safeLink = (u) => {
        if (typeof u !== 'string' || !u) return null;
        try {
            const x = new URL(u);
            return (x.protocol === 'https:' || x.protocol === 'http:') ? x.href : null;
        } catch (e) { return null; }
    };

    async function loadJson(path) {
        try {
            const r = await fetch(path + '?t=' + Date.now(), { cache: 'no-cache' });
            if (!r.ok) return null;
            return await r.json();
        } catch (e) { return null; }
    }

    // ---------- Gallery photos ----------
    function photoGrid() { return document.querySelector('#panel-photography .gallery-grid'); }

    function updatePhotoCount() {
        const grid = photoGrid();
        const badge = document.querySelector('#tab-photography .tab-count');
        if (grid && badge) badge.textContent = String(grid.querySelectorAll('.gallery-item').length);
    }

    function addPhoto(p, srcOverride) {
        const grid = photoGrid();
        if (!grid || !p || !p.id) return null;
        const src = srcOverride || safeImagePath(p.image);
        if (!src) return null;
        const old = grid.querySelector('[data-id="' + CSS.escape(String(p.id)) + '"]');
        if (old) old.remove();

        const fig = document.createElement('figure');
        fig.className = 'gallery-item added';
        fig.dataset.id = String(p.id);
        if (p.image) fig.dataset.image = p.image;

        const img = document.createElement('img');
        img.src = src;
        img.alt = p.title || 'Photo';
        img.loading = 'lazy';
        const cap = document.createElement('figcaption');
        cap.textContent = p.title || '';
        fig.append(img, cap);

        grid.insertBefore(fig, grid.firstChild);   // newest first
        if (window.PortfolioUI) window.PortfolioUI.wireGalleryItem(fig);
        updatePhotoCount();
        return fig;
    }

    // ---------- Projects ----------
    function projectGrid() { return document.querySelector('#projects .projects-grid'); }

    function renumberProjects() {
        const grid = projectGrid();
        if (!grid) return;
        grid.querySelectorAll('.project-card').forEach((card, i) => {
            if (!card.classList.contains('added')) return;
            const label = card.querySelector('.project-num');
            if (label) label.textContent = 'PRJ_' + String(i + 1).padStart(2, '0');
        });
    }

    function addProject(p, srcOverride) {
        const grid = projectGrid();
        if (!grid || !p || !p.id || !p.title) return null;
        const old = grid.querySelector('[data-id="' + CSS.escape(String(p.id)) + '"]');
        if (old) old.remove();

        const card = document.createElement('div');
        card.className = 'project-card card added';
        card.dataset.id = String(p.id);
        if (p.image) card.dataset.image = p.image;

        const src = srcOverride || safeImagePath(p.image);
        if (src) {
            const fig = document.createElement('figure');
            fig.className = 'project-thumb';
            const img = document.createElement('img');
            img.src = src;
            img.alt = p.title;
            img.loading = 'lazy';
            fig.appendChild(img);
            card.appendChild(fig);
        }

        const content = document.createElement('div');
        content.className = 'project-content';
        const num = document.createElement('span');
        num.className = 'project-num';
        const h3 = document.createElement('h3');
        h3.textContent = p.title;
        content.append(num, h3);

        if (p.description) {
            const para = document.createElement('p');
            para.textContent = p.description;
            content.appendChild(para);
        }
        if (Array.isArray(p.tags) && p.tags.length) {
            const stack = document.createElement('div');
            stack.className = 'project-stack';
            p.tags.slice(0, 8).forEach((t) => {
                const tag = document.createElement('span');
                tag.className = 'stack-tag';
                tag.textContent = String(t);
                stack.appendChild(tag);
            });
            content.appendChild(stack);
        }
        const link = safeLink(p.link);
        if (link) {
            const a = document.createElement('a');
            a.className = 'card-link';
            a.href = link;
            a.target = '_blank';
            a.rel = 'noopener';
            a.textContent = 'View project ';
            const icon = document.createElement('i');
            icon.className = 'fas fa-arrow-up-right-from-square';
            a.appendChild(icon);
            content.appendChild(a);
        }
        card.appendChild(content);
        grid.appendChild(card);
        renumberProjects();
        return card;
    }

    // ---------- Boot ----------
    async function render() {
        if (photoGrid()) {
            const data = await loadJson('data/gallery.json');
            if (data && Array.isArray(data.photos)) data.photos.forEach((p) => addPhoto(p));
        }
        if (projectGrid()) {
            const data = await loadJson('data/projects.json');
            if (data && Array.isArray(data.projects)) data.projects.forEach((p) => addProject(p));
        }
        document.dispatchEvent(new CustomEvent('portfolio:rendered'));
    }

    window.PortfolioContent = { addPhoto, addProject, updatePhotoCount, renumberProjects, safeImagePath, safeLink };

    // ---------- Owner tools (loaded only for the owner) ----------
    let adminLoading = null;
    function loadAdmin() {
        if (window.PortfolioAdmin) return Promise.resolve(window.PortfolioAdmin);
        if (adminLoading) return adminLoading;
        adminLoading = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'admin.js';
            s.onload = () => resolve(window.PortfolioAdmin);
            s.onerror = () => { adminLoading = null; reject(new Error('Could not load owner tools')); };
            document.head.appendChild(s);
        });
        return adminLoading;
    }

    function hasToken() {
        try { return !!localStorage.getItem(TOKEN_KEY); } catch (e) { return false; }
    }

    document.addEventListener('DOMContentLoaded', () => {
        render();
        const ownerLink = document.getElementById('owner-link');
        if (ownerLink) {
            ownerLink.addEventListener('click', () => {
                loadAdmin().then((a) => a.open()).catch(() => alert('Could not load the owner tools. Check your connection and try again.'));
            });
        }
        if (hasToken()) loadAdmin().then((a) => a.enable()).catch(() => {});
    });
})();
