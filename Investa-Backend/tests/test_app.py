"""
Basic tests for the Investa backend application
"""

import pytest
from app import create_app


@pytest.fixture
def app():
    """Create test application"""
    app = create_app()
    app.config['TESTING'] = True
    app.config['MONGODB_URI'] = 'mongodb://localhost:27017/investa_test'
    return app


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


def test_health_check(client):
    """Test health check endpoint"""
    response = client.get('/health')
    assert response.status_code == 200
    
    data = response.get_json()
    assert data['status'] == 'healthy'
    assert 'timestamp' in data
    assert 'version' in data


def test_cors_headers(client):
    """Test CORS headers are present"""
    response = client.get('/health')
    assert 'Access-Control-Allow-Origin' in response.headers


def test_404_error(client):
    """Test 404 error handling"""
    response = client.get('/nonexistent-endpoint')
    assert response.status_code == 404
    
    data = response.get_json()
    assert 'error' in data
    assert data['error'] == 'Not found'
