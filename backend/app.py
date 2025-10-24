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

    # SPA fallback (so /games reload doesn’t 404)
    def serve_spa_index():
        index_path = os.path.join(app.config["FRONTEND_DIR"], "index.html")
        if os.path.exists(index_path):
            return send_from_directory(app.config["FRONTEND_DIR"], "index.html")
        return jsonify(error="frontend_not_built"), 501

    @app.get("/")
    def spa_root():
        return serve_spa_index()

    @app.get("/<path:path>")
    def spa_catch_all(path):
        full = os.path.join(app.config["FRONTEND_DIR"], path)
        if os.path.isfile(full):
            return send_from_directory(app.config["FRONTEND_DIR"], path)
        return serve_spa_index()

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)),
            debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
