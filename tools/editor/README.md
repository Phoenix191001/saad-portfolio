# Editor bundle

The admin editor (Tiptap) and the HTML sanitizer are bundled into two committed files, so the site needs no
build step and no CDN for them:

- `assets/admin/editor-bundle.js`
- `assets/sanitize-bundle.js`

Rebuild them only if you change `src/` or upgrade a package:

```bash
cd tools/editor
npm install
npm run build
```
