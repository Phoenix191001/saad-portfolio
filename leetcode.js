/* LeetCode section on the Projects page. Reads /api/leetcode (see api/leetcode.js), refreshes itself,
 * and stays hidden until a LeetCode username is configured. All text goes in via textContent. */
(function () {
    'use strict';

    const root = document.getElementById('leetcode');
    if (!root) return;
    const body = root.querySelector('.lc-body');
    const stamp = root.querySelector('.lc-stamp');
    const REFRESH_MS = 120000;

    const el = (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    };
    const fmt = (n) => (n == null ? '-' : Number(n).toLocaleString('en-US'));
    const profileUrl = (u) => 'https://leetcode.com/u/' + encodeURIComponent(u) + '/';

    function ago(iso) {
        const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
        if (s < 90) return 'just now';
        if (s < 3600) return Math.round(s / 60) + ' min ago';
        if (s < 86400) return Math.round(s / 3600) + ' h ago';
        const d = Math.round(s / 86400);
        return d + (d === 1 ? ' day ago' : ' days ago');
    }

    function bar(label, cls, solved, total) {
        const row = el('div', 'lc-bar ' + cls);
        const head = el('div', 'lc-bar-head');
        head.append(el('span', 'lc-bar-label', label), el('span', 'lc-bar-count', solved + ' / ' + total));
        const track = el('div', 'lc-track');
        const fill = el('div', 'lc-fill');
        fill.style.width = (total ? Math.min(100, (solved / total) * 100) : 0).toFixed(1) + '%';
        track.appendChild(fill);
        row.append(head, track);
        return row;
    }

    function tile(value, label) {
        const t = el('div', 'lc-tile');
        t.append(el('span', 'lc-tile-value', value), el('span', 'lc-tile-label', label));
        return t;
    }

    function heatmap(days) {
        const keys = Object.keys(days).sort();
        const wrap = el('div', 'lc-heat');
        const grid = el('div', 'lc-heat-grid');
        grid.setAttribute('role', 'img');
        grid.setAttribute('aria-label', 'Submissions per day over the last year');
        const offset = new Date(keys[0] + 'T00:00:00Z').getUTCDay();   // Sunday = 0
        for (let i = 0; i < offset; i++) grid.appendChild(el('span', 'lc-cell blank'));
        keys.forEach((k) => {
            const c = days[k];
            const lvl = c === 0 ? 0 : c === 1 ? 1 : c <= 3 ? 2 : c <= 6 ? 3 : 4;
            const cell = el('span', 'lc-cell l' + lvl);
            cell.title = c + (c === 1 ? ' submission' : ' submissions') + ' on ' + k;
            grid.appendChild(cell);
        });
        const legend = el('div', 'lc-legend');
        legend.append(el('span', null, 'Less'));
        for (let i = 0; i <= 4; i++) legend.appendChild(el('span', 'lc-cell l' + i));
        legend.append(el('span', null, 'More'));
        wrap.append(grid, legend);
        return wrap;
    }

    function render(d) {
        body.replaceChildren();
        const user = d.username;

        // header
        const head = el('div', 'lc-head');
        if (d.profile && d.profile.avatar) {
            const img = el('img', 'lc-avatar');
            img.src = d.profile.avatar; img.alt = ''; img.width = 44; img.height = 44; img.loading = 'lazy';
            img.addEventListener('error', () => img.remove());
            head.appendChild(img);
        }
        const who = el('div', 'lc-who');
        const name = el('a', 'lc-user', '@' + user);
        name.href = profileUrl(user); name.target = '_blank'; name.rel = 'noopener';
        who.appendChild(name);
        if (d.profile && d.profile.realName) who.appendChild(el('span', 'lc-real', d.profile.realName));
        head.appendChild(who);
        const view = el('a', 'btn btn-outline btn-sm lc-view', 'View profile');
        view.href = profileUrl(user); view.target = '_blank'; view.rel = 'noopener';
        head.appendChild(view);
        body.appendChild(head);

        // totals + difficulty bars
        const top = el('div', 'lc-top');
        const big = el('div', 'lc-big');
        big.append(el('span', 'lc-big-value', fmt(d.solved.all)), el('span', 'lc-big-label', 'problems solved of ' + fmt(d.totals.all)));
        const bars = el('div', 'lc-bars');
        bars.append(bar('Easy', 'easy', d.solved.easy, d.totals.easy), bar('Medium', 'medium', d.solved.medium, d.totals.medium), bar('Hard', 'hard', d.solved.hard, d.totals.hard));
        top.append(big, bars);
        body.appendChild(top);

        // tiles
        const tiles = el('div', 'lc-tiles');
        tiles.append(
            tile(d.profile && d.profile.ranking ? '#' + fmt(d.profile.ranking) : '-', 'Global ranking'),
            tile(d.contest ? fmt(d.contest.rating) : '-', d.contest ? 'Contest rating (' + d.contest.attended + ' contests)' : 'Contest rating'),
            tile(d.streak + (d.streak === 1 ? ' day' : ' days'), 'Current streak'),
            tile(fmt(d.activeDays), 'Active days, last year'));
        body.appendChild(tiles);

        // heatmap
        const hh = el('h3', 'lc-sub', fmt(d.submissions) + ' submissions in the last year');
        body.append(hh, heatmap(d.calendar));

        // recent + badges
        const cols = el('div', 'lc-cols');
        const recent = el('div', 'lc-col');
        recent.appendChild(el('h3', 'lc-sub', 'Recently solved'));
        const list = el('ul', 'lc-recent');
        (d.recent || []).slice(0, 8).forEach((r) => {
            const li = el('li');
            if (r.slug) {
                const a = el('a', null, r.title);
                a.href = 'https://leetcode.com/problems/' + r.slug + '/'; a.target = '_blank'; a.rel = 'noopener';
                li.appendChild(a);
            } else li.appendChild(el('span', null, r.title));
            li.appendChild(el('time', 'lc-time', ago(r.at)));
            list.appendChild(li);
        });
        if (!list.children.length) list.appendChild(el('li', 'lc-empty', 'No recent accepted submissions.'));
        recent.appendChild(list);
        cols.appendChild(recent);

        const side = el('div', 'lc-col');
        if (d.badges && d.badges.length) {
            side.appendChild(el('h3', 'lc-sub', 'Badges'));
            const bw = el('div', 'lc-badges');
            d.badges.forEach((b) => {
                const chip = el('span', 'lc-badge');
                if (b.icon) { const i = el('img'); i.src = b.icon; i.alt = ''; i.width = 18; i.height = 18; i.loading = 'lazy'; i.addEventListener('error', () => i.remove()); chip.appendChild(i); }
                chip.appendChild(document.createTextNode(b.name));
                bw.appendChild(chip);
            });
            side.appendChild(bw);
        }
        if (d.languages && d.languages.length) {
            side.appendChild(el('h3', 'lc-sub', 'Languages'));
            const lw = el('div', 'lc-badges');
            d.languages.forEach((l) => lw.appendChild(el('span', 'lc-badge', l.name + ' ' + l.solved)));
            side.appendChild(lw);
        }
        cols.appendChild(side);
        body.appendChild(cols);

        const heat = body.querySelector('.lc-heat');
        if (heat) heat.scrollLeft = heat.scrollWidth;      // show the most recent weeks first on narrow screens

        stamp.textContent = 'Live. Updated ' + new Date(d.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        stamp.classList.remove('stale');
    }

    function showError(d) {
        if (body.querySelector('.lc-top')) {            // keep the last good data, just flag it
            stamp.textContent = 'Could not refresh, showing the last update';
            stamp.classList.add('stale');
            return;
        }
        body.replaceChildren();
        const box = el('div', 'lc-error');
        box.appendChild(el('p', null, 'Live stats are unavailable right now.'));
        if (d && d.username) {
            const a = el('a', 'btn btn-outline btn-sm', 'Open my LeetCode profile');
            a.href = profileUrl(d.username); a.target = '_blank'; a.rel = 'noopener';
            box.appendChild(a);
        }
        body.appendChild(box);
        stamp.textContent = 'Offline';
        stamp.classList.add('stale');
    }

    let busy = false;
    let last = 0;
    async function load() {
        if (busy) return;
        busy = true;
        try {
            const r = await fetch('/api/leetcode', { headers: { Accept: 'application/json' } });
            const ctype = r.headers.get('content-type') || '';
            if (!ctype.includes('json')) { root.hidden = true; return; }    // no API here (e.g. opened from a file)
            const d = await r.json();
            if (d.configured === false) { root.hidden = true; return; }
            root.hidden = false;
            if (!r.ok || d.error || !d.solved) showError(d); else render(d);
            last = Date.now();
        } catch (e) {
            if (!root.hidden) showError(null);
        } finally { busy = false; }
    }

    load();
    setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - last > 60000) load(); });
})();
