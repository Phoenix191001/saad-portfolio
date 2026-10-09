/* Owner tools: add photos and projects from the browser.
 * Loaded only after the owner logs in (see content.js). Saves by committing to the
 * GitHub repo with the owner's token, which makes Vercel rebuild the site.
 * The token is stored in this browser's localStorage and never sent anywhere except api.github.com.
 */
(function () {
    'use strict';

    const CFG = { owner: 'Phoenix191001', repo: 'saad-portfolio', branch: 'main' };
    const TOKEN_KEY = 'portfolio_gh_token';
    const API = 'https://api.github.com/repos/' + CFG.owner + '/' + CFG.repo;
    const LIVE_NOTE = 'Saved! It shows here now and will be live for everyone in about a minute, once the site rebuilds.';

    let enabled = false;

    const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } };
    const setToken = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* ignore */ } };
    const clearToken = () => { try { localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } };

    // ---------- helpers ----------
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';

    const encodeB64 = (text) => {
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        bytes.forEach((b) => { bin += String.fromCharCode(b); });
        return btoa(bin);
    };
    const decodeB64 = (b64) => {
        const bin = atob(b64.replace(/\s/g, ''));
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    };

    const readAsDataURL = (blob) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Could not read the image'));
        r.readAsDataURL(blob);
    });
    const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

    async function compress(file) {
        if (!file || !/^image\//.test(file.type)) throw new Error('Please choose an image file.');
        if (file.size > 25 * 1024 * 1024) throw new Error('That image is over 25 MB. Please choose a smaller one.');
        let bmp;
        try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
        catch (e) {
            try { bmp = await createImageBitmap(file); }
            catch (e2) { throw new Error('Could not read that image. Try a JPG or PNG.'); }
        }
        const max = 1600;
        const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const w = Math.max(1, Math.round(bmp.width * scale));
        const h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        let blob = await toBlob(canvas, 'image/webp', 0.82);
        let ext = 'webp';
        if (!blob || blob.type !== 'image/webp') {
            blob = await toBlob(canvas, 'image/jpeg', 0.85);
            ext = 'jpg';
        }
        if (!blob) throw new Error('Could not process that image.');
        const dataUrl = await readAsDataURL(blob);
        return { ext, dataUrl, b64: dataUrl.split(',')[1] };
    }

    // ---------- GitHub API ----------
    async function gh(path, opts) {
        const o = opts || {};
        return fetch(API + path, Object.assign({}, o, {
            headers: Object.assign({
                Accept: 'application/vnd.github+json',
                Authorization: 'Bearer ' + getToken(),
                'X-GitHub-Api-Version': '2022-11-28'
            }, o.headers || {})
        }));
    }

    function apiError(status) {
        if (status === 401) return new Error('GitHub rejected your token. Log out and log in again with a new token.');
        if (status === 403 || status === 404) return new Error('Your token cannot write to this repo. It needs "Contents: Read and write" access to ' + CFG.repo + '.');
        if (status === 409 || status === 422) { const e = new Error('The file changed while saving. Please try again.'); e.status = status; return e; }
        return new Error('GitHub error (' + status + '). Please try again.');
    }

    async function getFile(path) {
        const r = await gh('/contents/' + path + '?ref=' + CFG.branch + '&t=' + Date.now());
        if (r.status === 404) return null;
        if (!r.ok) throw apiError(r.status);
        const j = await r.json();
        return { sha: j.sha, text: decodeB64(j.content || '') };
    }

    async function putFile(path, b64, message, sha) {
        const body = { message: message, content: b64, branch: CFG.branch };
        if (sha) body.sha = sha;
        const r = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
        if (!r.ok) { const e = apiError(r.status); e.status = r.status; throw e; }
        return r.json();
    }

    async function deleteFile(path, message) {
        const f = await getFile(path);
        if (!f) return;
        const r = await gh('/contents/' + path, { method: 'DELETE', body: JSON.stringify({ message: message, sha: f.sha, branch: CFG.branch }) });
        if (!r.ok) throw apiError(r.status);
    }

    async function updateJson(path, key, mutate, message) {
        let lastErr;
        for (let attempt = 0; attempt < 2; attempt++) {
            const f = await getFile(path);
            let data = { [key]: [] };
            if (f) { try { data = JSON.parse(f.text); } catch (e) { data = { [key]: [] }; } }
            if (!data || !Array.isArray(data[key])) data = { [key]: [] };
            mutate(data[key]);
            try {
                await putFile(path, encodeB64(JSON.stringify(data, null, 2) + '\n'), message, f && f.sha);
                return;
            } catch (e) {
                lastErr = e;
                if (e.status !== 409 && e.status !== 422) throw e;
            }
        }
        throw lastErr;
    }

    async function verifyToken(token) {
        const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28' } });
        if (r.status === 401) throw new Error('GitHub did not accept that token.');
        if (!r.ok) throw new Error('That token cannot see the ' + CFG.repo + ' repo. Check the repo access you gave it.');
        const j = await r.json();
        if (j.permissions && j.permissions.push === false) throw new Error('That token is read-only. It needs "Contents: Read and write".');
    }

    // ---------- UI ----------
    function toast(msg, isError) {
        const t = document.createElement('div');
        t.className = 'owner-toast' + (isError ? ' error' : '');
        t.setAttribute('role', 'status');
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), isError ? 9000 : 8000);
    }

    function dialog(html) {
        const d = document.createElement('dialog');
        d.className = 'owner-dialog';
        d.innerHTML = html;
        document.body.appendChild(d);
        d.addEventListener('close', () => d.remove());
        d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
        d.querySelectorAll('.od-cancel').forEach((b) => b.addEventListener('click', () => d.close()));
        d.showModal();
        return d;
    }

    function busy(form, on) {
        form.querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = on; });
    }

    function openLogin() {
        const d = dialog(
            '<form class="od-form" novalidate>' +
            '<h3>Owner login</h3>' +
            '<p class="od-hint">Paste a GitHub token that has <strong>Contents: Read and write</strong> access to the <code>' + CFG.repo + '</code> repo. It is saved only in this browser.</p>' +
            '<label>GitHub token<input type="password" name="token" autocomplete="off" spellcheck="false"></label>' +
            '<p class="od-error" role="alert"></p>' +
            '<div class="od-actions"><button type="button" class="btn btn-outline od-cancel">Cancel</button><button type="submit" class="btn btn-primary">Log in</button></div>' +
            '</form>');
        const form = d.querySelector('form');
        const err = d.querySelector('.od-error');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const token = form.token.value.trim();
            if (!token) { err.textContent = 'Please paste your token.'; return; }
            err.textContent = '';
            busy(form, true);
            try {
                await verifyToken(token);
                setToken(token);
                d.close();
                enable();
                toast('Logged in. Add buttons are now showing on the Projects section and the Gallery page.');
            } catch (ex) {
                err.textContent = ex.message;
                busy(form, false);
            }
        });
        form.token.focus();
    }

    function openMenu() {
        const d = dialog(
            '<form class="od-form" novalidate>' +
            '<h3>Owner mode is on</h3>' +
            '<p class="od-hint">You can add photos and projects. Log out to remove the token from this browser.</p>' +
            '<div class="od-actions"><button type="button" class="btn btn-outline od-cancel">Close</button><button type="button" class="btn btn-primary od-logout">Log out</button></div>' +
            '</form>');
        d.querySelector('.od-logout').addEventListener('click', () => { d.close(); logout(); });
    }

    function openPhoto() {
        const d = dialog(
            '<form class="od-form" novalidate>' +
            '<h3>Add a photo</h3>' +
            '<label>Photo<input type="file" name="file" accept="image/*"></label>' +
            '<img class="od-preview" alt="" hidden>' +
            '<label>Short title<input type="text" name="title" maxlength="60" placeholder="e.g. Sunset over the sea"></label>' +
            '<p class="od-status" role="status"></p>' +
            '<p class="od-error" role="alert"></p>' +
            '<div class="od-actions"><button type="button" class="btn btn-outline od-cancel">Cancel</button><button type="submit" class="btn btn-primary">Upload</button></div>' +
            '</form>');
        const form = d.querySelector('form');
        const err = d.querySelector('.od-error');
        const status = d.querySelector('.od-status');
        const preview = d.querySelector('.od-preview');
        let previewUrl = null;
        form.file.addEventListener('change', () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            const f = form.file.files[0];
            if (f && /^image\//.test(f.type)) { previewUrl = URL.createObjectURL(f); preview.src = previewUrl; preview.hidden = false; }
            else { preview.hidden = true; }
        });
        d.addEventListener('close', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = form.file.files[0];
            const title = form.title.value.trim();
            err.textContent = '';
            if (!file) { err.textContent = 'Please choose a photo.'; return; }
            if (!title) { err.textContent = 'Please add a short title.'; return; }
            busy(form, true);
            try {
                status.textContent = 'Optimizing photo...';
                const img = await compress(file);
                const imagePath = 'uploads/' + Date.now() + '-' + slug(title) + '.' + img.ext;
                status.textContent = 'Uploading photo...';
                await putFile(imagePath, img.b64, 'Add gallery photo: ' + title);
                status.textContent = 'Saving title...';
                const entry = { id: 'ph' + Date.now(), title: title, image: imagePath, added: new Date().toISOString() };
                await updateJson('data/gallery.json', 'photos', (arr) => { arr.push(entry); }, 'Add gallery photo entry: ' + title);
                window.PortfolioContent.addPhoto(entry, img.dataUrl);
                decorate();
                d.close();
                toast(LIVE_NOTE);
            } catch (ex) {
                status.textContent = '';
                err.textContent = ex.message || 'Something went wrong. Please try again.';
                busy(form, false);
            }
        });
        form.file.focus();
    }

    function parseTags(text) {
        return String(text).split(',').map((t) => t.trim().slice(0, 24)).filter(Boolean).slice(0, 6);
    }

    function openProject() {
        const d = dialog(
            '<form class="od-form" novalidate>' +
            '<h3>Add a project</h3>' +
            '<label>Project title<input type="text" name="title" maxlength="80"></label>' +
            '<label>Short description<textarea name="description" rows="4" maxlength="400"></textarea></label>' +
            '<label><span>Tags <span class="od-opt">(comma separated, optional)</span></span><input type="text" name="tags" placeholder="Arduino, C++, Sensors"></label>' +
            '<label><span>Link <span class="od-opt">(optional)</span></span><input type="url" name="link" placeholder="https://..."></label>' +
            '<label><span>Photo <span class="od-opt">(optional)</span></span><input type="file" name="file" accept="image/*"></label>' +
            '<p class="od-status" role="status"></p>' +
            '<p class="od-error" role="alert"></p>' +
            '<div class="od-actions"><button type="button" class="btn btn-outline od-cancel">Cancel</button><button type="submit" class="btn btn-primary">Add project</button></div>' +
            '</form>');
        const form = d.querySelector('form');
        const err = d.querySelector('.od-error');
        const status = d.querySelector('.od-status');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = form.title.value.trim();
            const description = form.description.value.trim();
            const link = form.link.value.trim();
            const file = form.file.files[0];
            err.textContent = '';
            if (!title) { err.textContent = 'Please add a project title.'; return; }
            if (!description) { err.textContent = 'Please add a short description.'; return; }
            if (link && !window.PortfolioContent.safeLink(link)) { err.textContent = 'The link must start with http:// or https://'; return; }
            busy(form, true);
            try {
                let imagePath = null;
                let dataUrl = null;
                if (file) {
                    status.textContent = 'Optimizing photo...';
                    const img = await compress(file);
                    dataUrl = img.dataUrl;
                    imagePath = 'uploads/' + Date.now() + '-' + slug(title) + '.' + img.ext;
                    status.textContent = 'Uploading photo...';
                    await putFile(imagePath, img.b64, 'Add project photo: ' + title);
                }
                status.textContent = 'Saving project...';
                const entry = { id: 'pr' + Date.now(), title: title, description: description, tags: parseTags(form.tags.value), link: link || '', image: imagePath, added: new Date().toISOString() };
                await updateJson('data/projects.json', 'projects', (arr) => { arr.push(entry); }, 'Add project: ' + title);
                const card = window.PortfolioContent.addProject(entry, dataUrl);
                decorate();
                d.close();
                toast(LIVE_NOTE);
                if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (ex) {
                status.textContent = '';
                err.textContent = ex.message || 'Something went wrong. Please try again.';
                busy(form, false);
            }
        });
        form.title.focus();
    }

    // ---------- remove ----------
    async function removeItem(el) {
        const isPhoto = el.classList.contains('gallery-item');
        const name = (isPhoto ? (el.querySelector('figcaption') || {}).textContent : (el.querySelector('h3') || {}).textContent) || 'this item';
        if (!window.confirm('Remove "' + name + '" from the site?')) return;
        const id = el.dataset.id;
        const image = el.dataset.image;
        try {
            const file = isPhoto ? 'data/gallery.json' : 'data/projects.json';
            const key = isPhoto ? 'photos' : 'projects';
            await updateJson(file, key, (arr) => {
                const i = arr.findIndex((x) => x && x.id === id);
                if (i >= 0) arr.splice(i, 1);
            }, 'Remove ' + (isPhoto ? 'gallery photo' : 'project') + ': ' + name);
            if (image && /^uploads\/[A-Za-z0-9._-]+$/.test(image)) {
                try { await deleteFile(image, 'Delete image for removed item'); } catch (e) { /* image cleanup is best effort */ }
            }
            el.remove();
            window.PortfolioContent.updatePhotoCount();
            window.PortfolioContent.renumberProjects();
            toast('Removed. It will disappear for everyone in about a minute.');
        } catch (ex) {
            toast(ex.message || 'Could not remove it.', true);
        }
    }

    function decorate() {
        if (!enabled) return;
        document.querySelectorAll('.gallery-item.added, .project-card.added').forEach((el) => {
            if (el.querySelector('.owner-remove')) return;
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'owner-remove';
            b.title = 'Remove (owner only)';
            b.setAttribute('aria-label', 'Remove this item');
            b.textContent = '×';
            b.addEventListener('click', (e) => { e.stopPropagation(); removeItem(el); });
            b.addEventListener('keydown', (e) => e.stopPropagation());
            el.appendChild(b);
        });
    }

    function makeBar(label, handler) {
        const bar = document.createElement('div');
        bar.className = 'owner-bar';
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn btn-primary owner-add';
        add.textContent = '+ ' + label;
        add.addEventListener('click', handler);
        const out = document.createElement('button');
        out.type = 'button';
        out.className = 'btn btn-outline owner-logout';
        out.textContent = 'Log out';
        out.addEventListener('click', logout);
        bar.append(add, out);
        return bar;
    }

    function enable() {
        if (!getToken()) return;
        enabled = true;
        const tabs = document.querySelector('.gallery-tabs');
        if (tabs && !document.querySelector('.owner-bar')) tabs.parentNode.insertBefore(makeBar('Add photo', openPhoto), tabs);
        const grid = document.querySelector('#projects .projects-grid');
        if (grid && !document.querySelector('#projects .owner-bar')) grid.parentNode.insertBefore(makeBar('Add project', openProject), grid);
        const link = document.getElementById('owner-link');
        if (link) { link.classList.add('on'); link.setAttribute('aria-label', 'Owner mode is on'); }
        decorate();
        document.addEventListener('portfolio:rendered', decorate);
    }

    function logout() {
        clearToken();
        enabled = false;
        document.querySelectorAll('.owner-bar, .owner-remove').forEach((el) => el.remove());
        const link = document.getElementById('owner-link');
        if (link) { link.classList.remove('on'); link.setAttribute('aria-label', 'Owner login'); }
        toast('Logged out. The token was removed from this browser.');
    }

    function open() {
        if (getToken()) { enable(); openMenu(); } else { openLogin(); }
    }

    window.PortfolioAdmin = { open: open, enable: enable, logout: logout };
})();
