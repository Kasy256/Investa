"""
Analytics routes
"""

from flask import Blueprint, request, jsonify, current_app
from app.services.analytics_service import AnalyticsService
from app.services.user_service import UserService
from app.middleware.auth_middleware import require_auth, get_current_user_id
import logging

logger = logging.getLogger(__name__)

analytics_bp = Blueprint('analytics', __name__)


@analytics_bp.route('/portfolio', methods=['GET'])
@require_auth
def get_portfolio_analytics():
    """
    Get portfolio analytics for user
    
    Returns:
        Portfolio analytics data
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        analytics_service = AnalyticsService(current_app.mongo.db)
        analytics = analytics_service.generate_portfolio_analytics(user.id)
        
        if not analytics:
            return jsonify({'error': 'Failed to generate analytics'}), 500
        
        return jsonify({
            'success': True,
            'analytics': analytics.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting portfolio analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@analytics_bp.route('/rooms', methods=['GET'])
@require_auth
def get_room_performance():
    """
    Get room performance data for user
    
    Returns:
        List of room performance data
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        analytics_service = AnalyticsService(current_app.mongo.db)
        room_performance = analytics_service.get_room_performance(user.id)
        
        return jsonify({
            'success': True,
            'room_performance': [room.dict() for room in room_performance]
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting room performance: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@analytics_bp.route('/performance', methods=['GET'])
@require_auth
def get_performance_metrics():
    """
    Get performance metrics for charts
    
    Query parameters:
        - time_range: Time range (1M, 3M, 6M, 1Y) (default: 6M)
    
    Returns:
        Performance metrics data
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Get query parameters
        time_range = request.args.get('time_range', '6M')
        
        # Validate time range
        valid_ranges = ['1M', '3M', '6M', '1Y']
        if time_range not in valid_ranges:
            return jsonify({'error': 'Invalid time range. Must be one of: 1M, 3M, 6M, 1Y'}), 400
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        analytics_service = AnalyticsService(current_app.mongo.db)
        metrics = analytics_service.get_performance_metrics(user.id, time_range)
        
        if not metrics:
            return jsonify({'error': 'Failed to get performance metrics'}), 500
        
        return jsonify({
            'success': True,
            'metrics': metrics
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting performance metrics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@analytics_bp.route('/dashboard', methods=['GET'])
@require_auth
def get_dashboard_data():
    """
    Get comprehensive dashboard data
    
    Returns:
        Combined dashboard analytics
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        analytics_service = AnalyticsService(current_app.mongo.db)
        
        # Get all analytics data
        portfolio_analytics = analytics_service.generate_portfolio_analytics(user.id)
        room_performance = analytics_service.get_room_performance(user.id)
        performance_metrics = analytics_service.get_performance_metrics(user.id, '6M')
        
        # Get user stats
        user_stats = user_service.get_user_stats(user.id)
        
        dashboard_data = {
            'portfolio': portfolio_analytics.dict() if portfolio_analytics else None,
            'room_performance': [room.dict() for room in room_performance],
            'performance_metrics': performance_metrics,
            'user_stats': user_stats
        }
        
        return jsonify({
            'success': True,
            'dashboard': dashboard_data
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting dashboard data: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
