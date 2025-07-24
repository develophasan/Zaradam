// MongoDB initialization script
print('Initializing Zarver MongoDB...');

// Switch to zarver_db
db = db.getSiblingDB('zarver_db');

// Create collections with indexes
print('Creating collections and indexes...');

// Users collection with indexes
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "created_at": 1 });
db.users.createIndex({ "is_suspended": 1 });
db.users.createIndex({ "suspension_until": 1 }, { expireAfterSeconds: 0 });

// Decisions collection with indexes
db.decisions.createIndex({ "user_id": 1 });
db.decisions.createIndex({ "created_at": 1 });
db.decisions.createIndex({ "is_public": 1 });
db.decisions.createIndex({ "user_id": 1, "created_at": -1 });

// Messages collection with indexes
db.messages.createIndex({ "sender_id": 1 });
db.messages.createIndex({ "recipient_id": 1 });
db.messages.createIndex({ "created_at": 1 });
db.messages.createIndex({ "sender_id": 1, "recipient_id": 1, "created_at": -1 });

// Follows collection with indexes
db.follows.createIndex({ "follower_id": 1 });
db.follows.createIndex({ "following_id": 1 });
db.follows.createIndex({ "follower_id": 1, "following_id": 1 }, { unique: true });

// Admin logs collection with indexes
db.admin_logs.createIndex({ "admin_id": 1 });
db.admin_logs.createIndex({ "timestamp": 1 });
db.admin_logs.createIndex({ "action": 1 });
db.admin_logs.createIndex({ "target_user_id": 1 });

// Token blacklist collection with TTL index
db.token_blacklist.createIndex({ "expires_at": 1 }, { expireAfterSeconds: 0 });
db.token_blacklist.createIndex({ "token_id": 1 }, { unique: true });

// Notifications collection with indexes
db.notifications.createIndex({ "user_id": 1 });
db.notifications.createIndex({ "created_at": 1 });
db.notifications.createIndex({ "read": 1 });
db.notifications.createIndex({ "user_id": 1, "created_at": -1 });

// Comments collection with indexes (for future feature)
db.comments.createIndex({ "decision_id": 1 });
db.comments.createIndex({ "user_id": 1 });
db.comments.createIndex({ "created_at": 1 });

// Votes collection with indexes (for future feature)
db.votes.createIndex({ "decision_id": 1 });
db.votes.createIndex({ "user_id": 1 });
db.votes.createIndex({ "user_id": 1, "decision_id": 1 }, { unique: true });

print('MongoDB initialization completed successfully!');