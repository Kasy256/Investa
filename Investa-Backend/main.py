"""
Investa Backend - Investment Platform API
Production-ready Flask backend with Firebase Auth and MongoDB
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
from dotenv import load_dotenv
import os
import firebase_admin
from firebase_admin import credentials
from datetime import datetime

# Load environment variables
load_dotenv()

def create_app():
    """Create and configure Flask application"""
    app = Flask(__name__)
    
    # Core configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['MONGO_URI'] = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/investa_db')
    
    # CORS setup
    cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')
    CORS(app, origins=cors_origins, supports_credentials=True)
    
    # Initialize services
    mongo = PyMongo(app)
    app.mongo = mongo
    
    initialize_firebase()
    
    # Register API blueprints
    register_blueprints(app)
    
    # Error handlers
    register_error_handlers(app)
    
    # Health check
    @app.route('/health')
    def health_check():
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0'
        })
    
    return app

def register_blueprints(app):
    """Register all API blueprints"""
    from app.routes.auth import auth_bp
    from app.routes.users import users_bp
    from app.routes.wallet import wallet_bp
    from app.routes.rooms import rooms_bp
    from app.routes.contributions import contributions_bp
    from app.routes.analytics import analytics_bp
    from app.routes.paystack import paystack_bp
    from app.routes.investments import investments_bp
    
    api_prefix = os.getenv('API_PREFIX', '/api/v1')
    
    app.register_blueprint(auth_bp, url_prefix=f'{api_prefix}/auth')
    app.register_blueprint(users_bp, url_prefix=f'{api_prefix}/users')
    app.register_blueprint(wallet_bp, url_prefix=f'{api_prefix}/wallet')
    app.register_blueprint(rooms_bp, url_prefix=f'{api_prefix}/rooms')
    app.register_blueprint(contributions_bp, url_prefix=f'{api_prefix}/contributions')
    app.register_blueprint(analytics_bp, url_prefix=f'{api_prefix}/analytics')
    app.register_blueprint(paystack_bp, url_prefix=f'{api_prefix}/paystack')
    app.register_blueprint(investments_bp, url_prefix=f'{api_prefix}/investments')

def register_error_handlers(app):
    """Register global error handlers"""
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request', 'message': str(error)}), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized', 'message': 'Authentication required'}), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden', 'message': 'Access denied'}), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found', 'message': 'Resource not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error', 'message': 'Something went wrong'}), 500

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        credentials_path = os.getenv('FIREBASE_CREDENTIALS_PATH')
        project_id = os.getenv('FIREBASE_PROJECT_ID')
        
        if credentials_path and os.path.exists(credentials_path):
            cred = credentials.Certificate(credentials_path)
            
            if project_id:
                firebase_admin.initialize_app(cred, {'projectId': project_id})
            else:
                firebase_admin.initialize_app(cred)
        else:
            raise FileNotFoundError(f"Firebase credentials not found: {credentials_path}")
            
    except Exception as e:
        print(f"Firebase initialization failed: {e}")
        raise

if __name__ == '__main__':
    app = create_app()
    
    debug = os.getenv('FLASK_ENV') == 'development'
    host = os.getenv('HOST', '0.0.0.0')
    port = int(os.getenv('PORT', 5000))
    
    print(f"🚀 Starting Investa Backend Server...")
    print(f"🌐 Server: http://{host}:{port}")
    print(f"🔧 Debug: {debug}")
    
    app.run(debug=debug, host=host, port=port)
