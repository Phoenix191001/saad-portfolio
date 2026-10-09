# Owner guide: adding photos and projects

Click **Owner** at the bottom of any page and paste a GitHub token. After that you will see:

- **+ Add photo** on the Gallery page (a photo and a short title)
- **+ Add project** in the Projects section (title, description, optional tags, link and photo)
- a small **x** on anything you added, to remove it

Saving commits to this repo, and Vercel rebuilds the site. It is live for everyone in about a minute.

## Making the token (once)

1. GitHub > Settings > Developer settings > Personal access tokens > **Fine-grained tokens** > Generate new token.
2. **Repository access:** Only select repositories > `saad-portfolio`.
3. **Permissions > Repository permissions > Contents:** Read and write.
4. Pick an expiry (90 days is fine), generate, copy the token.
5. On the site click **Owner**, paste it, log in. It is stored only in that browser.

Use **Log out** (or the Owner button) to remove the token from a browser. If a token is ever exposed, delete it on GitHub.

## Where things are stored

- Photos are saved in `uploads/`.
- Titles and project details are saved in `data/gallery.json` and `data/projects.json`.
