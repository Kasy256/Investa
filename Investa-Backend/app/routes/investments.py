"""
Investments endpoints - votes for recommendations
"""

from flask import Blueprint, request, jsonify, current_app
from app.middleware.auth_middleware import require_auth, get_current_user_id
from app.services.investment_service import InvestmentService
from app.services.room_service import RoomService
from app.services.user_service import UserService
from app.models.investment import VoteCreate
import logging

logger = logging.getLogger(__name__)

investments_bp = Blueprint('investments', __name__)


@investments_bp.route('/votes', methods=['POST'])
@require_auth
def cast_vote():
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        try:
            vote_data = VoteCreate(**data)
        except Exception as e:
            return jsonify({'error': f'Invalid payload: {str(e)}'}), 400

        inv = InvestmentService(current_app.mongo.db)
        vote = inv.cast_vote(user_id, vote_data)
        if not vote:
            return jsonify({'error': 'Failed to cast vote'}), 500
        return jsonify({ 'success': True, 'vote': vote.dict() }), 200
    except Exception as e:
        logger.error(f"Error casting vote: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@investments_bp.route('/votes/aggregate', methods=['GET'])
@require_auth
def get_vote_aggregate():
    try:
        room_id = request.args.get('room_id')
        if not room_id:
            return jsonify({'error': 'room_id is required'}), 400
        recommendation_id = request.args.get('recommendation_id')

        room_service = RoomService(current_app.mongo.db)
        room = room_service.get_room_by_id(room_id)
        total_members = room.current_members if room else 0

        inv = InvestmentService(current_app.mongo.db)
        agg = inv.get_aggregate(room_id, recommendation_id, total_members)
        return jsonify({ 'success': True, 'aggregate': agg.dict() }), 200
    except Exception as e:
        logger.error(f"Error getting vote aggregate: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@investments_bp.route('/execute', methods=['POST'])
@require_auth
def execute_investment():
    """Simulate executing an investment plan for a room."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        room_id = data.get('room_id')
        allocations = data.get('allocations', [])  # [{id,name,allocation}]
        if not room_id or not isinstance(allocations, list) or len(allocations) == 0:
            return jsonify({'error': 'room_id and allocations are required'}), 400

        db = current_app.mongo.db
        rooms = db.rooms
        execs = db.investment_executions
        analytics = db.investment_analytics

        room_doc = rooms.find_one({'_id': __import__('bson').ObjectId(room_id)})
        if not room_doc:
            return jsonify({'error': 'Room not found'}), 404

        invested_amount = float(room_doc.get('collected_amount', 0.0) or 0.0)
        started_at = __import__('datetime').datetime.utcnow()

        execution = {
            'room_id': room_id,
            'allocations': allocations,
            'invested_amount': invested_amount,
            'started_at': started_at,
            'created_by': user_id,
        }
        execs.insert_one(execution)
        # Mark room as investing and set has_execution
        rooms.update_one({'_id': __import__('bson').ObjectId(room_id)}, {
            '$set': {
                'status': 'investing',
                'has_execution': True,
                'updated_at': __import__('datetime').datetime.utcnow()
            }
        })

        # Generate simulated performance series (12 periods)
        import random
        series = []
        current = invested_amount
        for i in range(12):
            drift = random.uniform(-0.02, 0.05)  # -2% to +5%
            current = max(0.0, current * (1.0 + drift))
            series.append({
                't': i + 1,
                'value': round(current, 2),
                'drift': round(drift * 100, 2)
            })

        breakdown = []
        palette = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"]
        for idx, a in enumerate(allocations):
            amt = invested_amount * (float(a.get('allocation', 0)) / 100.0)
            breakdown.append({'name': a.get('name'), 'allocation': a.get('allocation'), 'amount': round(amt, 2), 'color': palette[idx % len(palette)]})

        analytics_doc = {
            'room_id': room_id,
            'invested_amount': invested_amount,
            'series': series,
            'breakdown': breakdown,
            'created_at': started_at,
        }
        analytics.update_one({'room_id': room_id}, {'$set': analytics_doc}, upsert=True)

        return jsonify({'success': True, 'execution': {'room_id': room_id, 'invested_amount': invested_amount}}), 200
    except Exception as e:
        logger.error(f"Error executing investment: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@investments_bp.route('/analytics', methods=['GET'])
@require_auth
def get_room_analytics():
    try:
        room_id = request.args.get('room_id')
        if not room_id:
            return jsonify({'error': 'room_id is required'}), 400
        doc = current_app.mongo.db.investment_analytics.find_one({'room_id': room_id})
        if not doc:
            return jsonify({'error': 'No analytics found for room'}), 404
        doc['id'] = str(doc.get('_id'))
        doc.pop('_id', None)
        return jsonify({'success': True, 'analytics': doc}), 200
    except Exception as e:
        logger.error(f"Error getting room analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@investments_bp.route('/stop', methods=['POST'])
@require_auth
def stop_investment():
    """Members vote to stop investment; when threshold reached, close and distribute profits."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        room_id = data.get('room_id')
        rec_id = data.get('recommendation_id')
        if not room_id or not rec_id:
            return jsonify({'error': 'room_id and recommendation_id are required'}), 400

        db = current_app.mongo.db
        stops = db.investment_stop_votes
        rooms = db.rooms
        wallets = db.wallets

        # Record a user's stop vote (idempotent)
        from datetime import datetime as _dt
        stops.update_one(
            { 'room_id': room_id, 'recommendation_id': rec_id, 'user_id': user_id },
            { '$set': { 'room_id': room_id, 'recommendation_id': rec_id, 'user_id': user_id, 'voted_at': _dt.utcnow() } },
            upsert=True,
        )

        # Compute threshold: 70% of current members
        room_doc = rooms.find_one({ '_id': __import__('bson').ObjectId(room_id) })
        current_members = int(room_doc.get('current_members', 0)) if room_doc else 0
        votes_count = stops.count_documents({ 'room_id': room_id, 'recommendation_id': rec_id })
        threshold = max(1, int((0.7 * current_members) + 0.999))

        if current_members and votes_count >= threshold:
            # Close investment for this asset: compute profit share and distribute proportional to member stake
            analytics_doc = db.investment_analytics.find_one({ 'room_id': room_id })
            if analytics_doc and analytics_doc.get('series'):
                invested = float(analytics_doc.get('invested_amount', 0) or 0)
                last_val = float(analytics_doc['series'][-1].get('value', invested) or invested)
                # Determine this asset's allocation
                breakdown = analytics_doc.get('breakdown', [])
                asset = next((b for b in breakdown if b.get('name') == data.get('asset_name') or b.get('id') == rec_id), None)
                asset_alloc = float(asset.get('allocation', 0)) if asset else 0.0
                # Profit attributable to this asset (by allocation weight)
                profit_total = max(0.0, last_val - invested) * (asset_alloc / 100.0 if asset_alloc else 1.0 / max(1, len(breakdown) or 1))

                # Member stakes from room_members.contribution_amount
                members = list(db.room_members.find({ 'room_id': room_id, 'status': 'active' }))
                total_stake = sum(float(m.get('contribution_amount', 0) or 0) for m in members) or 1.0
                for m in members:
                    stake = float(m.get('contribution_amount', 0) or 0)
                    share = profit_total * (stake / total_stake)
                    if share <= 0:
                        continue
                    w = wallets.find_one({ 'user_id': m['user_id'] })
                    if w:
                        wallets.update_one({ '_id': w['_id'] }, { '$inc': { 'balance': share, 'total_returns': share }, '$set': { 'updated_at': _dt.utcnow() } })

                # Optionally mark room as closed when all assets stopped
                # Here we simply leave room open; frontend can call stop per asset as needed

            return jsonify({ 'success': True, 'stopped': True, 'votes': votes_count, 'threshold': threshold }), 200

        return jsonify({ 'success': True, 'stopped': False, 'votes': votes_count, 'threshold': threshold }), 200
    except Exception as e:
        logger.error(f"Error stopping investment: {str(e)}")
        return jsonify({ 'error': 'Internal server error' }), 500


@investments_bp.route('/stop/aggregate', methods=['GET'])
@require_auth
def stop_votes_aggregate():
    try:
        db = current_app.mongo.db
        room_id = request.args.get('room_id')
        rec_id = request.args.get('recommendation_id')
        if not room_id:
            return jsonify({'error': 'room_id is required'}), 400

        rooms = db.rooms
        stops = db.investment_stop_votes

        room_doc = rooms.find_one({ '_id': __import__('bson').ObjectId(room_id) })
        current_members = int(room_doc.get('current_members', 0)) if room_doc else 0
        threshold = max(1, int((0.7 * current_members) + 0.999)) if current_members else 0

        if rec_id:
            votes_count = stops.count_documents({ 'room_id': room_id, 'recommendation_id': rec_id })
        else:
            pipeline = [
                { '$match': { 'room_id': room_id } },
                { '$group': { '_id': '$user_id' } },
                { '$count': 'unique_voters' }
            ]
            agg = list(stops.aggregate(pipeline))
            votes_count = (agg[0]['unique_voters'] if agg else 0)

        return jsonify({ 'success': True, 'aggregate': { 'votes': votes_count, 'threshold': threshold } }), 200
    except Exception as e:
        logger.error(f"Error getting stop votes aggregate: {str(e)}")
        return jsonify({ 'error': 'Internal server error' }), 500


@investments_bp.route('/end', methods=['POST'])
@require_auth
def end_investment():
    """End the entire investment and distribute profits to all members."""
    try:
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json() or {}
        room_id = data.get('room_id')
        if not room_id:
            return jsonify({'error': 'room_id is required'}), 400

        db = current_app.mongo.db
        rooms = db.rooms
        analytics = db.investment_analytics
        wallets = db.wallets
        wallet_transactions = db.wallet_transactions

        # Check if user is room creator
        room_doc = rooms.find_one({'_id': __import__('bson').ObjectId(room_id)})
        if not room_doc:
            return jsonify({'error': 'Room not found'}), 404
        
        # Get user from database to compare with creator_id
        user_service = UserService(current_app.mongo.db)
        current_user = user_service.get_user_by_firebase_uid(user_id)
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        

        
        if room_doc.get('creator_id') != current_user.id:
            return jsonify({'error': 'Only room creator can end investment'}), 403

        # Get investment analytics
        analytics_doc = analytics.find_one({'room_id': room_id})
        if not analytics_doc:
            return jsonify({'error': 'No investment analytics found'}), 404

        invested_amount = float(analytics_doc.get('invested_amount', 0) or 0)
        current_value = float(analytics_doc['series'][-1].get('value', invested_amount) or invested_amount)
        total_profit = current_value - invested_amount

        # Get all active members and their contributions
        members = list(db.room_members.find({'room_id': room_id, 'status': 'active'}))
        
        # Get contribution amounts from the contributions collection
        contributions = list(db.contributions.find({'room_id': room_id, 'status': 'completed'}))
        
        # Create a map of user_id to total contribution amount
        user_contributions = {}
        for contribution in contributions:
            user_id = contribution.get('user_id')
            amount = float(contribution.get('amount', 0) or 0)
            if user_id in user_contributions:
                user_contributions[user_id] += amount
            else:
                user_contributions[user_id] = amount
        
        # Calculate total contributions
        total_contributions = sum(user_contributions.values())
        


        if total_contributions <= 0:
            return jsonify({'error': 'No contributions found'}), 400

        # Calculate profit distribution
        profit_distribution = []
        for member in members:
            user_id = member['user_id']
            contribution = user_contributions.get(user_id, 0)
            if contribution > 0:
                profit_share = (contribution / total_contributions) * total_profit
                profit_distribution.append({
                    'user_id': user_id,
                    'contribution': contribution,
                    'profit_share': profit_share,
                    'total_return': contribution + profit_share
                })

        # Distribute profits to member wallets
        from datetime import datetime as _dt
        from decimal import Decimal
        from app.services.wallet_service import WalletService
        from app.models.wallet import WalletTransactionCreate
        
        wallet_service = WalletService(current_app.mongo.db)
        
        for dist in profit_distribution:
            # Convert Firebase UID to MongoDB ObjectId if needed
            user_service = UserService(current_app.mongo.db)
            user = user_service.get_user_by_firebase_uid(dist['user_id'])
            if not user:
                logger.error(f"User not found for Firebase UID: {dist['user_id']}")
                continue
                
            wallet = wallet_service.get_wallet_by_user_id(user.id)
            if wallet:
                # Update wallet balance using WalletService
                success = wallet_service.update_wallet_balance(
                    wallet.id, 
                    Decimal(str(dist['profit_share'])), 
                    'return'
                )
                
                if success:
                    # Create transaction record using WalletService
                    transaction_data = WalletTransactionCreate(
                        user_id=user.id,  # Use MongoDB ObjectId, not Firebase UID
                        wallet_id=wallet.id,
                        type='return',
                        amount=dist['profit_share'],
                        reference=f"INV-END-{room_id[:8].upper()}-{user.id[:8].upper()}",
                        description=f'Investment return from {room_doc.get("name", "Room")}'
                    )
                    
                    transaction = wallet_service.create_transaction(transaction_data)
                    if transaction:
                        # Mark transaction as completed
                        wallet_service.update_transaction_status(transaction.id, 'completed', _dt.utcnow())
                    else:
                        logger.error(f"Failed to create transaction")
                else:
                    logger.error(f"Failed to update wallet balance")
            else:
                logger.error(f"No wallet found for user_id: {dist['user_id']}")

        # Store final values in room before closing
        final_analytics = analytics.find_one({'room_id': room_id})
        final_value = current_value if final_analytics else invested_amount
        
        # Mark room as closed and store final values
        rooms.update_one(
            {'_id': __import__('bson').ObjectId(room_id)},
            {
                '$set': {
                    'status': 'closed',
                    'has_execution': False,
                    'closed_at': _dt.utcnow(),
                    'updated_at': _dt.utcnow(),
                    'final_invested_amount': invested_amount,
                    'final_portfolio_value': final_value,
                    'final_profit': total_profit
                }
            }
        )

        # Remove analytics for this room
        analytics.delete_one({'room_id': room_id})

        return jsonify({
            'success': True,
            'message': 'Investment ended successfully',
            'summary': {
                'total_invested': invested_amount,
                'total_profit': total_profit,
                'members_count': len(members),
                'profit_distribution': profit_distribution
            }
        }), 200

    except Exception as e:
        logger.error(f"Error ending investment: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

