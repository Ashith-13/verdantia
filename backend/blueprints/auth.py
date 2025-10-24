
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from datetime import timedelta

bp = Blueprint("auth", __name__)

def _pub(u):
    return {
        "id": str(u["_id"]),
        "username": u.get("username"),
        "role": u.get("role","user"),
        "points": int(u.get("points",0))
    }

@bp.post("/register")
def register():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    role = data.get("role","user")
    if role not in ["user","government"]:
        role = "user"
    if not username or not password:
        return jsonify(msg="username & password required"), 400
    if current_app.db.users.find_one({"username": username}):
        return jsonify(msg="username exists"), 400
    u = {
        "username": username,
        "password_hash": generate_password_hash(password),
        "role": role,
        "points": 0
    }
    current_app.db.users.insert_one(u)
    return jsonify(ok=True, user=_pub(u)), 201

@bp.post("/login")
def login():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")
    u = current_app.db.users.find_one({"username": username})
    if not u or not check_password_hash(u.get("password_hash",""), password):
        return jsonify(msg="invalid credentials"), 401
    role = u.get("role","user")
    token = create_access_token(identity=str(u["_id"]), additional_claims={"role": role, "username": username}, expires_delta=timedelta(days=1))
    return jsonify(token=token, user=_pub(u))

@bp.get("/me")
@jwt_required()
def me():
    claims = get_jwt()
    u = current_app.db.users.find_one({"_id": ObjectId(claims["sub"])})
    if not u: return jsonify(msg="not found"), 404
    return jsonify(user=_pub(u))
