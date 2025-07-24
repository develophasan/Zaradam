import pytest
import pytest_asyncio
from httpx import AsyncClient
from fastapi.testclient import TestClient
from server import app
import json

# Test client
client = TestClient(app)

class TestAPI:
    """API test suite for Zarver backend"""
    
    def test_health_check(self):
        """Test API health check endpoint"""
        response = client.get("/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "status" in data
        assert data["status"] == "healthy"

    def test_user_registration_success(self):
        """Test successful user registration"""
        import random
        random_num = random.randint(1000, 9999)
        user_data = {
            "username": f"testuser{random_num}",
            "email": f"test{random_num}@example.com",
            "password": "testpass123",
            "name": "Test User",
            "privacy_agreement": True
        }
        response = client.post("/api/auth/register", json=user_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["username"] == user_data["username"]
        assert data["user"]["email"] == user_data["email"]

    def test_user_registration_without_privacy_agreement(self):
        """Test user registration without privacy agreement"""
        user_data = {
            "username": "testuser456",
            "email": "test456@example.com", 
            "password": "testpass123",
            "name": "Test User",
            "privacy_agreement": False
        }
        response = client.post("/api/auth/register", json=user_data)
        assert response.status_code == 400
        assert "sözleşmesi kabul edilmelidir" in response.json()["detail"]

    def test_user_registration_duplicate_email(self):
        """Test user registration with duplicate email"""
        user_data = {
            "username": "testuser789",
            "email": "test123@example.com",  # Same email as first test
            "password": "testpass123", 
            "name": "Test User",
            "privacy_agreement": True
        }
        response = client.post("/api/auth/register", json=user_data)
        assert response.status_code == 400
        assert "zaten kayıtlı" in response.json()["detail"]

    def test_user_login_success(self):
        """Test successful user login"""
        login_data = {
            "email": "test123@example.com",
            "password": "testpass123"
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        return data["access_token"]  # Return token for other tests

    def test_user_login_invalid_credentials(self):
        """Test user login with invalid credentials"""
        login_data = {
            "email": "test123@example.com",
            "password": "wrongpassword"
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == 401
        assert "Geçersiz" in response.json()["detail"]

    def test_admin_login_success(self):
        """Test successful admin login"""
        admin_data = {
            "username": "admin",
            "password": "Hasan-1288"
        }
        response = client.post("/api/auth/admin/login", json=admin_data)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["is_admin"] == True
        return data["access_token"]  # Return admin token

    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        admin_data = {
            "username": "admin",
            "password": "wrongpassword"
        }
        response = client.post("/api/auth/admin/login", json=admin_data)
        assert response.status_code == 401

    def test_get_current_user(self):
        """Test getting current user info"""
        # First login to get token
        login_data = {
            "email": "test123@example.com", 
            "password": "testpass123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        # Test /me endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "username" in data
        assert "email" in data
        assert "stats" in data

    def test_create_decision(self):
        """Test creating a decision"""
        # Login first
        login_data = {
            "email": "test123@example.com",
            "password": "testpass123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        # Create decision
        decision_data = {
            "text": "Bu akşam ne yapmalıyım? Evde kalmak mı yoksa dışarı çıkmak mı?",
            "is_public": True
        }
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post("/api/decisions/create", json=decision_data, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "decision_id" in data
        assert "alternatives" in data
        assert len(data["alternatives"]) == 4
        return data["decision_id"], token

    def test_roll_dice(self):
        """Test rolling dice for a decision"""
        decision_id, token = self.test_create_decision()
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.post(f"/api/decisions/{decision_id}/roll", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "dice_result" in data
        assert "selected_option" in data
        assert 1 <= data["dice_result"] <= 4

    def test_mark_decision_implemented(self):
        """Test marking decision as implemented"""
        decision_id, token = self.test_create_decision()
        
        # First roll dice
        headers = {"Authorization": f"Bearer {token}"}
        client.post(f"/api/decisions/{decision_id}/roll", headers=headers)
        
        # Mark as implemented
        response = client.post(f"/api/decisions/{decision_id}/implement?implemented=true", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["implemented"] == True

    def test_get_decision_history(self):
        """Test getting decision history"""
        # Create a decision first
        self.test_create_decision()
        
        login_data = {
            "email": "test123@example.com",
            "password": "testpass123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/decisions/history", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_admin_dashboard(self):
        """Test admin dashboard access"""
        # Login as admin
        admin_data = {
            "username": "admin",
            "password": "Hasan-1288"
        }
        admin_response = client.post("/api/auth/admin/login", json=admin_data)
        admin_token = admin_response.json()["access_token"]
        
        # Access dashboard
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = client.get("/api/admin/dashboard", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert "stats" in data
        assert "recent_users" in data
        assert "total_users" in data["stats"]

    def test_unauthorized_admin_access(self):
        """Test unauthorized access to admin endpoints"""
        # Try to access admin dashboard without admin token
        login_data = {
            "email": "test123@example.com",
            "password": "testpass123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        user_token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {user_token}"}
        response = client.get("/api/admin/dashboard", headers=headers)
        assert response.status_code == 403

    def test_token_blacklisting_on_logout(self):
        """Test token blacklisting on logout"""
        # Login
        login_data = {
            "email": "test123@example.com",
            "password": "testpass123"
        }
        login_response = client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Verify token works
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 200
        
        # Logout
        logout_response = client.post("/api/auth/logout", headers=headers)
        assert logout_response.status_code == 200
        
        # Try to use token after logout - should fail
        response = client.get("/api/auth/me", headers=headers)
        assert response.status_code == 401

if __name__ == "__main__":
    pytest.main([__file__, "-v"])