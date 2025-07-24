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
    
    def test_user_registration(self):
        """Test 2: Register a test user"""
        try:
            # Generate unique test user data
            timestamp = str(int(datetime.now().timestamp()))
            test_user = {
                "username": f"testuser_{timestamp}",
                "email": f"test_{timestamp}@zaradam.com",
                "password": "TestPassword123!",
                "name": f"Test User {timestamp}",
                "privacy_agreement": True
            }
            
            response = requests.post(f"{self.base_url}/auth/register", json=test_user)
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                self.user_id = data.get("user", {}).get("id")
                
                if self.access_token and self.user_id:
                    self.log_test("User Registration", True, "User registered successfully", 
                                {"user_id": self.user_id, "username": test_user["username"]})
                else:
                    self.log_test("User Registration", False, "Missing token or user_id", 
                                {"response": data})
            else:
                self.log_test("User Registration", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Registration", False, f"Request failed: {str(e)}")
    
    def test_user_login(self):
        """Test 3: Login with test user (alternative flow)"""
        if not self.access_token:
            self.log_test("User Login", False, "Skipped - no registered user")
            return
            
        try:
            # Test getting current user info to verify token works
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("User Authentication", True, "Token authentication works", 
                            {"user_info": data})
            else:
                self.log_test("User Authentication", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("User Authentication", False, f"Request failed: {str(e)}")
    
    def test_profile_photo_upload(self):
        """Test 4: Upload profile photo with base64 data"""
        if not self.access_token:
            self.log_test("Profile Photo Upload", False, "Skipped - no authenticated user")
            return
            
        try:
            # Create a simple base64 encoded test image (1x1 pixel PNG)
            test_image_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            
            headers = {"Authorization": f"Bearer {self.access_token}"}
            photo_data = {"photo_data": test_image_base64}
            
            response = requests.post(f"{self.base_url}/auth/upload-profile-photo", 
                                   json=photo_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "avatar" in data:
                    self.log_test("Profile Photo Upload", True, "Photo uploaded successfully", 
                                {"message": data.get("message"), "has_avatar": bool(data.get("avatar"))})
                else:
                    self.log_test("Profile Photo Upload", False, "Unexpected response format", 
                                {"response": data})
            else:
                self.log_test("Profile Photo Upload", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Profile Photo Upload", False, f"Request failed: {str(e)}")
    
    def test_profile_update(self):
        """Test 5: Update user profile information"""
        if not self.access_token:
            self.log_test("Profile Update", False, "Skipped - no authenticated user")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            update_data = {
                "name": "Updated Test User Name",
                "avatar": "https://example.com/new-avatar.jpg"
            }
            
            response = requests.put(f"{self.base_url}/auth/update-profile", 
                                  json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "user" in data:
                    user_data = data["user"]
                    if user_data.get("name") == update_data["name"]:
                        self.log_test("Profile Update", True, "Profile updated successfully", 
                                    {"updated_name": user_data.get("name")})
                    else:
                        self.log_test("Profile Update", False, "Name not updated correctly", 
                                    {"expected": update_data["name"], "actual": user_data.get("name")})
                else:
                    self.log_test("Profile Update", False, "Unexpected response format", 
                                {"response": data})
            else:
                self.log_test("Profile Update", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Profile Update", False, f"Request failed: {str(e)}")
    
    def test_decision_creation_with_privacy_levels(self):
        """Test 6: Create decisions with different privacy levels"""
        if not self.access_token:
            self.log_test("Decision Privacy Levels", False, "Skipped - no authenticated user")
            return
            
        privacy_levels = ["public", "followers", "private"]
        headers = {"Authorization": f"Bearer {self.access_token}"}
        
        for privacy_level in privacy_levels:
            try:
                decision_data = {
                    "text": f"Should I test {privacy_level} privacy level?",
                    "privacy_level": privacy_level
                }
                
                response = requests.post(f"{self.base_url}/decisions/create", 
                                       json=decision_data, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if "decision_id" in data and "alternatives" in data:
                        self.log_test(f"Decision Creation ({privacy_level})", True, 
                                    f"Decision created with {privacy_level} privacy", 
                                    {"decision_id": data["decision_id"], 
                                     "alternatives_count": len(data.get("alternatives", []))})
                    else:
                        self.log_test(f"Decision Creation ({privacy_level})", False, 
                                    "Missing decision_id or alternatives", 
                                    {"response": data})
                else:
                    self.log_test(f"Decision Creation ({privacy_level})", False, 
                                f"HTTP {response.status_code}", 
                                {"response": response.text})
                    
            except Exception as e:
                self.log_test(f"Decision Creation ({privacy_level})", False, 
                            f"Request failed: {str(e)}")
    
    def test_decision_history_with_privacy(self):
        """Test 7: Get decision history and verify privacy levels are returned"""
        if not self.access_token:
            self.log_test("Decision History Privacy", False, "Skipped - no authenticated user")
            return
            
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = requests.get(f"{self.base_url}/decisions/history", headers=headers)
            
            if response.status_code == 200:
                decisions = response.json()
                if isinstance(decisions, list):
                    privacy_levels_found = []
                    for decision in decisions:
                        if "privacy_level" in decision:
                            privacy_levels_found.append(decision["privacy_level"])
                    
                    if privacy_levels_found:
                        unique_levels = list(set(privacy_levels_found))
                        self.log_test("Decision History Privacy", True, 
                                    "Privacy levels returned in history", 
                                    {"total_decisions": len(decisions), 
                                     "privacy_levels_found": unique_levels})
                    else:
                        self.log_test("Decision History Privacy", False, 
                                    "No privacy_level field found in decisions", 
                                    {"decisions_count": len(decisions)})
                else:
                    self.log_test("Decision History Privacy", False, 
                                "Response is not a list", 
                                {"response_type": type(decisions)})
            else:
                self.log_test("Decision History Privacy", False, f"HTTP {response.status_code}", 
                            {"response": response.text})
                
        except Exception as e:
            self.log_test("Decision History Privacy", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Zaradam Backend API Tests")
        print("=" * 50)
        
        # Test sequence as requested
        self.test_root_endpoint()
        self.test_user_registration()
        self.test_user_login()
        self.test_profile_photo_upload()
        self.test_profile_update()
        self.test_decision_creation_with_privacy_levels()
        self.test_decision_history_with_privacy()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
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
        
        return self.test_results

if __name__ == "__main__":
    tester = ZaradamAPITester()
    results = tester.run_all_tests()
    
    # Save results to file
    with open("/app/test_results_backend.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\n📁 Detailed results saved to: /app/test_results_backend.json")