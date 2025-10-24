
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import math

bp = Blueprint("recommendation", __name__)

def climate_band(lat):
    try:
        lat = float(lat)
    except:
        return "tropical"
    a = abs(lat)
    if a < 15: return "tropical"
    if a < 30: return "semi-arid"
    if a < 45: return "subtropical"
    return "temperate"

CLIMATE_SPECIES = {
    "tropical": ["Mangifera indica (Mango)", "Ficus religiosa (Peepal)", "Terminalia arjuna (Arjun)"],
    "semi-arid": ["Azadirachta indica (Neem)", "Acacia nilotica (Babul)", "Prosopis cineraria (Khejri)"],
    "subtropical": ["Dalbergia sissoo (Shisham)", "Syzygium cumini (Jamun)", "Cassia fistula (Amaltas)"],
    "temperate": ["Quercus spp. (Oak)", "Acer spp. (Maple)", "Pinus roxburghii (Chir Pine)"]
}

@bp.post("/recommendation")
@jwt_required()
def recommendation():
    data = request.get_json() or {}
    lat = float(data.get("lat", 0))
    lon = float(data.get("lon", 0))
    area_sqm = float(data.get("area_sqm", 1000))

    ndvi = 0.4 + 0.3*math.sin(math.radians(lat+lon))
    ndvi = round(max(0.1, min(0.7, ndvi)), 2)

    band = climate_band(lat)
    preferred = CLIMATE_SPECIES.get(band, [])

    response = {
        "input": {"lat": lat, "lon": lon, "area_sqm": area_sqm, "ndvi": ndvi},
        "recommendation": {
            "species": ["Tectona grandis (Teak)", "Syzygium cumini (Jamun)"],
            "density_per_hectare": 1600,
            "pattern": "mixed clusters"
        },
        "preferred_by_climate": {
            "climate_band": band,
            "species": preferred
        }
    }
    return jsonify(response)
