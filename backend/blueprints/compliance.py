from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt, decode_token
from bson import ObjectId
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from datetime import datetime

bp = Blueprint("compliance", __name__)

def _pub_report(doc):
    """Format compliance report document for API response"""
    return {
        "id": str(doc["_id"]),
        "user_id": str(doc["user_id"]),
        "username": doc.get("username"),
        "project_name": doc.get("project_name"),
        "species_choice": doc.get("species_choice"),
        "area_sqm": doc.get("area_sqm"),
        "trees_planned": doc.get("trees_planned"),
        "lat": doc.get("lat"),
        "lon": doc.get("lon"),
        "status": doc.get("status","Pending"),
        "result": doc.get("result",{})
    }

@bp.route("/compliance-check", methods=["POST"])
@jwt_required()
def compliance_check():
    """
    Submit a compliance check for a green project.
    Calculates required trees and compliance status.
    Prevents duplicate pending submissions for the same project.
    """
    claims = get_jwt()
    user_id = claims["sub"]
    username = claims.get("username","user")
    data = request.get_json() or {}
    
    # Extract and validate input data
    project_name = data.get("project_name", "Project").strip()
    
    # Validate project name
    if not project_name:
        return jsonify(msg="Project name is required"), 400
    
    area = float(data.get("area_sqm", 0))
    trees = int(data.get("trees_planned", 0))
    green_area = data.get("green_area_sqm", None)
    green_area = float(green_area) if green_area not in [None,""] else None
    species_choice = data.get("species_choice","")
    lat = float(data.get("lat",0))
    lon = float(data.get("lon",0))

    # ⚠️ PREVENT DUPLICATE SUBMISSIONS ⚠️
    # Check if a pending report with the same project name already exists for this user
    existing = current_app.db.reports.find_one({
        "user_id": ObjectId(user_id),
        "project_name": project_name,
        "status": "Pending"
    })
    
    if existing:
        return jsonify(
            msg=f"A pending compliance report for project '{project_name}' already exists. Please delete the existing report or wait for approval before submitting again."
        ), 409  # 409 Conflict status code

    # Calculate compliance requirements
    # Rule: 1 tree per 80 sqm
    required_trees = int((area + 79)//80) if area>0 else 0
    compliant_by_trees = trees >= required_trees
    compliant_by_area = (green_area is not None) and (green_area >= 0.1*area)
    compliant = bool(compliant_by_trees or compliant_by_area)

    # Create compliance report document
    doc = {
        "user_id": ObjectId(user_id),
        "username": username,
        "project_name": project_name,
        "species_choice": species_choice,
        "area_sqm": area,
        "trees_planned": trees,
        "green_area_sqm": green_area,
        "lat": lat,
        "lon": lon,
        "status": "Pending",
        "result": {
            "required_trees": required_trees,
            "delta_trees": trees - required_trees,
            "compliant": compliant
        },
        "created_at": datetime.utcnow()
    }
    
    # Insert into database
    current_app.db.reports.insert_one(doc)
    return jsonify(_pub_report(doc)), 201

@bp.route("/compliance-reports", methods=["GET"])
@jwt_required()
def my_reports():
    """Get all compliance reports for the authenticated user"""
    claims = get_jwt()
    uid = ObjectId(claims["sub"])
    docs = current_app.db.reports.find({"user_id": uid}).sort("created_at",-1)
    return jsonify(reports=[_pub_report(d) for d in docs])

@bp.route("/compliance-report/<rid>", methods=["DELETE"])
@jwt_required()
def delete_compliance_report(rid):
    """
    Delete a compliance report (only if Pending status and owner).
    This prevents deletion of approved reports.
    """
    claims = get_jwt()
    uid = ObjectId(claims["sub"])
    
    try:
        # Validate ObjectId format
        try:
            report_id = ObjectId(rid)
        except:
            return jsonify(error="Invalid report ID format"), 400
        
        # Find the report and verify ownership
        report = current_app.db.reports.find_one({
            "_id": report_id,
            "user_id": uid
        })
        
        if not report:
            return jsonify(error="Report not found or unauthorized"), 404
        
        # Only allow deletion of pending reports
        if report.get("status") != "Pending":
            return jsonify(error="Can only delete pending reports"), 403
        
        # Delete from database
        result = current_app.db.reports.delete_one({
            "_id": report_id,
            "user_id": uid,
            "status": "Pending"
        })
        
        if result.deleted_count > 0:
            return jsonify(success=True, message="Report deleted successfully"), 200
        else:
            return jsonify(error="Failed to delete report"), 500
    
    except Exception as e:
        current_app.logger.error(f"Error deleting report {rid}: {str(e)}")
        return jsonify(error=str(e)), 500

@bp.route("/admin/compliance-pending", methods=["GET"])
@jwt_required()
def admin_pending():
    """Get all pending compliance reports (government only)"""
    claims = get_jwt()
    if claims.get("role")!="government":
        return jsonify(msg="forbidden"), 403
    docs = current_app.db.reports.find({"status":"Pending"}).sort("created_at",1)
    return jsonify(reports=[_pub_report(d) for d in docs])

@bp.route("/compliance-approve/<rid>", methods=["PUT"])
@jwt_required()
def approve(rid):
    """Approve a compliance report (government only)"""
    claims = get_jwt()
    if claims.get("role")!="government":
        return jsonify(msg="forbidden"), 403
    
    try:
        report_id = ObjectId(rid)
    except:
        return jsonify(msg="Invalid report ID"), 400
    
    d = current_app.db.reports.find_one({"_id": report_id})
    if not d: 
        return jsonify(msg="not found"), 404
    
    current_app.db.reports.update_one(
        {"_id": d["_id"]}, 
        {"$set": {"status":"Approved","approved_at": datetime.utcnow()}}
    )
    return jsonify(ok=True)

def _draw_certificate(buffer, report):
    """Generate PDF certificate for approved compliance report"""
    c = canvas.Canvas(buffer, pagesize=A4)
    W,H = A4
    brand = HexColor("#2d6a4f")
    brand2 = HexColor("#40916c")
    line = HexColor("#d8f3dc")

    # Draw border
    c.setStrokeColor(line)
    c.setLineWidth(3)
    c.rect(12*mm, 12*mm, W-24*mm, H-24*mm)

    # Title
    c.setFillColor(brand)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(30*mm, H-40*mm, "Verdantia Green Compliance Certificate")
    c.setFillColor(brand2)
    c.setFont("Helvetica", 12)
    c.drawString(30*mm, H-47*mm, "AI-powered Afforestation Planner")

    # Project details
    c.setFillColor(brand)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(30*mm, H-65*mm, "Project:")
    c.setFillColor(HexColor("#1b4332"))
    c.setFont("Helvetica", 12)
    c.drawString(60*mm, H-65*mm, report.get("project_name",""))

    c.setFillColor(brand)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(30*mm, H-75*mm, "Applicant:")
    c.setFillColor(HexColor("#1b4332"))
    c.setFont("Helvetica", 12)
    c.drawString(60*mm, H-75*mm, report.get("username",""))

    c.setFillColor(brand)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(30*mm, H-85*mm, "Selected Species:")
    c.setFillColor(HexColor("#1b4332"))
    c.setFont("Helvetica", 12)
    c.drawString(80*mm, H-85*mm, report.get("species_choice",""))

    c.setFillColor(brand)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(30*mm, H-95*mm, "Location:")
    c.setFillColor(HexColor("#1b4332"))
    c.setFont("Helvetica", 12)
    loc = f"Lat {report.get('lat')}, Lon {report.get('lon')}"
    c.drawString(60*mm, H-95*mm, loc)

    # Planting guidance
    c.setFillColor(brand)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(30*mm, H-110*mm, "Planting Location Guidance")
    c.setFillColor(HexColor("#1b4332"))
    c.setFont("Helvetica", 11)
    guidance = [
        "Plant approved species within the project boundary at provided coordinates.",
        "Prioritize perimeters, open courtyards, and contour lines.",
        "Maintain mixed clusters with ~1600 saplings/ha for rapid canopy and resilience.",
        "Use mulching & rainwater harvesting to sustain growth during dry months."
    ]
    y = H-120*mm
    for line_txt in guidance:
        c.drawString(30*mm, y, line_txt)
        y -= 7*mm

    # Footer
    c.setStrokeColor(line)
    c.line(30*mm, 30*mm, W-30*mm, 30*mm)
    c.setFillColor(brand2)
    c.setFont("Helvetica", 10)
    footer_text = "Issued by: Government Authority via Verdantia · "+ datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    c.drawString(30*mm, 25*mm, footer_text)
    
    c.showPage()
    c.save()

@bp.route("/compliance-certificate/<rid>", methods=["GET"])
def certificate(rid):
    """
    Download compliance certificate PDF.
    Accessible by report owner and government users.
    """
    # Extract token from Authorization header or query param
    token = None
    auth = request.headers.get("Authorization","")
    if auth.startswith("Bearer "):
        token = auth.split(" ",1)[1].strip()
    if not token:
        token = request.args.get("token")
    if not token:
        return jsonify(msg="Missing Authorization Header"), 401
    
    # Decode and validate token
    try:
        claims = decode_token(token)
    except Exception as e:
        current_app.logger.error(f"Token decode error: {str(e)}")
        return jsonify(msg="invalid token"), 401

    # Find the report
    try:
        report_id = ObjectId(rid)
    except:
        return jsonify(msg="Invalid report ID"), 400
    
    report = current_app.db.reports.find_one({"_id": report_id})
    if not report: 
        return jsonify(msg="not found"), 404

    # Check authorization
    uid = claims.get("sub")
    role = claims.get("claims",{}).get("role") or claims.get("role")
    if role != "government" and str(report["user_id"]) != uid:
        return jsonify(msg="forbidden"), 403

    # Generate PDF certificate
    buf = BytesIO()
    _draw_certificate(buf, report)
    buf.seek(0)
    filename = f"certificate_{rid}.pdf"
    
    return send_file(
        buf, 
        download_name=filename, 
        as_attachment=True, 
        mimetype="application/pdf"
    )