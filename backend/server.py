from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pymongo import MongoClient
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import json
import asyncio
import random
from emergentintegrations.llm.chat import LlmChat, UserMessage
import uuid

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
JWT_SECRET = "zarver_secret_key_2024"
JWT_ALGORITHM = "HS256"
GEMINI_API_KEY = "AIzaSyC6dkkM1DEyTMzYuBCkm9kSK-zlx1Pp1eU"

# MongoDB setup
client = MongoClient(MONGO_URL)
db = client.zarver_db

# Collections
users_collection = db.users
decisions_collection = db.decisions
messages_collection = db.messages
follows_collection = db.follows
notifications_collection = db.notifications

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="Zarver API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class DecisionCreate(BaseModel):
    text: str
    is_public: bool = True

class MessageCreate(BaseModel):
    recipient_id: str
    content: str

class FollowAction(BaseModel):
    user_id: str

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

manager = ConnectionManager()

# Utility Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=30)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = users_collection.find_one({"_id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def generate_decision_alternatives(decision_text: str) -> List[str]:
    """Gemini ile karar alternatiflerı üret"""
    try:
        session_id = f"decision_{uuid.uuid4()}"
        
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=session_id,
            system_message="""Sen bir karar danışmanısın. Kullanıcının kararsızlık yaşadığı durumlar için 4 adet pratik, akılcı ve farklı alternatif üretmelisin. 

KURALLARIN:
1. Tam olarak 4 alternatif üret
2. Her alternatif kısa ve net olsun (max 15 kelime)
3. Alternatifler birbirinden farklı yaklaşımlar olsun
4. Türkçe dilinde yanıtla
5. Sadece alternatifleri listele, başka açıklama yapma
6. Her alternatifi yeni satırda yaz
7. Numaralandırma yapma, sadece alternatifleri yaz"""
        ).with_model("gemini", "gemini-2.0-flash")

        user_message = UserMessage(
            text=f"Bu kararsızlık durumu için 4 farklı alternatif üret: {decision_text}"
        )

        response = await chat.send_message(user_message)
        
        # Response'u satırlara böl ve temizle
        alternatives = []
        lines = response.strip().split('\n')
        
        for line in lines:
            clean_line = line.strip()
            # Numaraları ve özel karakterleri temizle
            clean_line = clean_line.lstrip('0123456789.- ')
            if clean_line and len(clean_line) > 3:
                alternatives.append(clean_line)
        
        # Tam olarak 4 alternatif olmasını sağla
        if len(alternatives) < 4:
            alternatives.extend([
                "Biraz daha düşün",
                "Arkadaşlarına danış", 
                "Başka seçenekleri araştır",
                "Kalbin ne diyor dinle"
            ])
        
        return alternatives[:4]
        
    except Exception as e:
        print(f"Gemini API Error: {e}")
        # Fallback alternatives
        return [
            "İlk seçeneğini dene",
            "Alternatif bir yol bul", 
            "Biraz bekle ve düşün",
            "Cesaretini topla ve karar ver"
        ]

# API Endpoints

@app.get("/api/")
async def root():
    return {"message": "Zarver API is running!"}

@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    if users_collection.find_one({"email": user_data.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if users_collection.find_one({"username": user_data.username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user_data.password)
    
    user_doc = {
        "_id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "name": user_data.name,
        "password": hashed_password,
        "avatar": f"https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?w=150&h=150&fit=crop&crop=face",
        "created_at": datetime.now(),
        "stats": {
            "total_decisions": 0,
            "implemented_decisions": 0,
            "success_rate": 0,
            "followers": 0,
            "following": 0
        }
    }
    
    users_collection.insert_one(user_doc)
    
    # Create access token
    access_token = create_access_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": user_data.username,
            "name": user_data.name,
            "email": user_data.email,
            "avatar": user_doc["avatar"]
        }
    }

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    user = users_collection.find_one({"email": user_data.email})
    
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["_id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["_id"],
            "username": user["username"],
            "name": user["name"],
            "email": user["email"],
            "avatar": user["avatar"],
            "stats": user.get("stats", {})
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "email": current_user["email"],
        "avatar": current_user["avatar"],
        "stats": current_user.get("stats", {})
    }

@app.post("/api/decisions/create")
async def create_decision(decision_data: DecisionCreate, current_user: dict = Depends(get_current_user)):
    # Generate alternatives using Gemini
    alternatives = await generate_decision_alternatives(decision_data.text)
    
    decision_id = str(uuid.uuid4())
    decision_doc = {
        "_id": decision_id,
        "user_id": current_user["_id"],
        "text": decision_data.text,
        "alternatives": alternatives,
        "is_public": decision_data.is_public,
        "created_at": datetime.now(),
        "dice_result": None,
        "selected_option": None,
        "implemented": None
    }
    
    decisions_collection.insert_one(decision_doc)
    
    return {
        "decision_id": decision_id,
        "alternatives": alternatives
    }

@app.post("/api/decisions/{decision_id}/roll")
async def roll_dice(decision_id: str, current_user: dict = Depends(get_current_user)):
    decision = decisions_collection.find_one({"_id": decision_id, "user_id": current_user["_id"]})
    
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    # Roll dice (1-4 for 4 alternatives)
    dice_result = random.randint(1, 4)
    selected_option = decision["alternatives"][dice_result - 1]
    
    # Update decision
    decisions_collection.update_one(
        {"_id": decision_id},
        {
            "$set": {
                "dice_result": dice_result,
                "selected_option": selected_option,
                "rolled_at": datetime.now()
            }
        }
    )
    
    return {
        "dice_result": dice_result,
        "selected_option": selected_option
    }

@app.post("/api/decisions/{decision_id}/implement")
async def mark_implemented(decision_id: str, implemented: bool, current_user: dict = Depends(get_current_user)):
    decision = decisions_collection.find_one({"_id": decision_id, "user_id": current_user["_id"]})
    
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    
    # Update decision
    decisions_collection.update_one(
        {"_id": decision_id},
        {
            "$set": {
                "implemented": implemented,
                "implemented_at": datetime.now()
            }
        }
    )
    
    # Update user stats
    user_stats = current_user.get("stats", {})
    total_decisions = user_stats.get("total_decisions", 0) + 1
    implemented_decisions = user_stats.get("implemented_decisions", 0)
    
    if implemented:
        implemented_decisions += 1
    
    success_rate = int((implemented_decisions / total_decisions) * 100) if total_decisions > 0 else 0
    
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "stats.total_decisions": total_decisions,
                "stats.implemented_decisions": implemented_decisions,
                "stats.success_rate": success_rate
            }
        }
    )
    
    return {"success": True, "implemented": implemented}

@app.get("/api/decisions/history")
async def get_decision_history(current_user: dict = Depends(get_current_user)):
    decisions = list(decisions_collection.find(
        {"user_id": current_user["_id"]},
        {"password": 0}
    ).sort("created_at", -1))
    
    # Convert ObjectId to string and format dates
    for decision in decisions:
        decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d")
        if "rolled_at" in decision:
            decision["rolled_at"] = decision["rolled_at"].strftime("%Y-%m-%d %H:%M")
    
    return decisions

@app.get("/api/decisions/public")
async def get_public_decisions(skip: int = 0, limit: int = 20):
    decisions = list(decisions_collection.find(
        {"is_public": True, "dice_result": {"$ne": None}},
        {"user_id": 1, "text": 1, "selected_option": 1, "implemented": 1, "created_at": 1}
    ).sort("created_at", -1).skip(skip).limit(limit))
    
    # Get user info for each decision
    for decision in decisions:
        user = users_collection.find_one({"_id": decision["user_id"]}, {"name": 1, "username": 1, "avatar": 1})
        decision["user"] = user
        decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d")
    
    return decisions

@app.post("/api/messages/send")
async def send_message(message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    message_id = str(uuid.uuid4())
    message_doc = {
        "_id": message_id,
        "sender_id": current_user["_id"],
        "recipient_id": message_data.recipient_id,
        "content": message_data.content,
        "created_at": datetime.now(),
        "read": False
    }
    
    messages_collection.insert_one(message_doc)
    
    # Send real-time notification
    await manager.send_personal_message(
        json.dumps({
            "type": "new_message",
            "from": current_user["name"],
            "content": message_data.content
        }),
        message_data.recipient_id
    )
    
    return {"success": True, "message_id": message_id}

@app.get("/api/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    # Get all conversations for current user
    pipeline = [
        {
            "$match": {
                "$or": [
                    {"sender_id": current_user["_id"]},
                    {"recipient_id": current_user["_id"]}
                ]
            }
        },
        {
            "$sort": {"created_at": -1}
        },
        {
            "$group": {
                "_id": {
                    "$cond": [
                        {"$eq": ["$sender_id", current_user["_id"]]},
                        "$recipient_id",
                        "$sender_id"
                    ]
                },
                "last_message": {"$first": "$$ROOT"}
            }
        }
    ]
    
    conversations = list(messages_collection.aggregate(pipeline))
    
    # Get user details for each conversation
    result = []
    for conv in conversations:
        other_user_id = conv["_id"]
        other_user = users_collection.find_one({"_id": other_user_id}, {"name": 1, "username": 1, "avatar": 1})
        
        if other_user:
            unread_count = messages_collection.count_documents({
                "sender_id": other_user_id,
                "recipient_id": current_user["_id"],
                "read": False
            })
            
            result.append({
                "user": other_user,
                "last_message": conv["last_message"]["content"],
                "time": conv["last_message"]["created_at"].strftime("%H:%M"),
                "unread": unread_count
            })
    
    return result

@app.get("/api/messages/chat/{user_id}")
async def get_chat_messages(user_id: str, current_user: dict = Depends(get_current_user)):
    messages = list(messages_collection.find({
        "$or": [
            {"sender_id": current_user["_id"], "recipient_id": user_id},
            {"sender_id": user_id, "recipient_id": current_user["_id"]}
        ]
    }).sort("created_at", 1))
    
    # Mark messages as read
    messages_collection.update_many(
        {"sender_id": user_id, "recipient_id": current_user["_id"]},
        {"$set": {"read": True}}
    )
    
    # Format messages
    for message in messages:
        message["sender"] = "me" if message["sender_id"] == current_user["_id"] else "other"
        message["time"] = message["created_at"].strftime("%H:%M")
    
    return messages

@app.get("/api/users/search")
async def search_users(q: str, current_user: dict = Depends(get_current_user)):
    users = list(users_collection.find(
        {
            "$and": [
                {"_id": {"$ne": current_user["_id"]}},
                {
                    "$or": [
                        {"name": {"$regex": q, "$options": "i"}},
                        {"username": {"$regex": q, "$options": "i"}}
                    ]
                }
            ]
        },
        {"name": 1, "username": 1, "avatar": 1}
    ).limit(20))
    
    return users

@app.post("/api/users/follow")
async def follow_user(follow_data: FollowAction, current_user: dict = Depends(get_current_user)):
    if follow_data.user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    # Check if already following
    existing_follow = follows_collection.find_one({
        "follower_id": current_user["_id"],
        "following_id": follow_data.user_id
    })
    
    if existing_follow:
        raise HTTPException(status_code=400, detail="Already following this user")
    
    # Create follow relationship
    follow_doc = {
        "_id": str(uuid.uuid4()),
        "follower_id": current_user["_id"],
        "following_id": follow_data.user_id,
        "created_at": datetime.now()
    }
    
    follows_collection.insert_one(follow_doc)
    
    # Update stats
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"stats.following": 1}}
    )
    
    users_collection.update_one(
        {"_id": follow_data.user_id},
        {"$inc": {"stats.followers": 1}}
    )
    
    return {"success": True}

@app.delete("/api/users/unfollow/{user_id}")
async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    result = follows_collection.delete_one({
        "follower_id": current_user["_id"],
        "following_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=400, detail="Not following this user")
    
    # Update stats
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"stats.following": -1}}
    )
    
    users_collection.update_one(
        {"_id": user_id},
        {"$inc": {"stats.followers": -1}}
    )
    
    return {"success": True}

@app.get("/api/users/{user_id}/followers")
async def get_followers(user_id: str):
    followers = list(follows_collection.find({"following_id": user_id}))
    
    result = []
    for follow in followers:
        user = users_collection.find_one({"_id": follow["follower_id"]}, {"name": 1, "username": 1, "avatar": 1})
        if user:
            result.append(user)
    
    return result

@app.get("/api/users/{user_id}/following")
async def get_following(user_id: str):
    following = list(follows_collection.find({"follower_id": user_id}))
    
    result = []
    for follow in following:
        user = users_collection.find_one({"_id": follow["following_id"]}, {"name": 1, "username": 1, "avatar": 1})
        if user:
            result.append(user)
    
    return result

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages if needed
    except WebSocketDisconnect:
        manager.disconnect(user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)