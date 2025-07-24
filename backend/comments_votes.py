from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from server import get_current_user, decisions_collection, users_collection
from loguru import logger
import uuid

router = APIRouter(prefix="/api", tags=["Comments & Votes"])

# MongoDB collections (would be defined in main server.py)
from server import db
comments_collection = db.comments
votes_collection = db.votes

class CommentCreate(BaseModel):
    decision_id: str = Field(..., description="Decision ID to comment on")
    content: str = Field(..., min_length=1, max_length=500, description="Comment content")

class VoteAction(BaseModel):
    decision_id: str = Field(..., description="Decision ID to vote on")
    vote_type: str = Field(..., description="Vote type: 'helpful' or 'unhelpful'")

class CommentResponse(BaseModel):
    id: str
    user_id: str
    username: str
    user_avatar: str
    content: str
    created_at: str
    likes: int

@router.post("/decisions/{decision_id}/comments",
             summary="Add Comment",
             description="Karara yorum ekler")
async def add_comment(
    decision_id: str,
    comment_data: CommentCreate,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Check if decision exists and is public
        decision = decisions_collection.find_one({
            "_id": decision_id,
            "is_public": True
        })
        
        if not decision:
            raise HTTPException(status_code=404, detail="Karar bulunamadı veya herkese açık değil")
        
        # Create comment
        comment_id = str(uuid.uuid4())
        comment_doc = {
            "_id": comment_id,
            "decision_id": decision_id,
            "user_id": current_user["_id"],
            "content": comment_data.content,
            "created_at": datetime.now(),
            "likes": 0,
            "is_deleted": False
        }
        
        comments_collection.insert_one(comment_doc)
        
        logger.info(f"Comment added by user {current_user['username']} to decision {decision_id}")
        
        return {
            "comment_id": comment_id,
            "message": "Yorum başarıyla eklendi"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add comment error: {e}")
        raise HTTPException(status_code=500, detail="Yorum eklenirken bir hata oluştu")

@router.get("/decisions/{decision_id}/comments",
            summary="Get Decision Comments",
            description="Kararın yorumlarını getirir",
            response_model=List[CommentResponse])
async def get_decision_comments(decision_id: str):
    try:
        # Check if decision exists and is public
        decision = decisions_collection.find_one({
            "_id": decision_id,
            "is_public": True
        })
        
        if not decision:
            raise HTTPException(status_code=404, detail="Karar bulunamadı veya herkese açık değil")
        
        # Get comments with user info
        pipeline = [
            {
                "$match": {
                    "decision_id": decision_id,
                    "is_deleted": False
                }
            },
            {
                "$lookup": {
                    "from": "users",
                    "localField": "user_id",
                    "foreignField": "_id",
                    "as": "user"
                }
            },
            {
                "$unwind": "$user"
            },
            {
                "$sort": {"created_at": -1}
            },
            {
                "$project": {
                    "_id": 1,
                    "content": 1,
                    "created_at": 1,
                    "likes": 1,
                    "user_id": 1,
                    "username": "$user.username",
                    "user_avatar": "$user.avatar"
                }
            }
        ]
        
        comments = list(comments_collection.aggregate(pipeline))
        
        # Format response
        formatted_comments = []
        for comment in comments:
            formatted_comments.append({
                "id": comment["_id"],
                "user_id": comment["user_id"],
                "username": comment["username"],
                "user_avatar": comment["user_avatar"],
                "content": comment["content"],
                "created_at": comment["created_at"].strftime("%Y-%m-%d %H:%M"),
                "likes": comment["likes"]
            })
        
        return formatted_comments

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get comments error: {e}")
        raise HTTPException(status_code=500, detail="Yorumlar getirilemedi")

@router.post("/decisions/{decision_id}/vote",
             summary="Vote on Decision",
             description="Karara oy verir (yararlı/yararsız)")
async def vote_on_decision(
    decision_id: str,
    vote_data: VoteAction,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Check if decision exists and is public
        decision = decisions_collection.find_one({
            "_id": decision_id,
            "is_public": True
        })
        
        if not decision:
            raise HTTPException(status_code=404, detail="Karar bulunamadı veya herkese açık değil")
        
        # Validate vote type
        if vote_data.vote_type not in ["helpful", "unhelpful"]:
            raise HTTPException(status_code=400, detail="Geçersiz oy tipi")
        
        # Check if user already voted
        existing_vote = votes_collection.find_one({
            "user_id": current_user["_id"],
            "decision_id": decision_id
        })
        
        if existing_vote:
            # Update existing vote
            votes_collection.update_one(
                {"_id": existing_vote["_id"]},
                {
                    "$set": {
                        "vote_type": vote_data.vote_type,
                        "updated_at": datetime.now()
                    }
                }
            )
            message = "Oyunuz güncellendi"
        else:
            # Create new vote
            vote_doc = {
                "_id": str(uuid.uuid4()),
                "user_id": current_user["_id"],
                "decision_id": decision_id,
                "vote_type": vote_data.vote_type,
                "created_at": datetime.now()
            }
            votes_collection.insert_one(vote_doc)
            message = "Oyunuz kaydedildi"
        
        # Calculate vote stats
        helpful_count = votes_collection.count_documents({
            "decision_id": decision_id,
            "vote_type": "helpful"
        })
        
        unhelpful_count = votes_collection.count_documents({
            "decision_id": decision_id,
            "vote_type": "unhelpful"
        })
        
        # Update decision with vote counts
        decisions_collection.update_one(
            {"_id": decision_id},
            {
                "$set": {
                    "vote_stats": {
                        "helpful": helpful_count,
                        "unhelpful": unhelpful_count,
                        "total": helpful_count + unhelpful_count
                    }
                }
            }
        )
        
        logger.info(f"Vote cast by user {current_user['username']} on decision {decision_id}: {vote_data.vote_type}")
        
        return {
            "message": message,
            "vote_stats": {
                "helpful": helpful_count,
                "unhelpful": unhelpful_count,
                "total": helpful_count + unhelpful_count
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vote error: {e}")
        raise HTTPException(status_code=500, detail="Oy verme sırasında bir hata oluştu")

@router.get("/decisions/{decision_id}/votes",
            summary="Get Decision Vote Stats",
            description="Kararın oy istatistiklerini getirir")
async def get_decision_votes(decision_id: str):
    try:
        # Check if decision exists and is public
        decision = decisions_collection.find_one({
            "_id": decision_id,
            "is_public": True
        })
        
        if not decision:
            raise HTTPException(status_code=404, detail="Karar bulunamadı veya herkese açık değil")
        
        # Get vote statistics
        helpful_count = votes_collection.count_documents({
            "decision_id": decision_id,
            "vote_type": "helpful"
        })
        
        unhelpful_count = votes_collection.count_documents({
            "decision_id": decision_id,
            "vote_type": "unhelpful"
        })
        
        total_votes = helpful_count + unhelpful_count
        helpful_percentage = int((helpful_count / total_votes) * 100) if total_votes > 0 else 0
        
        return {
            "vote_stats": {
                "helpful": helpful_count,
                "unhelpful": unhelpful_count,
                "total": total_votes,
                "helpful_percentage": helpful_percentage
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get votes error: {e}")
        raise HTTPException(status_code=500, detail="Oy istatistikleri getirilemedi")

@router.delete("/comments/{comment_id}",
               summary="Delete Comment",
               description="Yorumu siler (sadece yorum sahibi)")
async def delete_comment(
    comment_id: str,
    current_user: dict = Depends(get_current_user)
):
    try:
        # Find comment
        comment = comments_collection.find_one({"_id": comment_id})
        
        if not comment:
            raise HTTPException(status_code=404, detail="Yorum bulunamadı")
        
        # Check if user owns the comment
        if comment["user_id"] != current_user["_id"]:
            raise HTTPException(status_code=403, detail="Bu yorumu silemezsiniz")
        
        # Soft delete comment
        comments_collection.update_one(
            {"_id": comment_id},
            {
                "$set": {
                    "is_deleted": True,
                    "deleted_at": datetime.now()
                }
            }
        )
        
        logger.info(f"Comment {comment_id} deleted by user {current_user['username']}")
        
        return {"message": "Yorum başarıyla silindi"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete comment error: {e}")
        raise HTTPException(status_code=500, detail="Yorum silinirken bir hata oluştu")

# Include this router in your main app:
# app.include_router(comments_votes.router)