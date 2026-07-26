# DKG Online Backend

Run `run_app.bat` to start the shared backend locally.

The server prints phone URLs like:

```text
http://192.168.x.x:8001/
```

Open that URL on every teacher phone. When one user adds/removes students, classes, divisions, or submits attendance, the backend saves it to `shared-db.json` and pushes the update to other open users immediately.

Principal admin panel:

```text
http://192.168.x.x:8001/admin.html
```

The admin panel shows class-wise students, today present/absent counts, weekly graph, today's graph, annual graph, and yearly stored attendance records from the same shared backend.

Optional server settings can be added through a `.env` file:

```text
PORT=8001
HOST=0.0.0.0
```

The messaging system has been removed, so no Twilio or WhatsApp credentials are required.

## Permanent Online Link

For a permanent link, deploy this folder to a Node hosting service such as Render, Railway, or a VPS.

Render-ready files are included:

- `server.js`
- `package.json`
- `render.yaml`
- `Dockerfile`

After deployment, use the deployed URL as the final app link, for example:

```text
https://your-dkg-online-app.onrender.com/
```

Then rebuild the Android APK with that final URL inside `MainActivity.java`.
