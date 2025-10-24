
from pymongo import MongoClient
from werkzeug.security import generate_password_hash

MONGO_URI = "mongodb://localhost:27017/verdantia"
client = MongoClient(MONGO_URI)
db = client.get_default_database()

def upsert_user(username, password, role):
    u = db.users.find_one({"username": username})
    if u:
        db.users.update_one({"_id": u["_id"]}, {"$set": {"role": role, "password_hash": generate_password_hash(password)}})
    else:
        db.users.insert_one({"username": username, "password_hash": generate_password_hash(password), "role": role, "points": 0})
    print(f"seeded: {username}/{password} role={role}")

if __name__ == "__main__":
    upsert_user("user1","user123","user")
    upsert_user("gov1","gov123","government")
    print("Done.")
