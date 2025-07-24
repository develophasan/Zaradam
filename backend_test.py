#!/usr/bin/env python3
"""
Zaradam Backend API Test Suite
Tests all functionality including messaging and notification system APIs.
"""

import requests
import json
import base64
import uuid
import time
from datetime import datetime

# Get backend URL from frontend .env
BACKEND_URL = "https://48ddba30-6746-414b-a048-15f5858a2a51.preview.emergentagent.com/api"

class ZaradamAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.access_token_a = None
        self.user_id_a = None
        self.access_token_b = None
        self.user_id_b = None
        self.test_results = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {},
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details:
            print(f"   Details: {details}")
    
    def test_root_endpoint(self):
        """Test 1: Verify root endpoint returns Zaradam"""
        try:
            response = requests.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                data = response.json()
                if "Zaradam" in data.get("message", ""):
                    self.log_test("Root Endpoint", True, "API returns Zaradam correctly", 
                                {"response": data})
                else:
                    self.log_test("Root Endpoint", False, "API doesn't return Zaradam", 
                                {"response": data})
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Request failed: {str(e)}")
    
    def register_test_user(self, suffix="a"):
        """Register a test user and return credentials"""
        try:
            # Generate unique test user data
            timestamp = str(int(datetime.now().timestamp()))
            test_user = {
                "username": f"testuser_{suffix}_{timestamp}",
                "email": f"test_{suffix}_{timestamp}@zaradam.com",
                "password": "TestPassword123!",
                "name": f"Test User {suffix.upper()} {timestamp}",
                "privacy_agreement": True
            }
            
            response = requests.post(f"{self.base_url}/auth/register", json=test_user)
            
            if response.status_code == 200:
                data = response.json()
                access_token = data.get("access_token")
                user_id = data.get("user", {}).get("id")
                
                if access_token and user_id:
                    self.log_test(f"User Registration ({suffix.upper()})", True, "User registered successfully", 
                                {"user_id": user_id, "username": test_user["username"]})
                    return access_token, user_id, test_user
                else:
                    self.log_test(f"User Registration ({suffix.upper()})", False, "Missing token or user_id", 
                                {"response": data})
                    return None, None, None
            else:
                self.log_test(f"User Registration ({suffix.upper()})", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                return None, None, None
                
        except Exception as e:
            self.log_test(f"User Registration ({suffix.upper()})", False, f"Request failed: {str(e)}")
            return None, None, None
    
    def test_user_search(self):
        """Test user search functionality"""
        if not self.access_token_a or not self.access_token_b:
            self.log_test("User Search", False, "Skipped - missing authenticated users")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token_a}"}
            # Search for user B using partial name
            response = requests.get(f"{self.base_url}/users/search?q=Test User B", headers=headers)
            
            if response.status_code == 200:
                users = response.json()
                if isinstance(users, list) and len(users) > 0:
                    # Check if user B is in results
                    found_user_b = any(user.get("_id") == self.user_id_b for user in users)
                    if found_user_b:
                        self.log_test("User Search", True, "User search working correctly", 
                                    {"results_count": len(users), "found_target": True})
                    else:
                        self.log_test("User Search", False, "Target user not found in search results", 
                                    {"results_count": len(users), "user_ids": [u.get("_id") for u in users]})
                else:
                    self.log_test("User Search", False, "No search results returned", 
                                {"response": users})
            else:
                self.log_test("User Search", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Search", False, f"Request failed: {str(e)}")
    
    def test_follow_system(self):
        """Test follow and unfollow functionality"""
        if not self.access_token_a or not self.access_token_b:
            self.log_test("Follow System", False, "Skipped - missing authenticated users")
            return
            
        # Test User A follows User B
        try:
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            follow_data = {"target_user_id": self.user_id_b}
            
            response = requests.post(f"{self.base_url}/users/follow", json=follow_data, headers=headers_a)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Follow User", True, "User A successfully followed User B", 
                                {"message": data.get("message")})
                else:
                    self.log_test("Follow User", False, "Follow request failed", 
                                {"response": data})
            else:
                self.log_test("Follow User", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Follow User", False, f"Request failed: {str(e)}")
        
        # Test User B follows User A (for mutual follow)
        try:
            headers_b = {"Authorization": f"Bearer {self.access_token_b}"}
            follow_data = {"target_user_id": self.user_id_a}
            
            response = requests.post(f"{self.base_url}/users/follow", json=follow_data, headers=headers_b)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    self.log_test("Mutual Follow", True, "User B successfully followed User A", 
                                {"message": data.get("message")})
                else:
                    self.log_test("Mutual Follow", False, "Mutual follow request failed", 
                                {"response": data})
            else:
                self.log_test("Mutual Follow", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Mutual Follow", False, f"Request failed: {str(e)}")
    
    def test_message_sending(self):
        """Test message sending functionality"""
        if not self.access_token_a or not self.access_token_b:
            self.log_test("Message Sending", False, "Skipped - missing authenticated users")
            return
            
        try:
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            message_data = {
                "recipient_id": self.user_id_b,
                "content": "Hello from User A! This is a test message."
            }
            
            response = requests.post(f"{self.base_url}/messages/send", json=message_data, headers=headers_a)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "message_id" in data:
                    self.message_id = data["message_id"]
                    self.log_test("Message Sending", True, "Message sent successfully", 
                                {"message_id": self.message_id})
                else:
                    self.log_test("Message Sending", False, "Message sending failed", 
                                {"response": data})
            else:
                self.log_test("Message Sending", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Message Sending", False, f"Request failed: {str(e)}")
    
    def test_conversations_list(self):
        """Test conversations list functionality"""
        if not self.access_token_a or not self.access_token_b:
            self.log_test("Conversations List", False, "Skipped - missing authenticated users")
            return
            
        # Test for User A
        try:
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            response = requests.get(f"{self.base_url}/messages/conversations", headers=headers_a)
            
            if response.status_code == 200:
                conversations = response.json()
                if isinstance(conversations, list) and len(conversations) > 0:
                    # Check if conversation with User B exists
                    found_conversation = any(
                        conv.get("partner", {}).get("id") == self.user_id_b 
                        for conv in conversations
                    )
                    if found_conversation:
                        self.log_test("Conversations List (User A)", True, "Conversations retrieved successfully", 
                                    {"conversations_count": len(conversations)})
                    else:
                        self.log_test("Conversations List (User A)", False, "Expected conversation not found", 
                                    {"conversations_count": len(conversations)})
                else:
                    self.log_test("Conversations List (User A)", False, "No conversations found", 
                                {"response": conversations})
            else:
                self.log_test("Conversations List (User A)", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Conversations List (User A)", False, f"Request failed: {str(e)}")
        
        # Test for User B
        try:
            headers_b = {"Authorization": f"Bearer {self.access_token_b}"}
            response = requests.get(f"{self.base_url}/messages/conversations", headers=headers_b)
            
            if response.status_code == 200:
                conversations = response.json()
                if isinstance(conversations, list) and len(conversations) > 0:
                    # Check if conversation with User A exists
                    found_conversation = any(
                        conv.get("partner", {}).get("id") == self.user_id_a 
                        for conv in conversations
                    )
                    if found_conversation:
                        self.log_test("Conversations List (User B)", True, "Conversations retrieved successfully", 
                                    {"conversations_count": len(conversations)})
                    else:
                        self.log_test("Conversations List (User B)", False, "Expected conversation not found", 
                                    {"conversations_count": len(conversations)})
                else:
                    self.log_test("Conversations List (User B)", False, "No conversations found", 
                                {"response": conversations})
            else:
                self.log_test("Conversations List (User B)", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Conversations List (User B)", False, f"Request failed: {str(e)}")
    
    def test_conversation_messages(self):
        """Test conversation messages retrieval"""
        if not self.access_token_a or not self.access_token_b:
            self.log_test("Conversation Messages", False, "Skipped - missing authenticated users")
            return
            
        try:
            headers_b = {"Authorization": f"Bearer {self.access_token_b}"}
            response = requests.get(f"{self.base_url}/messages/conversation/{self.user_id_a}", headers=headers_b)
            
            if response.status_code == 200:
                messages = response.json()
                if isinstance(messages, list) and len(messages) > 0:
                    # Check if our test message is there
                    found_message = any(
                        "Hello from User A" in msg.get("content", "") 
                        for msg in messages
                    )
                    if found_message:
                        self.log_test("Conversation Messages", True, "Messages retrieved successfully", 
                                    {"messages_count": len(messages)})
                    else:
                        self.log_test("Conversation Messages", False, "Expected message not found", 
                                    {"messages_count": len(messages), "messages": [m.get("content") for m in messages]})
                else:
                    self.log_test("Conversation Messages", False, "No messages found", 
                                {"response": messages})
            else:
                self.log_test("Conversation Messages", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Conversation Messages", False, f"Request failed: {str(e)}")
    
    def test_notifications_retrieval(self):
        """Test notifications retrieval"""
        if not self.access_token_b:
            self.log_test("Notifications Retrieval", False, "Skipped - missing authenticated user B")
            return
            
        try:
            headers_b = {"Authorization": f"Bearer {self.access_token_b}"}
            response = requests.get(f"{self.base_url}/notifications", headers=headers_b)
            
            if response.status_code == 200:
                notifications = response.json()
                if isinstance(notifications, list):
                    # Check for follow and message notifications
                    follow_notification = any(
                        notif.get("type") == "follow" 
                        for notif in notifications
                    )
                    message_notification = any(
                        notif.get("type") == "message" 
                        for notif in notifications
                    )
                    
                    if follow_notification and message_notification:
                        self.log_test("Notifications Retrieval", True, "All expected notifications found", 
                                    {"notifications_count": len(notifications), 
                                     "has_follow": follow_notification, 
                                     "has_message": message_notification})
                    else:
                        self.log_test("Notifications Retrieval", False, "Missing expected notifications", 
                                    {"notifications_count": len(notifications), 
                                     "has_follow": follow_notification, 
                                     "has_message": message_notification})
                else:
                    self.log_test("Notifications Retrieval", False, "Invalid response format", 
                                {"response": notifications})
            else:
                self.log_test("Notifications Retrieval", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Notifications Retrieval", False, f"Request failed: {str(e)}")
    
    def test_unread_notifications_count(self):
        """Test unread notifications count"""
        if not self.access_token_b:
            self.log_test("Unread Notifications Count", False, "Skipped - missing authenticated user B")
            return
            
        try:
            headers_b = {"Authorization": f"Bearer {self.access_token_b}"}
            response = requests.get(f"{self.base_url}/notifications/unread-count", headers=headers_b)
            
            if response.status_code == 200:
                data = response.json()
                if "count" in data and isinstance(data["count"], int):
                    self.unread_count = data["count"]
                    self.log_test("Unread Notifications Count", True, f"Unread count: {self.unread_count}", 
                                {"count": self.unread_count})
                else:
                    self.log_test("Unread Notifications Count", False, "Invalid response format", 
                                {"response": data})
            else:
                self.log_test("Unread Notifications Count", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Unread Notifications Count", False, f"Request failed: {str(e)}")
    
    def test_mark_notification_read(self):
        """Test marking notification as read"""
        if not self.access_token_b:
            self.log_test("Mark Notification Read", False, "Skipped - missing authenticated user B")
            return
            
        try:
            # First get notifications to find one to mark as read
            headers_b = {"Authorization": f"Bearer {self.access_token_b}"}
            response = requests.get(f"{self.base_url}/notifications", headers=headers_b)
            
            if response.status_code == 200:
                notifications = response.json()
                if isinstance(notifications, list) and len(notifications) > 0:
                    # Find an unread notification
                    unread_notification = next(
                        (notif for notif in notifications if not notif.get("read", True)), 
                        None
                    )
                    
                    if unread_notification:
                        notification_id = unread_notification["_id"]
                        
                        # Mark it as read
                        response = requests.put(f"{self.base_url}/notifications/{notification_id}/read", 
                                              headers=headers_b)
                        
                        if response.status_code == 200:
                            data = response.json()
                            if data.get("success"):
                                self.log_test("Mark Notification Read", True, "Notification marked as read", 
                                            {"notification_id": notification_id})
                            else:
                                self.log_test("Mark Notification Read", False, "Failed to mark as read", 
                                            {"response": data})
                        else:
                            self.log_test("Mark Notification Read", False, f"HTTP {response.status_code}", 
                                        {"response": response.text})
                    else:
                        self.log_test("Mark Notification Read", False, "No unread notifications found", 
                                    {"notifications_count": len(notifications)})
                else:
                    self.log_test("Mark Notification Read", False, "No notifications available", 
                                {"response": notifications})
            else:
                self.log_test("Mark Notification Read", False, f"Failed to get notifications: HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Mark Notification Read", False, f"Request failed: {str(e)}")

    def test_user_profile_api_basic(self):
        """Test basic user profile API functionality"""
        if not self.access_token_a or not self.user_id_b:
            self.log_test("User Profile API Basic", False, "Skipped - missing authenticated users")
            return
            
        try:
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            response = requests.get(f"{self.base_url}/users/profile/{self.user_id_b}", headers=headers_a)
            
            if response.status_code == 200:
                profile = response.json()
                
                # Check required fields
                required_fields = ["_id", "username", "name", "email", "avatar", "stats", "created_at"]
                missing_fields = [field for field in required_fields if field not in profile]
                
                if not missing_fields:
                    self.log_test("User Profile API Basic", True, "Profile API returns all required fields", 
                                {"profile_id": profile.get("_id"), "username": profile.get("username")})
                else:
                    self.log_test("User Profile API Basic", False, f"Missing required fields: {missing_fields}", 
                                {"profile": profile})
            else:
                self.log_test("User Profile API Basic", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Profile API Basic", False, f"Request failed: {str(e)}")

    def test_user_profile_follow_status(self):
        """Test user profile API follow status fields"""
        if not self.access_token_a or not self.user_id_b:
            self.log_test("User Profile Follow Status", False, "Skipped - missing authenticated users")
            return
            
        try:
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            response = requests.get(f"{self.base_url}/users/profile/{self.user_id_b}", headers=headers_a)
            
            if response.status_code == 200:
                profile = response.json()
                
                # Check follow status fields
                follow_fields = ["is_following", "follows_back", "can_message"]
                missing_follow_fields = [field for field in follow_fields if field not in profile]
                
                if not missing_follow_fields:
                    # Since we established mutual follow earlier, these should be True
                    is_following = profile.get("is_following")
                    follows_back = profile.get("follows_back") 
                    can_message = profile.get("can_message")
                    
                    if is_following and follows_back and can_message:
                        self.log_test("User Profile Follow Status", True, "All follow status fields correct for mutual follow", 
                                    {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
                    else:
                        self.log_test("User Profile Follow Status", False, "Follow status fields incorrect for mutual follow", 
                                    {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
                else:
                    self.log_test("User Profile Follow Status", False, f"Missing follow status fields: {missing_follow_fields}", 
                                {"profile": profile})
            else:
                self.log_test("User Profile Follow Status", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Profile Follow Status", False, f"Request failed: {str(e)}")

    def test_user_profile_nonexistent_user(self):
        """Test user profile API with non-existent user ID"""
        if not self.access_token_a:
            self.log_test("User Profile Non-existent", False, "Skipped - missing authenticated user")
            return
            
        try:
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            fake_user_id = str(uuid.uuid4())  # Generate a fake UUID
            response = requests.get(f"{self.base_url}/users/profile/{fake_user_id}", headers=headers_a)
            
            if response.status_code == 404:
                self.log_test("User Profile Non-existent", True, "Correctly returns 404 for non-existent user", 
                            {"fake_user_id": fake_user_id})
            else:
                self.log_test("User Profile Non-existent", False, f"Expected 404, got HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Profile Non-existent", False, f"Request failed: {str(e)}")

    def test_user_profile_self_view(self):
        """Test user profile API when viewing own profile"""
        if not self.access_token_a or not self.user_id_a:
            self.log_test("User Profile Self View", False, "Skipped - missing authenticated user")
            return
            
        try:
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            response = requests.get(f"{self.base_url}/users/profile/{self.user_id_a}", headers=headers_a)
            
            if response.status_code == 200:
                profile = response.json()
                
                # When viewing own profile, follow status should be False (can't follow yourself)
                is_following = profile.get("is_following")
                follows_back = profile.get("follows_back")
                can_message = profile.get("can_message")
                
                if not is_following and not follows_back and not can_message:
                    self.log_test("User Profile Self View", True, "Self-profile follow status correctly set to False", 
                                {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
                else:
                    self.log_test("User Profile Self View", False, "Self-profile follow status should be False", 
                                {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
            else:
                self.log_test("User Profile Self View", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Profile Self View", False, f"Request failed: {str(e)}")

    def test_user_profile_no_follow_relationship(self):
        """Test user profile API with no follow relationship"""
        # Create a third user to test no-follow scenario
        try:
            access_token_c, user_id_c, user_c_data = self.register_test_user("c")
            
            if not access_token_c or not self.access_token_a:
                self.log_test("User Profile No Follow", False, "Skipped - failed to create test user C")
                return
                
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            response = requests.get(f"{self.base_url}/users/profile/{user_id_c}", headers=headers_a)
            
            if response.status_code == 200:
                profile = response.json()
                
                # No follow relationship should exist
                is_following = profile.get("is_following")
                follows_back = profile.get("follows_back")
                can_message = profile.get("can_message")
                
                if not is_following and not follows_back and not can_message:
                    self.log_test("User Profile No Follow", True, "No follow relationship correctly detected", 
                                {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
                else:
                    self.log_test("User Profile No Follow", False, "Follow status should be False for no relationship", 
                                {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
            else:
                self.log_test("User Profile No Follow", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Profile No Follow", False, f"Request failed: {str(e)}")

    def test_user_profile_one_way_follow(self):
        """Test user profile API with one-way follow relationship"""
        # Create a fourth user and establish one-way follow
        try:
            access_token_d, user_id_d, user_d_data = self.register_test_user("d")
            
            if not access_token_d or not self.access_token_a:
                self.log_test("User Profile One Way Follow", False, "Skipped - failed to create test user D")
                return
            
            # User A follows User D (but D doesn't follow back)
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            follow_data = {"target_user_id": user_id_d}
            follow_response = requests.post(f"{self.base_url}/users/follow", json=follow_data, headers=headers_a)
            
            if follow_response.status_code != 200:
                self.log_test("User Profile One Way Follow", False, "Failed to establish one-way follow")
                return
            
            # Now check profile
            response = requests.get(f"{self.base_url}/users/profile/{user_id_d}", headers=headers_a)
            
            if response.status_code == 200:
                profile = response.json()
                
                # Should be following but not followed back, so can't message
                is_following = profile.get("is_following")
                follows_back = profile.get("follows_back")
                can_message = profile.get("can_message")
                
                if is_following and not follows_back and not can_message:
                    self.log_test("User Profile One Way Follow", True, "One-way follow relationship correctly detected", 
                                {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
                else:
                    self.log_test("User Profile One Way Follow", False, "One-way follow status incorrect", 
                                {"is_following": is_following, "follows_back": follows_back, "can_message": can_message})
            else:
                self.log_test("User Profile One Way Follow", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Profile One Way Follow", False, f"Request failed: {str(e)}")

    def test_user_profile_integration_with_search(self):
        """Test user profile API integration with user search"""
        if not self.access_token_a:
            self.log_test("User Profile Search Integration", False, "Skipped - missing authenticated user")
            return
            
        try:
            # First search for users
            headers_a = {"Authorization": f"Bearer {self.access_token_a}"}
            search_response = requests.get(f"{self.base_url}/users/search?q=Test User", headers=headers_a)
            
            if search_response.status_code == 200:
                users = search_response.json()
                if isinstance(users, list) and len(users) > 0:
                    # Get profile for first search result
                    first_user = users[0]
                    user_id = first_user.get("_id")
                    
                    profile_response = requests.get(f"{self.base_url}/users/profile/{user_id}", headers=headers_a)
                    
                    if profile_response.status_code == 200:
                        profile = profile_response.json()
                        
                        # Verify profile data matches search result
                        if (profile.get("_id") == first_user.get("_id") and 
                            profile.get("username") == first_user.get("username")):
                            self.log_test("User Profile Search Integration", True, "Profile API integrates correctly with search", 
                                        {"user_id": user_id, "username": profile.get("username")})
                        else:
                            self.log_test("User Profile Search Integration", False, "Profile data doesn't match search result", 
                                        {"search_user": first_user, "profile_user": profile})
                    else:
                        self.log_test("User Profile Search Integration", False, f"Profile API failed: HTTP {profile_response.status_code}", 
                                    {"response": profile_response.text})
                else:
                    self.log_test("User Profile Search Integration", False, "No users found in search", 
                                {"response": users})
            else:
                self.log_test("User Profile Search Integration", False, f"Search API failed: HTTP {search_response.status_code}", 
                            {"response": search_response.text})
                
        except Exception as e:
            self.log_test("User Profile Search Integration", False, f"Request failed: {str(e)}")
    
    def test_root_endpoint(self):
        """Test root endpoint returns Zaradam"""
        try:
            response = requests.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                data = response.json()
                if "Zaradam" in data.get("message", ""):
                    self.log_test("Root Endpoint", True, "API returns Zaradam correctly", 
                                {"response": data})
                else:
                    self.log_test("Root Endpoint", False, "API doesn't return Zaradam", 
                                {"response": data})
            else:
                self.log_test("Root Endpoint", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Root Endpoint", False, f"Request failed: {str(e)}")
    
    def run_messaging_tests(self):
        """Run the complete messaging and notification system test flow"""
        print("🚀 Starting Zaradam Messaging & Notification System Tests")
        print("=" * 60)
        
        # Step 1: Register 2 test users
        print("\n📝 Step 1: Registering test users...")
        self.access_token_a, self.user_id_a, self.user_a_data = self.register_test_user("a")
        time.sleep(1)  # Small delay to ensure different timestamps
        self.access_token_b, self.user_id_b, self.user_b_data = self.register_test_user("b")
        
        if not (self.access_token_a and self.access_token_b):
            print("❌ Failed to register test users. Stopping tests.")
            return
        
        # Step 2: User search functionality
        print("\n🔍 Step 2: Testing user search...")
        self.test_user_search()
        
        # Step 3: Follow system
        print("\n👥 Step 3: Testing follow system...")
        self.test_follow_system()
        
        # Step 4: Message sending
        print("\n💬 Step 4: Testing message sending...")
        self.test_message_sending()
        
        # Step 5: Conversations list
        print("\n📋 Step 5: Testing conversations list...")
        self.test_conversations_list()
        
        # Step 6: Conversation messages
        print("\n💭 Step 6: Testing conversation messages...")
        self.test_conversation_messages()
        
        # Step 7: Notifications retrieval
        print("\n🔔 Step 7: Testing notifications retrieval...")
        self.test_notifications_retrieval()
        
        # Step 8: Unread notifications count
        print("\n📊 Step 8: Testing unread notifications count...")
        self.test_unread_notifications_count()
        
        # Step 9: Mark notification as read
        print("\n✅ Step 9: Testing mark notification as read...")
        self.test_mark_notification_read()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 MESSAGING & NOTIFICATION SYSTEM TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Failed tests details
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return self.test_results

    def run_user_profile_tests(self):
        """Run comprehensive user profile API tests"""
        print("🚀 Starting Zaradam User Profile API Tests")
        print("=" * 60)
        
        # Step 1: Register test users if not already done
        if not (self.access_token_a and self.access_token_b):
            print("\n📝 Step 1: Registering test users...")
            self.access_token_a, self.user_id_a, self.user_a_data = self.register_test_user("a")
            time.sleep(1)
            self.access_token_b, self.user_id_b, self.user_b_data = self.register_test_user("b")
            
            if not (self.access_token_a and self.access_token_b):
                print("❌ Failed to register test users. Stopping tests.")
                return
            
            # Establish mutual follow for testing
            print("\n👥 Setting up mutual follow relationship...")
            self.test_follow_system()
        
        # Step 2: Basic profile API functionality
        print("\n📋 Step 2: Testing basic profile API...")
        self.test_user_profile_api_basic()
        
        # Step 3: Follow status fields
        print("\n🔗 Step 3: Testing follow status fields...")
        self.test_user_profile_follow_status()
        
        # Step 4: Non-existent user handling
        print("\n❌ Step 4: Testing non-existent user handling...")
        self.test_user_profile_nonexistent_user()
        
        # Step 5: Self-profile viewing
        print("\n👤 Step 5: Testing self-profile viewing...")
        self.test_user_profile_self_view()
        
        # Step 6: No follow relationship
        print("\n🚫 Step 6: Testing no follow relationship...")
        self.test_user_profile_no_follow_relationship()
        
        # Step 7: One-way follow relationship
        print("\n➡️ Step 7: Testing one-way follow relationship...")
        self.test_user_profile_one_way_follow()
        
        # Step 8: Integration with search
        print("\n🔍 Step 8: Testing integration with user search...")
        self.test_user_profile_integration_with_search()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 USER PROFILE API TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        # Failed tests details
        failed_tests = [result for result in self.test_results if not result["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['message']}")
        else:
            print("\n✅ ALL TESTS PASSED!")
        
        return self.test_results

if __name__ == "__main__":
    tester = ZaradamAPITester()
    
    # Test the root endpoint first
    tester.test_root_endpoint()
    
    # Run the complete messaging and notification system tests
    results = tester.run_messaging_tests()
    
    # Save results to file
    with open("/app/test_results_messaging.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📁 Detailed results saved to: /app/test_results_messaging.json")