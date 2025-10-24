import os
import secrets
from datetime import datetime
from bson import ObjectId
from flask import Blueprint, request, jsonify, current_app, url_for
from flask_jwt_extended import jwt_required, get_jwt
from werkzeug.utils import secure_filename

bp = Blueprint("gamification", __name__)

ALLOWED = {"png","jpg","jpeg","mp4","mov","avi","webm"}

# Fixed voucher catalog (validate cost server-side)
VOUCHER_CATALOG = {
    # id       brand,             value, description (optional)
    "V50":  {"brand": "Cafe Verde",    "value": 50,  "desc": "Rs. 50 off — beverages"},
    "V75":  {"brand": "Eco Mart",      "value": 75,  "desc": "Rs. 75 off — groceries"},
    "V100": {"brand": "Green Bites",   "value": 100, "desc": "Rs. 100 off — snacks"},
    "V120": {"brand": "Leaf n' Learn", "value": 120, "desc": "Rs. 120 off — books"},
    "V150": {"brand": "Urban Forest",  "value": 150, "desc": "Rs. 150 off — apparel"},
    "V200": {"brand": "Planet Play",   "value": 200, "desc": "Rs. 200 off — games"},
}

def _pub_upload(d):
    url = None
    if d.get("filename"):
        url = url_for("serve_upload", filename=d["filename"], _external=True)
    return {
        "id": str(d["_id"]),
        "user_id": str(d["user_id"]),
        "filename": d.get("filename"),
        "status": d.get("status","Pending"),
        "points_awarded": int(d.get("points_awarded",0)),
        "url": url
    }

def _pub_voucher(r):
    return {
        "id": str(r["_id"]),
        "user_id": str(r["user_id"]),
        "voucher_id": r["voucher_id"],
        "brand": r["brand"],
        "value": int(r["value"]),
        "code": r.get("code"),
        "created_at": r["created_at"].isoformat() + "Z",
        "status": r.get("status","Issued")
    }

# --------------------------
# Uploads / Proof-of-planting
# --------------------------

@bp.route("/upload-video", methods=["POST"])
@jwt_required()
def upload_video():
    claims = get_jwt()
    uid = claims["sub"]
    f = request.files.get("file")
    if not f:
        return jsonify(msg="file required"), 400
    ext = f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else ""
    if ext not in ALLOWED:
        return jsonify(msg="invalid file type"), 400
    safe = secure_filename(f"{uid}_{int(datetime.utcnow().timestamp())}_{f.filename}")
    path = os.path.join(current_app.config["UPLOAD_DIR"], safe)
    f.save(path)
    doc = {
        "user_id": ObjectId(uid),
        "filename": safe,
        "status": "Pending",
        "points_awarded": 0,
        "created_at": datetime.utcnow()
    }
    current_app.db.uploads.insert_one(doc)
    return jsonify(_pub_upload(doc))

@bp.route("/my-videos", methods=["GET"])
@jwt_required()
def my_videos():
    claims = get_jwt()
    uid = ObjectId(claims["sub"])
    docs = current_app.db.uploads.find({"user_id": uid}).sort("created_at",-1)
    return jsonify(videos=[_pub_upload(d) for d in docs])

@bp.route("/upload-video/<uidoc>", methods=["DELETE"])
@jwt_required()
def delete_upload_video(uidoc):
    """Delete an uploaded video/image (only by owner)"""
    claims = get_jwt()
    uid = ObjectId(claims["sub"])
    
    try:
        # Find the upload - ensure it belongs to the current user
        upload = current_app.db.uploads.find_one({
            "_id": ObjectId(uidoc),
            "user_id": uid
        })
        
        if not upload:
            return jsonify(error="Upload not found or unauthorized"), 404
        
        # If approved, deduct the points that were awarded
        if upload.get("status") == "Approved" and upload.get("points_awarded", 0) > 0:
            current_app.db.users.update_one(
                {"_id": uid},
                {"$inc": {"points": -upload["points_awarded"]}}
            )
        
        # Delete the file from filesystem if it exists
        if upload.get("filename"):
            file_path = os.path.join(current_app.config["UPLOAD_DIR"], upload["filename"])
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Warning: Could not delete file {file_path}: {e}")
        
        # Delete from database
        result = current_app.db.uploads.delete_one({
            "_id": ObjectId(uidoc),
            "user_id": uid
        })
        
        if result.deleted_count > 0:
            return jsonify(success=True, message="Upload deleted successfully"), 200
        else:
            return jsonify(error="Failed to delete upload"), 500
    
    except Exception as e:
        return jsonify(error=str(e)), 500

@bp.route("/admin/uploads-pending", methods=["GET"])
@jwt_required()
def admin_uploads_pending():
    claims = get_jwt()
    if claims.get("role")!="government":
        return jsonify(msg="forbidden"), 403
    docs = current_app.db.uploads.find({"status":"Pending"}).sort("created_at",1)
    return jsonify(uploads=[_pub_upload(d) for d in docs])

@bp.route("/upload-approve/<uidoc>", methods=["PUT"])
@jwt_required()
def upload_approve(uidoc):
    claims = get_jwt()
    if claims.get("role")!="government":
        return jsonify(msg="forbidden"), 403
    d = current_app.db.uploads.find_one({"_id": ObjectId(uidoc)})
    if not d:
        return jsonify(msg="not found"), 404
    if d.get("status") == "Approved":
        return jsonify(ok=True)
    current_app.db.uploads.update_one(
        {"_id": d["_id"]},
        {"$set": {"status":"Approved","points_awarded": 50, "approved_at": datetime.utcnow()}}
    )
    current_app.db.users.update_one({"_id": d["user_id"]}, {"$inc": {"points": 50}})
    return jsonify(ok=True)

# --------------------------
# Leaderboard
# --------------------------

@bp.route("/leaderboard", methods=["GET"])
def leaderboard():
    users = current_app.db.users.find(
        {"role": {"$ne": "government"}},
        {"username":1,"points":1}
    ).sort("points",-1).limit(20)
    return jsonify(leaderboard=[{"username":u.get("username"), "points": int(u.get("points",0))} for u in users])

# --------------------------
# Voucher Redemption
# --------------------------

@bp.route("/redeem-voucher", methods=["POST"])
@jwt_required()
def redeem_voucher():
    """
    Request JSON: { "voucher_id": "V100" }
    - Validates voucher id and cost (server-truth)
    - Atomically deducts points if sufficient
    - Records redemption, returns a voucher code
    """
    claims = get_jwt()
    uid = claims["sub"]
    data = request.get_json(silent=True) or {}
    voucher_id = (data.get("voucher_id") or "").strip()

    if voucher_id not in VOUCHER_CATALOG:
        return jsonify(error="invalid voucher_id"), 400

    catalog = VOUCHER_CATALOG[voucher_id]
    cost = int(catalog["value"])

    # Atomic deduction to avoid race conditions:
    # Only deduct if points >= cost
    res = current_app.db.users.update_one(
        {"_id": ObjectId(uid), "points": {"$gte": cost}},
        {"$inc": {"points": -cost}}
    )
    if res.modified_count == 0:
        return jsonify(error="insufficient points"), 400

    # Create a simple voucher code
    code = f"{voucher_id}-{secrets.token_hex(3).upper()}"

    redemption = {
        "user_id": ObjectId(uid),
        "voucher_id": voucher_id,
        "brand": catalog["brand"],
        "value": cost,
        "code": code,
        "status": "Issued",
        "created_at": datetime.utcnow(),
    }
    current_app.db.voucher_redemptions.insert_one(redemption)

    return jsonify(ok=True, code=code, brand=catalog["brand"], value=cost)

@bp.route("/my-vouchers", methods=["GET"])
@jwt_required()
def my_vouchers():
    claims = get_jwt()
    uid = ObjectId(claims["sub"])
    cur = current_app.db.voucher_redemptions.find({"user_id": uid}).sort("created_at", -1)
    return jsonify(vouchers=[_pub_voucher(r) for r in cur])