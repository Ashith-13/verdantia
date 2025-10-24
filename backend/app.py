import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from dotenv import load_dotenv

load_dotenv()


def _init_db():
    """
    Initialize Mongo client and DB.
    Supports both:
    - MONGO_URI with DB in URI (e.g., mongodb://localhost:27017/verdantia)
    - MONGO_URI + MONGO_DB (separate db name)
    """
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/verdantia")
    mongo_db = os.getenv("MONGO_DB")

    client = MongoClient(mongo_uri)

    if mongo_db:
        db = client[mongo_db]
    else:
        db = client.get_default_database()
        if db is None:  # avoid NotImplementedError
            db = client["verdantia"]

    return client, db


def create_app():
    app = Flask(__name__, static_folder=None)

    # Config
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-secret-change-me")
    app.config["UPLOAD_DIR"] = os.getenv("UPLOAD_DIR", "uploads")
    app.config["CERT_DIR"] = os.getenv("CERT_DIR", "certs")
    app.config["FRONTEND_DIR"] = os.getenv("FRONTEND_DIR", os.path.join(os.getcwd(), "frontend", "dist"))

    cors_origins = os.getenv("CORS_ORIGINS", "*")
    CORS(app, supports_credentials=True,
         origins=cors_origins.split(",") if cors_origins != "*" else "*")

    JWTManager(app)

    os.makedirs(app.config["UPLOAD_DIR"], exist_ok=True)
    os.makedirs(app.config["CERT_DIR"], exist_ok=True)

    # DB
    client, db = _init_db()
    app.db_client = client
    app.db = db

    # Blueprints
    from blueprints.auth import bp as auth_bp
    from blueprints.recommendation import bp as reco_bp
    from blueprints.compliance import bp as comp_bp
    from blueprints.gamification import bp as game_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(reco_bp, url_prefix="/api")
    app.register_blueprint(comp_bp, url_prefix="/api")
    app.register_blueprint(game_bp, url_prefix="/api")

    # File serving
    @app.get("/uploads/<path:filename>")
    def serve_upload(filename):
        return send_from_directory(app.config["UPLOAD_DIR"], filename, as_attachment=False)

    @app.get("/certs/<path:filename>")
    def serve_cert(filename):
        return send_from_directory(app.config["CERT_DIR"], filename, as_attachment=False)

    # Health
    @app.get("/health")
    def health():
        try:
            app.db.command("ping")
            return jsonify(ok=True, db="up")
        except PyMongoError as e:
            return jsonify(ok=False, db="down", error=str(e)), 500

    # Root endpoint - API info instead of frontend
    @app.get("/")
    def api_root():
        return jsonify({
            "message": "Verdantia API is running successfully!",
            "status": "success",
            "version": "1.0.0",
            "endpoints": {
                "health": "/health",
                "auth": "/api/auth",
                "recommendations": "/api/recommendations",
                "compliance": "/api/compliance",
                "gamification": "/api/gamification"
            }
        })

    # Optional: Serve frontend if it exists, otherwise return 404
    @app.get("/<path:path>")
    def catch_all(path):
        # Check if it's a static file in frontend/dist
        frontend_file = os.path.join(app.config["FRONTEND_DIR"], path)
        if os.path.isfile(frontend_file):
            return send_from_directory(app.config["FRONTEND_DIR"], path)
        
        # Check if frontend index.html exists for SPA routing
        index_path = os.path.join(app.config["FRONTEND_DIR"], "index.html")
        if os.path.exists(index_path):
            return send_from_directory(app.config["FRONTEND_DIR"], "index.html")
        
        # No frontend found, return 404
        return jsonify({
            "error": "Not found",
            "message": "This endpoint does not exist. Visit / for available API endpoints."
        }), 404

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)),
            debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")