# Verdantia Fullstack v9.7.1 — Blueprints fixed

✅ Blueprints package included (auth/recommendation/compliance/gamification)  
✅ Login + Register + Role selector wired to MongoDB  
✅ User & Government dashboards connected to API

## Run
Backend
```
cd backend
python -m venv .venv && . .venv\Scripts\activate   # Windows (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env
python seed.py
python app.py
```

Frontend
```
cd frontend
npm install
# echo VITE_API_BASE=http://localhost:5000 > .env   (if needed)
npm run dev
```

Accounts:
- user1 / user123
- gov1 / gov123
