"""
Investment service for handling recommendation votes
"""

from typing import Optional
from datetime import datetime
from bson import ObjectId
from app.models.investment import VoteCreate, VoteResponse, VoteAggregate
import logging

logger = logging.getLogger(__name__)


class InvestmentService:
    def __init__(self, mongo_db):
        self.db = mongo_db
        self.votes = self.db.investment_votes

    def cast_vote(self, user_id: str, vote_data: VoteCreate) -> Optional[VoteResponse]:
        try:
            # Upsert one vote per (user, room, recommendation)
            now = datetime.utcnow()
            update = {
                '$set': {
                    'room_id': vote_data.room_id,
                    'recommendation_id': vote_data.recommendation_id,
                    'user_id': user_id,
                    'vote': vote_data.vote,
                    'updated_at': now,
                },
                '$setOnInsert': {
                    'created_at': now,
                }
            }
            res = self.votes.update_one(
                {
                    'room_id': vote_data.room_id,
                    'recommendation_id': vote_data.recommendation_id,
                    'user_id': user_id,
                },
                update,
                upsert=True,
            )

            doc = self.votes.find_one({
                'room_id': vote_data.room_id,
                'recommendation_id': vote_data.recommendation_id,
                'user_id': user_id,
            })
            if not doc:
                return None
            doc['id'] = str(doc['_id'])
            del doc['_id']
            return VoteResponse(**doc)
        except Exception as e:
            logger.error(f"Error casting vote: {str(e)}")
            return None

    def get_aggregate(self, room_id: str, recommendation_id: Optional[str], total_members: int) -> VoteAggregate:
        try:
            q = { 'room_id': room_id }
            if recommendation_id:
                q['recommendation_id'] = recommendation_id
            approve = self.votes.count_documents({ **q, 'vote': 'approve' })
            reject = self.votes.count_documents({ **q, 'vote': 'reject' })
            return VoteAggregate(
                room_id=room_id,
                recommendation_id=recommendation_id,
                approve=approve,
                reject=reject,
                total=total_members,
            )
        except Exception as e:
            logger.error(f"Error aggregating votes: {str(e)}")
            return VoteAggregate(room_id=room_id, recommendation_id=recommendation_id, approve=0, reject=0, total=total_members)


