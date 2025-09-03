"""
Room routes
"""

from flask import Blueprint, request, jsonify, current_app
import json
from app.services.room_service import RoomService
from app.services.user_service import UserService
from app.middleware.auth_middleware import require_auth, get_current_user_id
import logging

logger = logging.getLogger(__name__)

rooms_bp = Blueprint('rooms', __name__)


@rooms_bp.route('', methods=['GET'])
@require_auth
def get_rooms():
    """
    Get user's rooms and public rooms
    
    Query parameters:
        - type: 'user' for user's rooms, 'public' for public rooms (default: 'user')
        - limit: Number of rooms to return (default: 20)
        - skip: Number of rooms to skip (default: 0)
    
    Returns:
        List of rooms
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Get query parameters
        room_type = request.args.get('type', 'user')
        limit = int(request.args.get('limit', 20))
        skip = int(request.args.get('skip', 0))
        
        room_service = RoomService(current_app.mongo.db)
        
        if room_type == 'public':
            # Public discovery: do not require user to exist yet
            rooms = room_service.get_public_rooms(limit=limit, skip=skip)
        elif room_type == 'user':
            # For user rooms, require a known user in DB
            user_service = UserService(current_app.mongo.db)
            user = user_service.get_user_by_firebase_uid(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            rooms = room_service.get_user_rooms(user.id)
        else:
            return jsonify({'error': 'Invalid room type'}), 400
        
        return jsonify({
            'success': True,
            'rooms': [room.dict() for room in rooms],
            'pagination': {
                'limit': limit,
                'skip': skip,
                'count': len(rooms)
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting rooms: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('', methods=['POST'])
@require_auth
def create_room():
    """
    Create a new investment room
    
    Request body:
        {
            "name": "Tech Stocks Growth",
            "description": "A diversified portfolio...",
            "goal_amount": 5000.00,
            "max_members": 10,
            "risk_level": "moderate",
            "investment_type": "stocks",
            "visibility": "public"
        }
    
    Returns:
        Created room data
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Validate required fields
        required_fields = ['name', 'description', 'goal_amount', 'max_members', 'risk_level', 'investment_type']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Create room
        from app.models.room import RoomCreate
        room_data = RoomCreate(
            name=data['name'],
            description=data['description'],
            goal_amount=float(data['goal_amount']),
            max_members=int(data['max_members']),
            risk_level=data['risk_level'],
            investment_type=data['investment_type'],
            visibility=data.get('visibility', 'public'),
            creator_id=user.id
        )
        
        room_service = RoomService(current_app.mongo.db)
        room = room_service.create_room(room_data)
        
        if not room:
            return jsonify({'error': 'Failed to create room'}), 500
        
        return jsonify({
            'success': True,
            'room': room.dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating room: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('/<room_id>', methods=['GET'])
@require_auth
def get_room(room_id):
    """
    Get room details by ID
    
    Returns:
        Room data with members
    """
    try:
        room_service = RoomService(current_app.mongo.db)
        room = room_service.get_room_by_id(room_id)
        
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        # Determine if current user is the creator
        is_current_user_creator = False
        try:
            firebase_uid = get_current_user_id()
            logger.info(f"Current user Firebase UID: {firebase_uid}")
            if firebase_uid:
                user_service = UserService(current_app.mongo.db)
                user = user_service.get_user_by_firebase_uid(firebase_uid)
                logger.info(f"Found user: {user.id if user else 'None'}")
                logger.info(f"Room creator ID: {room.creator_id}")
                if user and room.creator_id == user.id:
                    is_current_user_creator = True
                    logger.info("User is room creator")
                else:
                    logger.info("User is NOT room creator")
        except Exception as e:
            logger.error(f"Error determining creator: {str(e)}")
            pass

        # Get room members
        members = room_service.get_room_members(room_id)
        
        # Create room with members response
        from app.models.room import RoomWithMembers
        room_with_members = RoomWithMembers(**room.dict(), members=members)
        room_payload = room_with_members.dict()
        room_payload['is_current_user_creator'] = is_current_user_creator
        # Surface execution flag if present in DB
        try:
            db = current_app.mongo.db
            raw = db.rooms.find_one({'_id': __import__('bson').ObjectId(room_id)})
            if raw and raw.get('has_execution'):
                room_payload['has_execution'] = True
        except Exception:
            pass
        
        return jsonify({
            'success': True,
            'room': room_payload
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting room: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('/<room_id>', methods=['PUT'])
@require_auth
def update_room(room_id):
    """
    Update room details (only by creator)
    
    Request body:
        {
            "name": "Updated Name",
            "description": "Updated description",
            "goal_amount": 6000.00,
            "max_members": 12,
            "risk_level": "aggressive",
            "investment_type": "crypto",
            "visibility": "private"
        }
    
    Returns:
        Updated room data
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
        
        # Check if room exists and user is creator
        room_service = RoomService(current_app.mongo.db)
        room = room_service.get_room_by_id(room_id)
        
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        if room.creator_id != user.id:
            return jsonify({'error': 'Only room creator can update room'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400
        
        # Update room
        from app.models.room import RoomUpdate
        update_data = RoomUpdate(
            name=data.get('name'),
            description=data.get('description'),
            goal_amount=float(data['goal_amount']) if 'goal_amount' in data else None,
            max_members=int(data['max_members']) if 'max_members' in data else None,
            risk_level=data.get('risk_level'),
            investment_type=data.get('investment_type'),
            visibility=data.get('visibility')
        )
        
        updated_room = room_service.update_room(room_id, update_data)
        
        if not updated_room:
            return jsonify({'error': 'Failed to update room'}), 500
        
        return jsonify({
            'success': True,
            'room': updated_room.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating room: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('/<room_id>', methods=['DELETE'])
@require_auth
def delete_room(room_id):
    """
    Delete room (only by creator)
    
    Returns:
        Success message
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
        
        # Check if room exists and user is creator
        room_service = RoomService(current_app.mongo.db)
        room = room_service.get_room_by_id(room_id)
        
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        if room.creator_id != user.id:
            return jsonify({'error': 'Only room creator can delete room'}), 403
        
        # Refund all member contributions if room has not been invested yet
        db = current_app.mongo.db
        wallets = db.wallets
        contributions = db.contributions
        room_members = db.room_members
        
        # Get all members and their contributions
        members = list(room_members.find({'room_id': room_id, 'status': 'active'}))
        refunded_count = 0
        
        for member in members:
            member_contributions = list(contributions.find({
                'room_id': room_id, 
                'user_id': member['user_id'],
                'status': 'completed'
            }))
            
            # Calculate total contribution amount for this member
            total_contribution = sum(float(c.get('amount', 0) or 0) for c in member_contributions)
            
            if total_contribution > 0:
                # Refund to member's wallet
                wallet = wallets.find_one({'user_id': member['user_id']})
                if wallet:
                    wallets.update_one(
                        {'_id': wallet['_id']}, 
                        {
                            '$inc': {'balance': total_contribution}, 
                            '$set': {'updated_at': __import__('datetime').datetime.utcnow()}
                        }
                    )
                    
                    # Create refund transaction record
                    refund_transaction = {
                        'user_id': member['user_id'],
                        'wallet_id': wallet['_id'],
                        'type': 'refund',
                        'amount': total_contribution,
                        'status': 'completed',
                        'reference': f'REF-{room_id}-{member["user_id"]}',
                        'description': f'Refund from deleted room: {room.name}',
                        'room_id': room_id,
                        'room_name': room.name,
                        'created_at': __import__('datetime').datetime.utcnow(),
                        'completed_at': __import__('datetime').datetime.utcnow()
                    }
                    db.wallet_transactions.insert_one(refund_transaction)
                    refunded_count += 1
        
        # Delete room
        success = room_service.delete_room(room_id, user.id)
        
        if not success:
            return jsonify({'error': 'Failed to delete room'}), 500
        
        return jsonify({
            'success': True,
            'message': f'Room deleted successfully. {refunded_count} members refunded their contributions.'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting room: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('/<room_id>/join', methods=['POST'])
@require_auth
def join_room(room_id):
    """
    Join a room
    
    Returns:
        Success message
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
        
        # Resolve room id or code
        room_service = RoomService(current_app.mongo.db)
        resolved_room_id = room_id
        try:
            # Validate as ObjectId; if invalid, will except
            __import__('bson').ObjectId(room_id)
        except Exception:
            # Treat as room code
            room = room_service.get_room_by_code(room_id)
            if not room:
                return jsonify({'error': 'Room not found'}), 404
            resolved_room_id = room.id

        # Join room using resolved id
        member = room_service.add_room_member(resolved_room_id, user.id)
        
        if not member:
            return jsonify({'error': 'Failed to join room or room is full'}), 400
        
        return jsonify({
            'success': True,
            'message': 'Successfully joined room',
            'member': member.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error joining room: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('/<room_id>/leave', methods=['POST'])
@require_auth
def leave_room(room_id):
    """
    Leave a room
    
    Returns:
        Success message
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
        
        # Check if room exists and get room details
        room_service = RoomService(current_app.mongo.db)
        room = room_service.get_room_by_id(room_id)
        
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        # Check if user is trying to leave their own room (creator)
        if room.creator_id == user.id:
            return jsonify({'error': 'Room creator cannot leave their own room. Delete the room instead.'}), 400
        
        # Refund user's contributions if room has not been invested yet
        db = current_app.mongo.db
        wallets = db.wallets
        contributions = db.contributions
        
        # Get user's contributions to this room
        user_contributions = list(contributions.find({
            'room_id': room_id, 
            'user_id': user.id,
            'status': 'completed'
        }))
        
        # Calculate total contribution amount
        total_contribution = sum(float(c.get('amount', 0) or 0) for c in user_contributions)
        refunded = False
        
        if total_contribution > 0:
            # Refund to user's wallet
            wallet = wallets.find_one({'user_id': user.id})
            if wallet:
                wallets.update_one(
                    {'_id': wallet['_id']}, 
                    {
                        '$inc': {'balance': total_contribution}, 
                        '$set': {'updated_at': __import__('datetime').datetime.utcnow()}
                    }
                )
                
                # Create refund transaction record
                refund_transaction = {
                    'user_id': user.id,
                    'wallet_id': wallet['_id'],
                    'type': 'refund',
                    'amount': total_contribution,
                    'status': 'completed',
                    'reference': f'REF-LEAVE-{room_id}-{user.id}',
                    'description': f'Refund from leaving room: {room.name}',
                    'room_id': room_id,
                    'room_name': room.name,
                    'created_at': __import__('datetime').datetime.utcnow(),
                    'completed_at': __import__('datetime').datetime.utcnow()
                }
                db.wallet_transactions.insert_one(refund_transaction)
                refunded = True
        
        # Leave room
        success = room_service.remove_room_member(room_id, user.id)
        
        if not success:
            return jsonify({'error': 'Failed to leave room'}), 400
        
        message = 'Successfully left room'
        if refunded:
            message += f'. Refunded {formatMoney(total_contribution)} to your wallet.'
        
        return jsonify({
            'success': True,
            'message': message
        }), 200
        
    except Exception as e:
        logger.error(f"Error leaving room: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('/<room_id>/members', methods=['GET'])
@require_auth
def get_room_members(room_id):
    """
    Get room members
    
    Returns:
        List of room members
    """
    try:
        room_service = RoomService(current_app.mongo.db)
        members = room_service.get_room_members(room_id)
        
        # Ensure JSON-serializable output (handle datetimes via model json encoders)
        serialized_members = [json.loads(member.json()) for member in members]
        return jsonify({
            'success': True,
            'members': serialized_members
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting room members: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@rooms_bp.route('/join-by-code', methods=['POST'])
@require_auth
def join_room_by_code():
    """
    Join a room by room code
    
    Request body:
        {
            "room_code": "ROOM-ABC123"
        }
    
    Returns:
        Success message
    """
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data or 'room_code' not in data:
            return jsonify({'error': 'Room code is required'}), 400
        
        room_code = data['room_code']
        
        # Get user from database
        user_service = UserService(current_app.mongo.db)
        user = user_service.get_user_by_firebase_uid(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Find room by code
        room_service = RoomService(current_app.mongo.db)
        room = room_service.get_room_by_code(room_code)
        
        if not room:
            return jsonify({'error': 'Room not found'}), 404
        
        # Join room
        member = room_service.add_room_member(room.id, user.id)
        
        if not member:
            return jsonify({'error': 'Failed to join room or room is full'}), 400
        
        return jsonify({
            'success': True,
            'message': 'Successfully joined room',
            'room': room.dict(),
            'member': member.dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error joining room by code: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
