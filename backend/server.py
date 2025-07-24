from fastapi import FastAPI, HTTPException, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pymongo import MongoClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
from loguru import logger
import os
import json
import asyncio
import random
import uuid
import sys
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Load environment variables
load_dotenv()

# Environment variables
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
JWT_SECRET = os.getenv('JWT_SECRET', 'fallback_secret_key')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')
TOKEN_EXPIRE_DAYS = int(os.getenv('TOKEN_EXPIRE_DAYS', '30'))
RATE_LIMIT_CALLS = int(os.getenv('RATE_LIMIT_CALLS', '100'))
RATE_LIMIT_PERIOD = int(os.getenv('RATE_LIMIT_PERIOD', '3600'))

# Configure logging
logger.remove()
logger.add(sys.stdout, level="INFO", format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}")
logger.add("logs/zarver.log", rotation="1 day", retention="30 days", level="INFO")

# Validate critical environment variables
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables")
    raise Exception("GEMINI_API_KEY is required")

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

# MongoDB setup
try:
    client = MongoClient(MONGO_URL)
    db = client.zarver_db
    logger.info("MongoDB connection established")
except Exception as e:
    logger.error(f"MongoDB connection failed: {e}")
    raise

# Collections
users_collection = db.users
decisions_collection = db.decisions
messages_collection = db.messages
follows_collection = db.follows
notifications_collection = db.notifications
admin_logs_collection = db.admin_logs
token_blacklist_collection = db.token_blacklist

# Create TTL indexes
try:
    # TTL index for suspension_until field
    users_collection.create_index("suspension_until", expireAfterSeconds=0)
    # TTL index for token blacklist (expire after 30 days)
    token_blacklist_collection.create_index("expires_at", expireAfterSeconds=0)
    logger.info("TTL indexes created successfully")
except Exception as e:
    logger.warning(f"TTL index creation failed: {e}")

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(
    title="Zarver API",
    description="Advanced Decision Making Platform with AI Support",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models with improved validation
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=30, description="Unique username")
    email: str = Field(..., description="Valid email address")
    password: str = Field(..., min_length=6, description="Password (min 6 characters)")
    name: str = Field(..., min_length=1, max_length=100, description="Full name")
    privacy_agreement: bool = Field(..., description="Privacy agreement acceptance")

class UserLogin(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., description="User password")

class AdminLogin(BaseModel):
    username: str = Field(..., description="Admin username")
    password: str = Field(..., description="Admin password")

class DecisionCreate(BaseModel):
    text: str = Field(..., min_length=10, max_length=500, description="Decision text")
    is_public: bool = Field(default=True, description="Make decision public")

class MessageCreate(BaseModel):
    recipient_id: str = Field(..., description="Message recipient ID")
    content: str = Field(..., min_length=1, max_length=500, description="Message content")

class FollowAction(BaseModel):
    user_id: str = Field(..., description="User ID to follow/unfollow")

class UserSuspension(BaseModel):
    user_id: str = Field(..., description="User ID to suspend")
    reason: str = Field(..., min_length=5, max_length=200, description="Suspension reason")
    duration_days: int = Field(..., ge=0, le=365, description="Suspension duration in days (0 = permanent)")

class WebSocketMessage(BaseModel):
    type: str = Field(..., description="Message type")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Message payload")
    room: Optional[str] = Field(None, description="Room ID for targeted messages")

# WebSocket Connection Manager with rooms
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, set] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_rooms[user_id] = set()
        logger.info(f"User {user_id} connected to WebSocket")

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_rooms:
            del self.user_rooms[user_id]
        logger.info(f"User {user_id} disconnected from WebSocket")

    async def send_personal_message(self, message: Dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(json.dumps(message))
                logger.info(f"Message sent to user {user_id}")
            except Exception as e:
                logger.error(f"Failed to send message to user {user_id}: {e}")

    async def join_room(self, user_id: str, room: str):
        if user_id in self.user_rooms:
            self.user_rooms[user_id].add(room)
            logger.info(f"User {user_id} joined room {room}")

    async def leave_room(self, user_id: str, room: str):
        if user_id in self.user_rooms:
            self.user_rooms[user_id].discard(room)
            logger.info(f"User {user_id} left room {room}")

    async def broadcast_to_room(self, message: Dict, room: str):
        for user_id, rooms in self.user_rooms.items():
            if room in rooms and user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to broadcast to user {user_id} in room {room}: {e}")

manager = ConnectionManager()

# Utility Functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def is_token_blacklisted(token: str) -> bool:
    """Check if token is blacklisted"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        token_id = payload.get("jti")
        if token_id:
            return token_blacklist_collection.find_one({"token_id": token_id}) is not None
        return False
    except:
        return True

def blacklist_token(token: str):
    """Add token to blacklist"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        token_id = payload.get("jti", str(uuid.uuid4()))
        expires_at = datetime.fromtimestamp(payload.get("exp", 0))
        
        token_blacklist_collection.insert_one({
            "token_id": token_id,
            "blacklisted_at": datetime.now(),
            "expires_at": expires_at
        })
        logger.info(f"Token {token_id} blacklisted")
    except Exception as e:
        logger.error(f"Failed to blacklist token: {e}")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        
        # Check if token is blacklisted
        if is_token_blacklisted(token):
            logger.warning("Attempt to use blacklisted token")
            raise HTTPException(status_code=401, detail="Token has been revoked")
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = users_collection.find_one({"_id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Check if user is suspended
        if user.get("is_suspended", False):
            suspension_until = user.get("suspension_until")
            if suspension_until and suspension_until > datetime.now():
                raise HTTPException(
                    status_code=403, 
                    detail=f"Account suspended until {suspension_until.strftime('%Y-%m-%d %H:%M')}"
                )
            elif not suspension_until:
                raise HTTPException(status_code=403, detail="Account permanently suspended")
        
        return user
    except JWTError as e:
        logger.error(f"JWT Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        
        if is_token_blacklisted(token):
            raise HTTPException(status_code=401, detail="Token has been revoked")
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        is_admin: bool = payload.get("is_admin", False)
        
        if not is_admin:
            logger.warning(f"Non-admin user {user_id} attempted admin access")
            raise HTTPException(status_code=403, detail="Admin access required")
        
        return {"user_id": user_id, "is_admin": True}
    except JWTError as e:
        logger.error(f"Admin JWT Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid admin token")

def log_admin_action(admin_id: str, action: str, target_user_id: str = None, details: Dict = None, ip_address: str = "unknown"):
    """Enhanced admin action logging"""
    try:
        log_entry = {
            "_id": str(uuid.uuid4()),
            "admin_id": admin_id,
            "action": action,
            "target_user_id": target_user_id,
            "details": details or {},
            "timestamp": datetime.now(),
            "ip_address": ip_address
        }
        admin_logs_collection.insert_one(log_entry)
        logger.info(f"Admin action logged: {action} by {admin_id}")
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")

def get_client_ip(request: Request) -> str:
    """Get real client IP address"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"

async def generate_decision_alternatives(decision_text: str) -> List[str]:
    """Enhanced Gemini decision generation with error handling"""
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
        logger.info(f"Gemini API response received for decision: {decision_text[:50]}...")
        
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
        logger.error(f"Gemini API Error: {e}")
        # Enhanced fallback alternatives
        fallback_alternatives = [
            "İlk hissinle git, sezgilerine güven",
            "Durumu objektif gözle analiz et", 
            "Güvendiğin birinden görüş al",
            "Biraz zaman tanı, acele etme"
        ]
        return fallback_alternatives

# API Endpoints with enhanced documentation and error handling

@app.get("/api/", 
         summary="Health Check",
         description="API durumunu kontrol eder",
         response_description="API durum mesajı")
async def root():
    logger.info("Health check endpoint called")
    return {"message": "Zarver API v2.0 is running!", "status": "healthy", "timestamp": datetime.now()}

@app.post("/api/auth/register",
          summary="User Registration", 
          description="Yeni kullanıcı kaydı oluşturur. Kişisel veri sözleşmesi kabulü zorunludur.",
          response_description="Access token ve kullanıcı bilgileri")
@limiter.limit(f"{RATE_LIMIT_CALLS}/{RATE_LIMIT_PERIOD} seconds")
async def register(request: Request, user_data: UserRegister):
    try:
        # Privacy agreement kontrolü
        if not user_data.privacy_agreement:
            logger.warning(f"Registration attempt without privacy agreement: {user_data.email}")
            raise HTTPException(status_code=400, detail="Kişisel verilerin işlenmesi sözleşmesi kabul edilmelidir")
        
        # Check if user exists
        if users_collection.find_one({"email": user_data.email}):
            logger.warning(f"Registration attempt with existing email: {user_data.email}")
            raise HTTPException(status_code=400, detail="Bu e-posta adresi zaten kayıtlı")
        
        if users_collection.find_one({"username": user_data.username}):
            logger.warning(f"Registration attempt with existing username: {user_data.username}")
            raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten alınmış")
        
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
            "last_login": datetime.now(),
            "stats": {
                "total_decisions": 0,
                "implemented_decisions": 0,
                "success_rate": 0,
                "followers": 0,
                "following": 0
            }
        }
        
        users_collection.insert_one(user_doc)
        logger.info(f"New user registered: {user_data.username} ({user_data.email})")
        
        # Create access token with jti for blacklisting
        token_data = {"sub": user_id, "jti": str(uuid.uuid4())}
        access_token = create_access_token(data=token_data)
        
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Kayıt işlemi sırasında bir hata oluştu")

@app.post("/api/auth/login",
          summary="User Login",
          description="Kullanıcı girişi yapar",
          response_description="Access token ve kullanıcı bilgileri")
@limiter.limit(f"{RATE_LIMIT_CALLS}/{RATE_LIMIT_PERIOD} seconds")
async def login(request: Request, user_data: UserLogin):
    try:
        user = users_collection.find_one({"email": user_data.email})
        
        if not user or not verify_password(user_data.password, user["password"]):
            logger.warning(f"Failed login attempt for email: {user_data.email}")
            raise HTTPException(status_code=401, detail="Geçersiz e-posta veya şifre")
        
        # Askıya alınmış kullanıcı kontrolü
        if user.get("is_suspended", False):
            suspension_until = user.get("suspension_until")
            if suspension_until and suspension_until > datetime.now():
                logger.warning(f"Suspended user login attempt: {user_data.email}")
                raise HTTPException(
                    status_code=403, 
                    detail=f"Hesabınız askıya alınmıştır. Süre: {suspension_until.strftime('%Y-%m-%d %H:%M')}"
                )
            elif not suspension_until:
                logger.warning(f"Permanently suspended user login attempt: {user_data.email}")
                raise HTTPException(status_code=403, detail="Hesabınız kalıcı olarak askıya alınmıştır")
        
        # Update last login
        users_collection.update_one(
            {"_id": user["_id"]}, 
            {"$set": {"last_login": datetime.now()}}
        )
        
        token_data = {"sub": user["_id"], "jti": str(uuid.uuid4())}
        access_token = create_access_token(data=token_data)
        
        logger.info(f"Successful login: {user_data.email}")
        
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=500, detail="Giriş işlemi sırasında bir hata oluştu")

@app.post("/api/auth/logout",
          summary="User Logout",
          description="Kullanıcı çıkışı yapar ve token'ı blacklist'e ekler")
async def logout(current_user: dict = Depends(get_current_user), credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        blacklist_token(token)
        logger.info(f"User logged out: {current_user['username']}")
        return {"message": "Başarıyla çıkış yapıldı"}
    except Exception as e:
        logger.error(f"Logout error: {e}")
        raise HTTPException(status_code=500, detail="Çıkış işlemi sırasında bir hata oluştu")

@app.post("/api/auth/admin/login",
          summary="Admin Login",
          description="Admin girişi yapar")
@limiter.limit("10/minute")
async def admin_login(request: Request, admin_data: AdminLogin):
    try:
        # Admin credentials kontrolü
        if admin_data.username != ADMIN_USERNAME or admin_data.password != ADMIN_PASSWORD:
            logger.warning(f"Failed admin login attempt from IP: {get_client_ip(request)}")
            raise HTTPException(status_code=401, detail="Geçersiz admin bilgileri")
        
        # Admin token oluştur
        token_data = {"sub": "admin", "is_admin": True, "jti": str(uuid.uuid4())}
        access_token = create_access_token(data=token_data)
        
        # Admin giriş logla
        log_admin_action(
            "admin", 
            "admin_login", 
            details={"login_time": datetime.now().isoformat()},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"Admin login successful from IP: {get_client_ip(request)}")
        
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
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Admin login error: {e}")
        raise HTTPException(status_code=500, detail="Admin giriş işlemi sırasında bir hata oluştu")

@app.get("/api/auth/me",
         summary="Get Current User",
         description="Mevcut kullanıcı bilgilerini getirir")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "username": current_user["username"],
        "name": current_user["name"],
        "email": current_user["email"],
        "avatar": current_user["avatar"],
        "stats": current_user.get("stats", {}),
        "last_login": current_user.get("last_login")
    }

# Decision endpoints with enhanced functionality
@app.post("/api/decisions/create",
          summary="Create Decision",
          description="Yeni karar oluşturur ve AI ile alternatifler üretir")
@limiter.limit("20/minute")
async def create_decision(request: Request, decision_data: DecisionCreate, current_user: dict = Depends(get_current_user)):
    try:
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
            "implemented": None,
            "user_ip": get_client_ip(request)
        }
        
        decisions_collection.insert_one(decision_doc)
        logger.info(f"Decision created by user {current_user['username']}: {decision_id}")
        
        return {
            "decision_id": decision_id,
            "alternatives": alternatives
        }
    except Exception as e:
        logger.error(f"Decision creation error: {e}")
        raise HTTPException(status_code=500, detail="Karar oluşturma sırasında bir hata oluştu")

@app.post("/api/decisions/{decision_id}/roll",
          summary="Roll Dice",
          description="Karar için zar atar")
async def roll_dice(decision_id: str, current_user: dict = Depends(get_current_user)):
    try:
        decision = decisions_collection.find_one({"_id": decision_id, "user_id": current_user["_id"]})
        
        if not decision:
            raise HTTPException(status_code=404, detail="Karar bulunamadı")
        
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
        
        logger.info(f"Dice rolled by user {current_user['username']} for decision {decision_id}: {dice_result}")
        
        return {
            "dice_result": dice_result,
            "selected_option": selected_option
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dice roll error: {e}")
        raise HTTPException(status_code=500, detail="Zar atma sırasında bir hata oluştu")

@app.post("/api/decisions/{decision_id}/implement",
          summary="Mark Decision Implementation",
          description="Kararın uygulanıp uygulanmadığını işaretler")
async def mark_implemented(decision_id: str, implemented: bool, current_user: dict = Depends(get_current_user)):
    try:
        decision = decisions_collection.find_one({"_id": decision_id, "user_id": current_user["_id"]})
        
        if not decision:
            raise HTTPException(status_code=404, detail="Karar bulunamadı")
        
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
        
        logger.info(f"Decision {decision_id} marked as {'implemented' if implemented else 'not implemented'} by user {current_user['username']}")
        
        return {"success": True, "implemented": implemented}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Implementation marking error: {e}")
        raise HTTPException(status_code=500, detail="İşaretleme sırasında bir hata oluştu")

@app.get("/api/decisions/history",
         summary="Get Decision History",
         description="Kullanıcının karar geçmişini getirir")
async def get_decision_history(current_user: dict = Depends(get_current_user)):
    try:
        decisions = list(decisions_collection.find(
            {"user_id": current_user["_id"]},
            {"user_ip": 0}  # Don't expose IP addresses
        ).sort("created_at", -1))
        
        # Convert dates to strings
        for decision in decisions:
            decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d")
            if "rolled_at" in decision and decision["rolled_at"]:
                decision["rolled_at"] = decision["rolled_at"].strftime("%Y-%m-%d %H:%M")
        
        return decisions
    except Exception as e:
        logger.error(f"Decision history error: {e}")
        raise HTTPException(status_code=500, detail="Geçmiş getirme sırasında bir hata oluştu")

# Admin endpoints with enhanced security and logging
@app.get("/api/admin/dashboard",
         summary="Admin Dashboard",
         description="Admin dashboard istatistiklerini getirir")
async def get_admin_dashboard(request: Request, admin: dict = Depends(get_admin_user)):
    try:
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
            {"name": 1, "username": 1, "email": 1, "created_at": 1, "is_suspended": 1, "last_login": 1}
        ).sort("created_at", -1).limit(10))
        
        for user in recent_users:
            user["created_at"] = user["created_at"].strftime("%Y-%m-%d %H:%M")
            if user.get("last_login"):
                user["last_login"] = user["last_login"].strftime("%Y-%m-%d %H:%M")
        
        # Log admin dashboard access
        log_admin_action(
            "admin", 
            "view_dashboard",
            ip_address=get_client_ip(request)
        )
        
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
    except Exception as e:
        logger.error(f"Admin dashboard error: {e}")
        raise HTTPException(status_code=500, detail="Dashboard verisi alınamadı")

@app.post("/api/admin/users/{user_id}/suspend",
          summary="Suspend User",
          description="Kullanıcıyı askıya alır")
async def suspend_user(
    user_id: str,
    suspension_data: UserSuspension,
    request: Request,
    admin: dict = Depends(get_admin_user)
):
    try:
        user = users_collection.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
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
        
        # Kullanıcının tüm token'larını blacklist'e al
        # Bu implementasyon için kullanıcının aktif token'larını takip etmek gerekir
        # Şimdilik sadece yeni girişleri engelleriz
        
        # Admin action logla
        log_admin_action(
            "admin", 
            "suspend_user", 
            target_user_id=user_id,
            details={
                "reason": suspension_data.reason,
                "duration_days": suspension_data.duration_days,
                "until": suspension_until.isoformat() if suspension_until else "permanent",
                "target_username": user["username"]
            },
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"User {user['username']} suspended by admin for {suspension_data.duration_days} days")
        
        return {"success": True, "message": "Kullanıcı başarıyla askıya alındı"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"User suspension error: {e}")
        raise HTTPException(status_code=500, detail="Askıya alma işlemi başarısız")

# WebSocket endpoint with enhanced message handling
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
                ws_message = WebSocketMessage(**message_data)
                
                # Handle different message types
                if ws_message.type == "join_room":
                    room = ws_message.payload.get("room")
                    if room:
                        await manager.join_room(user_id, room)
                        await manager.send_personal_message({
                            "type": "room_joined",
                            "payload": {"room": room}
                        }, user_id)
                
                elif ws_message.type == "leave_room":
                    room = ws_message.payload.get("room")
                    if room:
                        await manager.leave_room(user_id, room)
                
                elif ws_message.type == "room_message":
                    room = ws_message.room
                    if room:
                        broadcast_message = {
                            "type": "room_message",
                            "payload": {
                                "from": user_id,
                                "message": ws_message.payload.get("message"),
                                "timestamp": datetime.now().isoformat()
                            }
                        }
                        await manager.broadcast_to_room(broadcast_message, room)
                
                logger.info(f"WebSocket message processed: {ws_message.type} from {user_id}")
                
            except json.JSONDecodeError:
                logger.warning(f"Invalid JSON received from WebSocket user {user_id}")
            except Exception as e:
                logger.error(f"WebSocket message handling error: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# Include additional routers
try:
    from password_reset import router as password_reset_router
    from comments_votes import router as comments_votes_router
    
    app.include_router(password_reset_router)
    app.include_router(comments_votes_router)
    logger.info("Additional routers loaded successfully")
except ImportError as e:
    logger.warning(f"Could not load additional routers: {e}")

# Enhanced admin endpoints for export and user management
@app.get("/api/admin/users",
         summary="Get All Users",
         description="Tüm kullanıcıları listeler (admin only)")
async def get_all_users(
    request: Request,
    admin: dict = Depends(get_admin_user),
    skip: int = 0,
    limit: int = 50,
    search: str = None
):
    try:
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
            if user.get("last_login"):
                user["last_login"] = user["last_login"].strftime("%Y-%m-%d %H:%M")
        
        # Log admin action
        log_admin_action(
            "admin", 
            "view_users", 
            details={"search": search, "count": len(users)},
            ip_address=get_client_ip(request)
        )
        
        return users
    except Exception as e:
        logger.error(f"Get all users error: {e}")
        raise HTTPException(status_code=500, detail="Kullanıcı listesi alınamadı")

@app.get("/api/admin/users/{user_id}",
         summary="Get User Details",
         description="Kullanıcı detaylarını getirir (admin only)")
async def get_user_details(
    user_id: str, 
    request: Request,
    admin: dict = Depends(get_admin_user)
):
    try:
        user = users_collection.find_one({"_id": user_id}, {"password": 0})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
        # Kullanıcının kararlarını getir
        decisions = list(decisions_collection.find(
            {"user_id": user_id},
            {"user_ip": 0}  # Don't expose IP
        ).sort("created_at", -1).limit(10))
        
        for decision in decisions:
            decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d %H:%M")
        
        # Format dates
        user["created_at"] = user["created_at"].strftime("%Y-%m-%d %H:%M")
        if user.get("suspension_until"):
            user["suspension_until"] = user["suspension_until"].strftime("%Y-%m-%d %H:%M")
        if user.get("last_login"):
            user["last_login"] = user["last_login"].strftime("%Y-%m-%d %H:%M")
        
        # Log admin action
        log_admin_action(
            "admin", 
            "view_user_details", 
            target_user_id=user_id,
            ip_address=get_client_ip(request)
        )
        
        return {
            "user": user,
            "recent_decisions": decisions
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user details error: {e}")
        raise HTTPException(status_code=500, detail="Kullanıcı detayları alınamadı")

@app.post("/api/admin/users/{user_id}/unsuspend",
          summary="Unsuspend User",
          description="Kullanıcı askısını kaldırır")
async def unsuspend_user(
    user_id: str, 
    request: Request,
    admin: dict = Depends(get_admin_user)
):
    try:
        user = users_collection.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        
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
        log_admin_action(
            "admin", 
            "unsuspend_user", 
            target_user_id=user_id,
            details={"target_username": user["username"]},
            ip_address=get_client_ip(request)
        )
        
        logger.info(f"User {user['username']} unsuspended by admin")
        
        return {"success": True, "message": "Kullanıcı askısı başarıyla kaldırıldı"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unsuspend user error: {e}")
        raise HTTPException(status_code=500, detail="Askı kaldırma işlemi başarısız")

@app.get("/api/admin/logs",
         summary="Get Admin Logs",
         description="Admin işlem loglarını getirir")
async def get_admin_logs(
    request: Request,
    admin: dict = Depends(get_admin_user),
    skip: int = 0,
    limit: int = 100
):
    try:
        logs = list(admin_logs_collection.find({}).sort("timestamp", -1).skip(skip).limit(limit))
        
        # Format timestamps
        for log in logs:
            log["timestamp"] = log["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
        
        return logs
    except Exception as e:
        logger.error(f"Get admin logs error: {e}")
        raise HTTPException(status_code=500, detail="Loglar getirilemedi")

@app.get("/api/admin/export/users",
         summary="Export User Data",
         description="Tüm kullanıcı verilerini export eder (devlet talebi için)")
async def export_user_data(
    request: Request,
    admin: dict = Depends(get_admin_user)
):
    """Devlet talep ettiğinde kullanıcı verilerini export et"""
    try:
        users = list(users_collection.find({}, {"password": 0}))
        decisions = list(decisions_collection.find({}, {"user_ip": 0}))
        
        # Format dates for export
        for user in users:
            user["created_at"] = user["created_at"].strftime("%Y-%m-%d %H:%M:%S")
            if user.get("suspension_until"):
                user["suspension_until"] = user["suspension_until"].strftime("%Y-%m-%d %H:%M:%S")
            if user.get("last_login"):
                user["last_login"] = user["last_login"].strftime("%Y-%m-%d %H:%M:%S")
        
        for decision in decisions:
            decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d %H:%M:%S")
        
        export_data = {
            "export_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "export_id": str(uuid.uuid4()),
            "export_reason": "Legal compliance / Government request",
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
                "export_timestamp": datetime.now().isoformat(),
                "export_id": export_data["export_id"]
            },
            ip_address=get_client_ip(request)
        )
        
        logger.warning(f"CRITICAL: Full user data export performed by admin from IP: {get_client_ip(request)}")
        
        return export_data
    except Exception as e:
        logger.error(f"Export user data error: {e}")
        raise HTTPException(status_code=500, detail="Veri export işlemi başarısız")

# Enhanced public decision feed
@app.get("/api/decisions/public",
         summary="Get Public Decisions",
         description="Herkese açık kararları getirir")
async def get_public_decisions(skip: int = 0, limit: int = 20):
    try:
        decisions = list(decisions_collection.find(
            {"is_public": True, "dice_result": {"$ne": None}},
            {"user_ip": 0}
        ).sort("created_at", -1).skip(skip).limit(limit))
        
        # Get user info for each decision
        for decision in decisions:
            user = users_collection.find_one(
                {"_id": decision["user_id"]}, 
                {"name": 1, "username": 1, "avatar": 1}
            )
            decision["user"] = user
            decision["created_at"] = decision["created_at"].strftime("%Y-%m-%d")
            
            # Add vote stats if available
            decision["vote_stats"] = decision.get("vote_stats", {
                "helpful": 0,
                "unhelpful": 0,
                "total": 0
            })
        
        return decisions
    except Exception as e:
        logger.error(f"Get public decisions error: {e}")
        raise HTTPException(status_code=500, detail="Herkese açık kararlar getirilemedi")

# Daily decision suggestions endpoint
@app.get("/api/decisions/suggestions",
         summary="Get Daily Decision Suggestions",
         description="Günlük rastgele karar önerileri getirir")
async def get_decision_suggestions():
    try:
        suggestions = [
            "Bu hafta sonu hangi filmi izlemeliyim?",
            "Akşam yemeği için ne pişirmeliyim?", 
            "Bugün hangi sporla ilgilenmeliyim?",
            "Hafta sonu tatili için nereye gitmeliyim?",
            "Bu ay hangi kitabı okumalıyım?",
            "Yeni bir hobi olarak neye başlamalıyım?",
            "Arkadaşlarımla hangi oyunu oynamalıyım?",
            "Bugün hangi müzik türünü dinlemeliyim?",
            "Yeni bir dil öğrenmek için hangisini seçmeliyim?",
            "Bu akşam evde mi kalmalıyım yoksa dışarı mı çıkmalıyım?"
        ]
        
        # Return 3 random suggestions
        import random
        daily_suggestions = random.sample(suggestions, 3)
        
        return {
            "suggestions": daily_suggestions,
            "date": datetime.now().strftime("%Y-%m-%d")
        }
    except Exception as e:
        logger.error(f"Get decision suggestions error: {e}")
        raise HTTPException(status_code=500, detail="Öneriler getirilemedi")

# User usage statistics
@app.get("/api/users/{user_id}/stats",
         summary="Get User Statistics",
         description="Kullanıcı istatistiklerini getirir")
async def get_user_stats(user_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Check if user can view these stats (own stats or public profile)
        if user_id != current_user["_id"]:
            target_user = users_collection.find_one({"_id": user_id})
            if not target_user:
                raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
        else:
            target_user = current_user
        
        # Calculate detailed statistics
        total_decisions = decisions_collection.count_documents({"user_id": user_id})
        implemented_decisions = decisions_collection.count_documents({
            "user_id": user_id,
            "implemented": True
        })
        
        public_decisions = decisions_collection.count_documents({
            "user_id": user_id,
            "is_public": True
        })
        
        # Success rate by month (last 6 months)
        monthly_stats = []
        for i in range(6):
            month_start = datetime.now().replace(day=1) - timedelta(days=30*i)
            month_end = month_start + timedelta(days=32)
            month_end = month_end.replace(day=1) - timedelta(days=1)
            
            month_decisions = decisions_collection.count_documents({
                "user_id": user_id,
                "created_at": {"$gte": month_start, "$lte": month_end}
            })
            
            month_implemented = decisions_collection.count_documents({
                "user_id": user_id,
                "implemented": True,
                "created_at": {"$gte": month_start, "$lte": month_end}
            })
            
            success_rate = int((month_implemented / month_decisions) * 100) if month_decisions > 0 else 0
            
            monthly_stats.append({
                "month": month_start.strftime("%Y-%m"),
                "decisions": month_decisions,
                "implemented": month_implemented,
                "success_rate": success_rate
            })
        
        overall_success_rate = int((implemented_decisions / total_decisions) * 100) if total_decisions > 0 else 0
        
        return {
            "user_id": user_id,
            "username": target_user["username"],
            "stats": {
                "total_decisions": total_decisions,
                "implemented_decisions": implemented_decisions,
                "success_rate": overall_success_rate,
                "public_decisions": public_decisions,
                "followers": target_user.get("stats", {}).get("followers", 0),
                "following": target_user.get("stats", {}).get("following", 0)
            },
            "monthly_stats": monthly_stats,
            "member_since": target_user["created_at"].strftime("%Y-%m-%d")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get user stats error: {e}")
        raise HTTPException(status_code=500, detail="İstatistikler getirilemedi")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")