from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, File, UploadFile
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
import base64
import iyzipay
import requests

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
JWT_SECRET = "zaradam_secret_key_2024"
JWT_ALGORITHM = "HS256"
GEMINI_API_KEY = "AIzaSyC6dkkM1DEyTMzYuBCkm9kSK-zlx1Pp1eU"

# İyzico Configuration (Sandbox - Production için değiştirin)
IYZICO_CONFIG = {
    'api_key': os.environ.get('IYZICO_API_KEY', 'sandbox-CxGYgJqgCLWqKJqCKWIJ4P3RCPJJOw8Y'),
    'secret_key': os.environ.get('IYZICO_SECRET_KEY', 'sandbox-1nL8KgLu1Lx7k8KlXgLpCg3yJg4X5c8a'),
    'base_url': 'https://sandbox-api.iyzipay.com'
}

# Admin credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Hasan-1288"

# MongoDB setup
client = MongoClient(MONGO_URL)
db = client.zaradam_db

# Collections
users_collection = db.users
decisions_collection = db.decisions
messages_collection = db.messages
follows_collection = db.follows
notifications_collection = db.notifications
admin_logs_collection = db.admin_logs

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="Zaradam API")

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
    privacy_agreement: bool

class UserLogin(BaseModel):
    email: str
    password: str

class AdminLogin(BaseModel):
    username: str
    password: str

class DecisionCreate(BaseModel):
    text: str
    privacy_level: str = "public"  # "public", "followers", "private"

class MessageCreate(BaseModel):
    recipient_id: str
    content: str

class FollowAction(BaseModel):
    user_id: str

class UserSuspension(BaseModel):
    user_id: str
    reason: str
    duration_days: int

class ProfilePhotoUpload(BaseModel):
    photo_data: str  # base64 encoded image

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None

class NotificationCreate(BaseModel):
    type: str  # "message", "follow", "decision_like", etc.
    content: str
    data: Optional[Dict] = {}

class FollowUser(BaseModel):
    target_user_id: str

class SubscriptionCreate(BaseModel):
    card_holder_name: str
    card_number: str
    expire_month: str
    expire_year: str
    cvc: str
    
class PaymentRequest(BaseModel):
    card_holder_name: str
    card_number: str
    expire_month: str
    expire_year: str
    cvc: str

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

def check_query_limit(current_user: dict):
    """Check if user can make a query"""
    subscription = current_user.get("subscription", {})
    
    # Premium users have unlimited queries
    if subscription.get("is_premium", False):
        return True
    
    # Check daily limit for free users
    today = datetime.now().strftime("%Y-%m-%d")
    last_query_date = subscription.get("last_query_date", "")
    queries_used = subscription.get("queries_used_today", 0)
    
    # Reset daily counter if it's a new day
    if last_query_date != today:
        users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "subscription.queries_used_today": 0,
                "subscription.last_query_date": today
            }}
        )
        queries_used = 0
    
    # Check if user has queries left
    if queries_used >= subscription.get("daily_queries", 3):
        return False
    
    return True

def increment_query_usage(current_user: dict):
    """Increment user's daily query usage"""
    subscription = current_user.get("subscription", {})
    
    # Don't increment for premium users
    if subscription.get("is_premium", False):
        return
    
    today = datetime.now().strftime("%Y-%m-%d")
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {
            "$inc": {"subscription.queries_used_today": 1},
            "$set": {"subscription.last_query_date": today}
        }
    )

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

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        is_admin: bool = payload.get("is_admin", False)
        
        if not is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        return {"user_id": user_id, "is_admin": True}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def log_admin_action(admin_id: str, action: str, target_user_id: str = None, details: Dict = None):
    """Admin aksiyonlarını logla"""
    log_entry = {
        "_id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "action": action,
        "target_user_id": target_user_id,
        "details": details or {},
        "timestamp": datetime.now(),
        "ip_address": "127.0.0.1"  # Production'da gerçek IP alınır
    }
    admin_logs_collection.insert_one(log_entry)

async def generate_decision_alternatives(decision_text: str) -> List[str]:
    """Gemini ile karar alternatifleri üret"""
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
    return {"message": "Zaradam API is running!"}

@app.post("/api/auth/register")
async def register(user_data: UserRegister):
    # Privacy agreement kontrolü
    if not user_data.privacy_agreement:
        raise HTTPException(status_code=400, detail="Kişisel verilerin işlenmesi sözleşmesi kabul edilmelidir")
    
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
        "is_suspended": False,
        "suspension_reason": None,
        "suspension_until": None,
        "privacy_agreement_accepted": True,
        "privacy_agreement_date": datetime.now(),
        "stats": {
            "total_decisions": 0,
            "implemented_decisions": 0,
            "success_rate": 0,
            "followers": 0,
            "following": 0
        },
        "subscription": {
            "daily_queries": 3,
            "queries_used_today": 0,
            "last_query_date": datetime.now().strftime("%Y-%m-%d"),
            "is_premium": False,
            "subscription_id": None,
            "next_payment_date": None,
            "subscription_status": "inactive"
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
    
    # Askıya alınmış kullanıcı kontrolü
    if user.get("is_suspended", False):
        suspension_until = user.get("suspension_until")
        if suspension_until and suspension_until > datetime.now():
            raise HTTPException(
                status_code=403, 
                detail=f"Hesabınız askıya alınmıştır. Süre: {suspension_until.strftime('%Y-%m-%d %H:%M')}"
            )
        elif not suspension_until:
            raise HTTPException(status_code=403, detail="Hesabınız kalıcı olarak askıya alınmıştır")
    
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

@app.post("/api/auth/admin/login")
async def admin_login(admin_data: AdminLogin):
    # Admin credentials kontrolü
    if admin_data.username != ADMIN_USERNAME or admin_data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    # Admin token oluştur
    access_token = create_access_token(data={"sub": "admin", "is_admin": True})
    
    # Admin giriş logla
    log_admin_action("admin", "admin_login", details={"login_time": datetime.now().isoformat()})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": "admin",
            "username": "admin",
            "name": "Admin",
            "is_admin": True
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

@app.post("/api/auth/upload-profile-photo")
async def upload_profile_photo(photo_data: ProfilePhotoUpload, current_user: dict = Depends(get_current_user)):
    """Upload profile photo as base64 encoded image"""
    try:
        # Update user's avatar with base64 data
        users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {"avatar": photo_data.photo_data}}
        )
        
        # Return updated user info
        updated_user = users_collection.find_one({"_id": current_user["_id"]})
        
        return {
            "success": True,
            "message": "Profil fotoğrafı başarıyla güncellendi",
            "avatar": updated_user["avatar"]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fotoğraf yükleme başarısız: {str(e)}")

@app.put("/api/auth/update-profile")
async def update_profile(profile_data: UserProfileUpdate, current_user: dict = Depends(get_current_user)):
    """Update user profile information"""
    try:
        update_data = {}
        if profile_data.name is not None:
            update_data["name"] = profile_data.name
        if profile_data.avatar is not None:
            update_data["avatar"] = profile_data.avatar
            
        if update_data:
            users_collection.update_one(
                {"_id": current_user["_id"]},
                {"$set": update_data}
            )
        
        # Return updated user info
        updated_user = users_collection.find_one({"_id": current_user["_id"]})
        
        return {
            "success": True,
            "message": "Profil başarıyla güncellendi",
            "user": {
                "id": updated_user["_id"],
                "username": updated_user["username"],
                "name": updated_user["name"],
                "email": updated_user["email"],
                "avatar": updated_user["avatar"],
                "stats": updated_user.get("stats", {})
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Profil güncelleme başarısız: {str(e)}")

# MESSAGING ENDPOINTS

@app.post("/api/messages/send")
async def send_message(message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    """Send a message to another user"""
    # Check if recipient exists
    recipient = users_collection.find_one({"_id": message_data.recipient_id})
    if not recipient:
        raise HTTPException(status_code=404, detail="Alıcı bulunamadı")
    
    # Check if users are connected (following each other) for privacy
    sender_follows = follows_collection.find_one({
        "follower_id": current_user["_id"],
        "following_id": message_data.recipient_id
    })
    recipient_follows = follows_collection.find_one({
        "follower_id": message_data.recipient_id,
        "following_id": current_user["_id"]
    })
    
    # Allow messaging if they follow each other
    if not (sender_follows and recipient_follows):
        raise HTTPException(status_code=403, detail="Sadece karşılıklı takip edilen kullanıcılara mesaj gönderebilirsiniz")
    
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
    
    # Create notification
    notification_id = str(uuid.uuid4())
    notification_doc = {
        "_id": notification_id,
        "user_id": message_data.recipient_id,
        "type": "message",
        "content": f"{current_user['name']} size mesaj gönderdi",
        "data": {
            "sender_id": current_user["_id"],
            "sender_name": current_user["name"],
            "message_id": message_id
        },
        "created_at": datetime.now(),
        "read": False
    }
    notifications_collection.insert_one(notification_doc)
    
    # Send real-time notification via WebSocket
    await manager.send_personal_message(
        json.dumps({
            "type": "new_message",
            "data": {
                "message_id": message_id,
                "sender_name": current_user["name"],
                "content": message_data.content
            }
        }),
        message_data.recipient_id
    )
    
    return {"success": True, "message_id": message_id}

@app.get("/api/messages/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    """Get all conversations for current user"""
    # Get all messages where user is sender or recipient
    messages = list(messages_collection.find({
        "$or": [
            {"sender_id": current_user["_id"]},
            {"recipient_id": current_user["_id"]}
        ]
    }).sort("created_at", -1))
    
    # Group by conversation partner
    conversations = {}
    for message in messages:
        partner_id = message["recipient_id"] if message["sender_id"] == current_user["_id"] else message["sender_id"]
        
        if partner_id not in conversations:
            # Get partner info
            partner = users_collection.find_one({"_id": partner_id}, {"password": 0})
            conversations[partner_id] = {
                "partner": {
                    "id": partner["_id"],
                    "name": partner["name"],
                    "username": partner["username"],
                    "avatar": partner["avatar"]
                },
                "last_message": {
                    "content": message["content"],
                    "created_at": message["created_at"].strftime("%Y-%m-%d %H:%M"),
                    "sender_id": message["sender_id"],
                    "read": message["read"]
                },
                "unread_count": 0
            }
        
        # Count unread messages from partner
        if message["sender_id"] == partner_id and not message["read"]:
            conversations[partner_id]["unread_count"] += 1
    
    return list(conversations.values())

@app.get("/api/messages/conversation/{partner_id}")
async def get_conversation_messages(partner_id: str, current_user: dict = Depends(get_current_user), limit: int = 50):
    """Get messages in a specific conversation"""
    messages = list(messages_collection.find({
        "$or": [
            {"sender_id": current_user["_id"], "recipient_id": partner_id},
            {"sender_id": partner_id, "recipient_id": current_user["_id"]}
        ]
    }).sort("created_at", -1).limit(limit))
    
    # Mark messages as read
    messages_collection.update_many(
        {"sender_id": partner_id, "recipient_id": current_user["_id"], "read": False},
        {"$set": {"read": True}}
    )
    
    # Format messages
    formatted_messages = []
    for message in reversed(messages):
        formatted_messages.append({
            "id": message["_id"],
            "sender_id": message["sender_id"],
            "content": message["content"],
            "created_at": message["created_at"].strftime("%Y-%m-%d %H:%M"),
            "read": message["read"],
            "is_own": message["sender_id"] == current_user["_id"]
        })
    
    return formatted_messages

# FOLLOW SYSTEM ENDPOINTS

@app.post("/api/users/follow")
async def follow_user(follow_data: FollowUser, current_user: dict = Depends(get_current_user)):
    """Follow another user"""
    if follow_data.target_user_id == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Kendinizi takip edemezsiniz")
    
    # Check if target user exists
    target_user = users_collection.find_one({"_id": follow_data.target_user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    
    # Check if already following
    existing_follow = follows_collection.find_one({
        "follower_id": current_user["_id"],
        "following_id": follow_data.target_user_id
    })
    
    if existing_follow:
        raise HTTPException(status_code=400, detail="Bu kullanıcıyı zaten takip ediyorsunuz")
    
    # Create follow relationship
    follow_id = str(uuid.uuid4())
    follow_doc = {
        "_id": follow_id,
        "follower_id": current_user["_id"],
        "following_id": follow_data.target_user_id,
        "created_at": datetime.now()
    }
    follows_collection.insert_one(follow_doc)
    
    # Update stats
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"stats.following": 1}}
    )
    users_collection.update_one(
        {"_id": follow_data.target_user_id},
        {"$inc": {"stats.followers": 1}}
    )
    
    # Create notification
    notification_id = str(uuid.uuid4())
    notification_doc = {
        "_id": notification_id,
        "user_id": follow_data.target_user_id,
        "type": "follow",
        "content": f"{current_user['name']} sizi takip etmeye başladı",
        "data": {
            "follower_id": current_user["_id"],
            "follower_name": current_user["name"]
        },
        "created_at": datetime.now(),
        "read": False
    }
    notifications_collection.insert_one(notification_doc)
    
    return {"success": True, "message": "Kullanıcı takip edildi"}

@app.delete("/api/users/unfollow/{target_user_id}")
async def unfollow_user(target_user_id: str, current_user: dict = Depends(get_current_user)):
    """Unfollow a user"""
    follow_record = follows_collection.find_one({
        "follower_id": current_user["_id"],
        "following_id": target_user_id
    })
    
    if not follow_record:
        raise HTTPException(status_code=404, detail="Bu kullanıcıyı takip etmiyorsunuz")
    
    # Remove follow relationship
    follows_collection.delete_one({"_id": follow_record["_id"]})
    
    # Update stats
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$inc": {"stats.following": -1}}
    )
    users_collection.update_one(
        {"_id": target_user_id},
        {"$inc": {"stats.followers": -1}}
    )
    
    return {"success": True, "message": "Takip bırakıldı"}

@app.get("/api/users/search")
async def search_users(q: str, current_user: dict = Depends(get_current_user), limit: int = 20):
    """Search users by name or username"""
    if len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="En az 2 karakter giriniz")
    
    users = list(users_collection.find({
        "$and": [
            {"_id": {"$ne": current_user["_id"]}},  # Exclude current user
            {
                "$or": [
                    {"name": {"$regex": q, "$options": "i"}},
                    {"username": {"$regex": q, "$options": "i"}}
                ]
            }
        ]
    }, {"password": 0}).limit(limit))
    
    # Check follow status for each user
    for user in users:
        follow_status = follows_collection.find_one({
            "follower_id": current_user["_id"],
            "following_id": user["_id"]
        })
        user["is_following"] = bool(follow_status)
        user["created_at"] = user["created_at"].strftime("%Y-%m-%d")
    
    return users

# NOTIFICATIONS ENDPOINTS

@app.get("/api/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user), limit: int = 50):
    """Get user notifications"""
    notifications = list(notifications_collection.find({
        "user_id": current_user["_id"]
    }).sort("created_at", -1).limit(limit))
    
    # Format notifications
    for notification in notifications:
        notification["created_at"] = notification["created_at"].strftime("%Y-%m-%d %H:%M")
    
    return notifications

@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read"""
    notification = notifications_collection.find_one({
        "_id": notification_id,
        "user_id": current_user["_id"]
    })
    
    if not notification:
        raise HTTPException(status_code=404, detail="Bildirim bulunamadı")
    
    notifications_collection.update_one(
        {"_id": notification_id},
        {"$set": {"read": True}}
    )
    
    return {"success": True}

@app.get("/api/notifications/unread-count")
async def get_unread_notifications_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = notifications_collection.count_documents({
        "user_id": current_user["_id"],
        "read": False
    })
    
    return {"count": count}

# SUBSCRIPTION ENDPOINTS

@app.post("/api/subscription/create-payment")
async def create_subscription_payment(payment_data: PaymentRequest, current_user: dict = Depends(get_current_user)):
    """Create İyzico payment for monthly subscription"""
    try:
        # Create payment request
        request = {
            "locale": iyzipay.Locale.TR.value,
            "conversationId": f"sub_{current_user['_id']}_{int(datetime.now().timestamp())}",
            "price": "29.99",
            "paidPrice": "29.99",
            "currency": iyzipay.Currency.TRY.value,
            "installment": 1,
            "basketId": f"basket_{current_user['_id']}",
            "paymentChannel": iyzipay.PaymentChannel.WEB.value,
            "paymentGroup": iyzipay.PaymentGroup.SUBSCRIPTION.value,
            "paymentCard": {
                "cardHolderName": payment_data.card_holder_name,
                "cardNumber": payment_data.card_number,
                "expireMonth": payment_data.expire_month,
                "expireYear": payment_data.expire_year,
                "cvc": payment_data.cvc,
                "registerCard": 0
            },
            "buyer": {
                "id": current_user["_id"],
                "name": current_user["name"].split()[0] if current_user["name"] else "Ad",
                "surname": current_user["name"].split()[-1] if len(current_user["name"].split()) > 1 else "Soyad",
                "gsmNumber": "+905350000000",
                "email": current_user["email"],
                "identityNumber": "74300864791",
                "lastLoginDate": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "registrationDate": current_user["created_at"].strftime("%Y-%m-%d %H:%M:%S"),
                "registrationAddress": "Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1",
                "ip": "85.34.78.112",
                "city": "Istanbul",
                "country": "Turkey",
                "zipCode": "34732"
            },
            "shippingAddress": {
                "contactName": current_user["name"],
                "city": "Istanbul",
                "country": "Turkey",
                "address": "Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1",
                "zipCode": "34732"
            },
            "billingAddress": {
                "contactName": current_user["name"],
                "city": "Istanbul", 
                "country": "Turkey",
                "address": "Nidakule Göztepe, Merdivenköy Mah. Bora Sok. No:1",
                "zipCode": "34732"
            },
            "basketItems": [
                {
                    "id": "premium_subscription",
                    "name": "Zaradam Premium Aylık Abonelik",
                    "category1": "Subscription",
                    "category2": "Premium",
                    "itemType": iyzipay.BasketItemType.VIRTUAL.value,
                    "price": "29.99"
                }
            ]
        }
        
        # Make payment
        payment = iyzipay.Payment()
        payment_result = payment.create(request, IYZICO_CONFIG)
        
        if payment_result.status == "success":
            # Update user subscription
            next_payment_date = datetime.now() + timedelta(days=30)
            users_collection.update_one(
                {"_id": current_user["_id"]},
                {"$set": {
                    "subscription.is_premium": True,
                    "subscription.subscription_id": payment_result.payment_id,
                    "subscription.subscription_status": "active",
                    "subscription.next_payment_date": next_payment_date,
                    "subscription.queries_used_today": 0  # Reset query usage
                }}
            )
            
            return {
                "success": True,
                "payment_id": payment_result.payment_id,
                "message": "Premium aboneliğiniz başarıyla aktifleştirildi! Artık sınırsız sorgu hakkınız var."
            }
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Ödeme başarısız: {payment_result.error_message}"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ödeme işlemi başarısız: {str(e)}")

@app.get("/api/subscription/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get user's subscription status and query limits"""
    subscription = current_user.get("subscription", {})
    
    # Reset daily counter if it's a new day
    today = datetime.now().strftime("%Y-%m-%d")
    if subscription.get("last_query_date", "") != today:
        subscription["queries_used_today"] = 0
        subscription["last_query_date"] = today
        
        users_collection.update_one(
            {"_id": current_user["_id"]},
            {"$set": {
                "subscription.queries_used_today": 0,
                "subscription.last_query_date": today
            }}
        )
    
    return {
        "is_premium": subscription.get("is_premium", False),
        "subscription_status": subscription.get("subscription_status", "inactive"),
        "daily_queries": subscription.get("daily_queries", 3),
        "queries_used_today": subscription.get("queries_used_today", 0),
        "queries_remaining": max(0, subscription.get("daily_queries", 3) - subscription.get("queries_used_today", 0)),
        "next_payment_date": subscription.get("next_payment_date"),
        "can_query": check_query_limit(current_user)
    }

@app.post("/api/subscription/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel user subscription"""
    subscription = current_user.get("subscription", {})
    
    if not subscription.get("is_premium", False):
        raise HTTPException(status_code=400, detail="Aktif aboneliğiniz bulunmuyor")
    
    # Update user subscription status
    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "subscription.is_premium": False,
            "subscription.subscription_status": "cancelled",
            "subscription.subscription_id": None,
            "subscription.next_payment_date": None
        }}
    )
    
    return {
        "success": True,
        "message": "Aboneliğiniz başarıyla iptal edildi. Günlük 3 ücretsiz sorgu hakkınız devam ediyor."
    }

# ADMIN ENDPOINTS

@app.get("/api/admin/dashboard")
async def get_admin_dashboard(admin: dict = Depends(get_admin_user)):
    # Dashboard istatistikleri
    total_users = users_collection.count_documents({})
    active_users = users_collection.count_documents({"is_suspended": {"$ne": True}})
    suspended_users = users_collection.count_documents({"is_suspended": True})
    total_decisions = decisions_collection.count_documents({})
    
    # Son 30 gün kayıt olan kullanıcılar
    thirty_days_ago = datetime.now() - timedelta(days=30)
    new_users_last_30_days = users_collection.count_documents({
        "created_at": {"$gte": thirty_days_ago}
    })
    
    # Son aktif kullanıcılar
    recent_users = list(users_collection.find(
        {},
        {"name": 1, "username": 1, "email": 1, "created_at": 1, "is_suspended": 1}
    ).sort("created_at", -1).limit(10))
    
    for user in recent_users:
        user["created_at"] = user["created_at"].strftime("%Y-%m-%d %H:%M")
    
    return {
        "stats": {
            "total_users": total_users,
            "active_users": active_users,
            "suspended_users": suspended_users,
            "total_decisions": total_decisions,
            "new_users_last_30_days": new_users_last_30_days
        },
        "recent_users": recent_users
    }

@app.get("/api/admin/users")
async def get_all_users(
    admin: dict = Depends(get_admin_user),
    skip: int = 0,
    limit: int = 50,
    search: str = None
):
    # Kullanıcı arama
    query = {}
    if search:
        query = {
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"username": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}}
            ]
        }
    
    users = list(users_collection.find(
        query,
        {"password": 0}
    ).sort("created_at", -1).skip(skip).limit(limit))
    
    # Format dates
    for user in users:
        user["created_at"] = user["created_at"].strftime("%Y-%m-%d %H:%M")
        if user.get("suspension_until"):
            user["suspension_until"] = user["suspension_until"].strftime("%Y-%m-%d %H:%M")
    
    # Log admin action
    log_admin_action("admin", "view_users", details={"search": search, "count": len(users)})
    
    return users

@app.get("/api/admin/users/{user_id}")
async def get_user_details(user_id: str, admin: dict = Depends(get_admin_user)):
    user = users_collection.find_one({"_id": user_id}, {"password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Kullanıcının kararlarını getir
    decisions = list(decisions_collection.find({"user_id": user_id}).sort("created_at", -1).limit(10))
    for decision in decisions:
        decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d %H:%M")
    
    # Format dates
    user["created_at"] = user["created_at"].strftime("%Y-%m-%d %H:%M")
    if user.get("suspension_until"):
        user["suspension_until"] = user["suspension_until"].strftime("%Y-%m-%d %H:%M")
    
    # Log admin action
    log_admin_action("admin", "view_user_details", target_user_id=user_id)
    
    return {
        "user": user,
        "recent_decisions": decisions
    }

@app.post("/api/admin/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    suspension_data: UserSuspension,
    admin: dict = Depends(get_admin_user)
):
    user = users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Askıya alma süresi hesapla
    suspension_until = None
    if suspension_data.duration_days > 0:
        suspension_until = datetime.now() + timedelta(days=suspension_data.duration_days)
    
    # Kullanıcıyı askıya al
    users_collection.update_one(
        {"_id": user_id},
        {
            "$set": {
                "is_suspended": True,
                "suspension_reason": suspension_data.reason,
                "suspension_until": suspension_until,
                "suspended_at": datetime.now()
            }
        }
    )
    
    # Admin action logla
    log_admin_action(
        "admin", 
        "suspend_user", 
        target_user_id=user_id,
        details={
            "reason": suspension_data.reason,
            "duration_days": suspension_data.duration_days,
            "until": suspension_until.isoformat() if suspension_until else "permanent"
        }
    )
    
    return {"success": True, "message": "User suspended successfully"}

@app.post("/api/admin/users/{user_id}/unsuspend")
async def unsuspend_user(user_id: str, admin: dict = Depends(get_admin_user)):
    user = users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Askıyı kaldır
    users_collection.update_one(
        {"_id": user_id},
        {
            "$set": {
                "is_suspended": False,
                "suspension_reason": None,
                "suspension_until": None
            }
        }
    )
    
    # Admin action logla
    log_admin_action("admin", "unsuspend_user", target_user_id=user_id)
    
    return {"success": True, "message": "User suspension removed"}

@app.get("/api/admin/logs")
async def get_admin_logs(
    admin: dict = Depends(get_admin_user),
    skip: int = 0,
    limit: int = 100
):
    logs = list(admin_logs_collection.find({}).sort("timestamp", -1).skip(skip).limit(limit))
    
    # Format timestamps
    for log in logs:
        log["timestamp"] = log["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
    
    return logs

@app.get("/api/admin/export/users")
async def export_user_data(admin: dict = Depends(get_admin_user)):
    """Devlet talep ettiğinde kullanıcı verilerini export et"""
    users = list(users_collection.find({}, {"password": 0}))
    decisions = list(decisions_collection.find({}))
    
    # Format dates for export
    for user in users:
        user["created_at"] = user["created_at"].strftime("%Y-%m-%d %H:%M:%S")
        if user.get("suspension_until"):
            user["suspension_until"] = user["suspension_until"].strftime("%Y-%m-%d %H:%M:%S")
    
    for decision in decisions:
        decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d %H:%M:%S")
    
    export_data = {
        "export_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_users": len(users),
        "total_decisions": len(decisions),
        "users": users,
        "decisions": decisions
    }
    
    # Log critical export action
    log_admin_action(
        "admin", 
        "export_user_data", 
        details={
            "export_type": "full_user_data",
            "user_count": len(users),
            "decision_count": len(decisions),
            "export_timestamp": datetime.now().isoformat()
        }
    )
    
    return export_data

# Normal User Endpoints (existing ones)
@app.post("/api/decisions/create")
async def create_decision(decision_data: DecisionCreate, current_user: dict = Depends(get_current_user)):
    # Check query limit
    if not check_query_limit(current_user):
        subscription = current_user.get("subscription", {})
        queries_used = subscription.get("queries_used_today", 0)
        daily_limit = subscription.get("daily_queries", 3)
        
        raise HTTPException(
            status_code=403, 
            detail=f"Günlük sorgu limitinizi aştınız ({queries_used}/{daily_limit}). Premium üyelik alarak sınırsız sorgu hakkı kazanabilirsiniz."
        )
    
    # Increment query usage
    increment_query_usage(current_user)
    
    # Generate alternatives using Gemini
    alternatives = await generate_decision_alternatives(decision_data.text)
    
    decision_id = str(uuid.uuid4())
    decision_doc = {
        "_id": decision_id,
        "user_id": current_user["_id"],
        "text": decision_data.text,
        "alternatives": alternatives,
        "privacy_level": decision_data.privacy_level,  # "public", "followers", "private"
        "is_public": decision_data.privacy_level == "public",  # backwards compatibility
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
        
        # Handle backwards compatibility for privacy levels
        if "privacy_level" not in decision:
            decision["privacy_level"] = "public" if decision.get("is_public", True) else "private"
    
    return decisions

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