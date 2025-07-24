from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import secrets
import hashlib
from loguru import logger
from server import users_collection, pwd_context
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import os

router = APIRouter(prefix="/api/auth", tags=["Password Reset"])

# Email configuration (would be set via environment variables)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@zarver.com")

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

def generate_reset_token() -> str:
    """Generate a secure password reset token"""
    return secrets.token_urlsafe(32)

def hash_token(token: str) -> str:
    """Hash the token for secure storage"""
    return hashlib.sha256(token.encode()).hexdigest()

async def send_password_reset_email(email: str, reset_token: str):
    """Send password reset email (background task)"""
    try:
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            logger.warning("SMTP credentials not configured, password reset email not sent")
            return

        # Create message
        msg = MimeMultipart()
        msg['From'] = FROM_EMAIL
        msg['To'] = email
        msg['Subject'] = "Zarver - Şifre Sıfırlama"

        # Email body (Turkish)
        body = f"""
        Merhaba,

        Zarver hesabınız için şifre sıfırlama talebinde bulundunuz.
        
        Şifrenizi sıfırlamak için aşağıdaki kodu kullanın:
        
        Sıfırlama Kodu: {reset_token}
        
        Bu kod 1 saat boyunca geçerlidir.
        
        Eğer bu talebi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.
        
        Saygılarımızla,
        Zarver Ekibi
        """

        msg.attach(MimeText(body, 'plain', 'utf-8'))

        # Send email
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info(f"Password reset email sent to: {email}")

    except Exception as e:
        logger.error(f"Failed to send password reset email to {email}: {e}")

@router.post("/password-reset/request", 
             summary="Request Password Reset",
             description="Şifre sıfırlama talebinde bulunur ve e-posta gönderir")
async def request_password_reset(
    reset_request: PasswordResetRequest,
    background_tasks: BackgroundTasks
):
    try:
        # Check if user exists
        user = users_collection.find_one({"email": reset_request.email})
        
        # Always return success to prevent email enumeration
        # But only send email if user exists
        if user:
            # Generate reset token
            reset_token = generate_reset_token()
            hashed_token = hash_token(reset_token)
            
            # Store reset token in database (expires in 1 hour)
            expire_time = datetime.now() + timedelta(hours=1)
            users_collection.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "password_reset_token": hashed_token,
                        "password_reset_expires": expire_time
                    }
                }
            )
            
            # Send email in background
            background_tasks.add_task(
                send_password_reset_email,
                reset_request.email,
                reset_token
            )
            
            logger.info(f"Password reset requested for: {reset_request.email}")
        else:
            logger.warning(f"Password reset requested for non-existent email: {reset_request.email}")

        return {
            "message": "Eğer bu e-posta adresi sistemde kayıtlıysa, şifre sıfırlama kodu gönderilmiştir.",
            "success": True
        }

    except Exception as e:
        logger.error(f"Password reset request error: {e}")
        raise HTTPException(status_code=500, detail="Şifre sıfırlama talebi işlenirken bir hata oluştu")

@router.post("/password-reset/confirm",
             summary="Confirm Password Reset", 
             description="Şifre sıfırlama kodunu doğrular ve yeni şifre belirler")
async def confirm_password_reset(reset_confirm: PasswordResetConfirm):
    try:
        # Hash the provided token
        hashed_token = hash_token(reset_confirm.token)
        
        # Find user with valid reset token
        user = users_collection.find_one({
            "password_reset_token": hashed_token,
            "password_reset_expires": {"$gt": datetime.now()}
        })
        
        if not user:
            logger.warning(f"Invalid or expired password reset token attempted")
            raise HTTPException(
                status_code=400, 
                detail="Geçersiz veya süresi dolmuş sıfırlama kodu"
            )
        
        # Validate new password
        if len(reset_confirm.new_password) < 6:
            raise HTTPException(
                status_code=400,
                detail="Yeni şifre en az 6 karakter olmalıdır"
            )
        
        # Hash new password
        hashed_password = pwd_context.hash(reset_confirm.new_password)
        
        # Update user password and clear reset token
        users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password": hashed_password,
                    "password_changed_at": datetime.now()
                },
                "$unset": {
                    "password_reset_token": "",
                    "password_reset_expires": ""
                }
            }
        )
        
        logger.info(f"Password successfully reset for user: {user['email']}")
        
        return {
            "message": "Şifreniz başarıyla güncellendi",
            "success": True
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset confirmation error: {e}")
        raise HTTPException(status_code=500, detail="Şifre güncelleme sırasında bir hata oluştu")

# Include this router in your main app:
# app.include_router(password_reset.router)