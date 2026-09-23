# VeriRoll frontend — mockup

This is the clickable mockup (Student / Lecturer / Admin views) as a single
static HTML file. It has no real backend connection yet — the "Register",
"Add student", session start/stop, etc. are all local, in-page demo state
so you can click through the flow.

## Run it locally

Just open `index.html` in a browser, or serve it so relative paths behave
the way they will once this becomes a real frontend:

```powershell
# from inside veriroll-frontend/
python -m http.server 5500
# then open http://localhost:5500
```

## Next step

When you're ready to wire this to the real API (see veriroll-backend),
this single file gets split into proper pages/components (Student,
Lecturer, Admin) that call the endpoints listed in the backend's README
instead of mutating local demo state.
