"""
Analytics service for managing analytics and demo simulation
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal
from bson import ObjectId
from app.models.analytics import (
    Analytics, AnalyticsCreate, AnalyticsResponse, PortfolioAnalytics, RoomPerformance
)
import logging
import random

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for managing analytics and demo simulation"""
    
    def __init__(self, mongo_db):
        self.db = mongo_db
        self.analytics_collection = self.db.analytics
        self.rooms_collection = self.db.rooms
        self.room_members_collection = self.db.room_members
        self.contributions_collection = self.db.contributions
        self.wallets_collection = self.db.wallets
    
    def generate_portfolio_analytics(self, user_id: str) -> Optional[PortfolioAnalytics]:
        """
        Generate portfolio analytics for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Portfolio analytics data
        """
        try:
            # Get user's wallet
            wallet = self.wallets_collection.find_one({'user_id': user_id})
            if not wallet:
                return None
            
            # Get user's active rooms
            user_rooms = self.room_members_collection.find({
                'user_id': user_id,
                'status': 'active'
            })
            
            room_ids = [member['room_id'] for member in user_rooms]
            
            # Get room details
            rooms = list(self.rooms_collection.find({'_id': {'$in': [ObjectId(rid) for rid in room_ids]}}))
            
            # Calculate total invested
            total_invested = sum(float(room['collected_amount']) for room in rooms)
            
            # Simulate returns (demo data)
            total_returns = self._simulate_returns(total_invested, len(rooms))
            total_portfolio_value = total_invested + total_returns
            
            # Calculate returns percentage
            returns_percentage = (total_returns / total_invested * 100) if total_invested > 0 else 0
            
            # Generate performance data for charts
            performance_data = self._generate_performance_data(total_invested, total_returns)
            
            return PortfolioAnalytics(
                total_portfolio_value=total_portfolio_value,
                total_invested=total_invested,
                total_returns=total_returns,
                returns_percentage=returns_percentage,
                active_rooms=len(rooms),
                performance_data=performance_data
            )
            
        except Exception as e:
            logger.error(f"Error generating portfolio analytics: {str(e)}")
            return None
    
    def get_room_performance(self, user_id: str) -> List[RoomPerformance]:
        """
        Get room performance data for a user
        
        Args:
            user_id: User ID
            
        Returns:
            List of room performance data
        """
        try:
            # Get user's active rooms
            user_rooms = self.room_members_collection.find({
                'user_id': user_id,
                'status': 'active'
            })
            
            room_performances = []
            
            for member in user_rooms:
                room = self.rooms_collection.find_one({'_id': ObjectId(member['room_id'])})
                if room:
                    # Get user's contribution to this room
                    if room.get('status') in ['closed', 'ended'] and room.get('final_invested_amount'):
                        # For closed rooms, use the final invested amount stored in the room
                        invested_amount = float(room['final_invested_amount'])
                    else:
                        # For active rooms, calculate from contributions
                        user_contribution = self.contributions_collection.aggregate([
                            {'$match': {'user_id': user_id, 'room_id': member['room_id'], 'status': 'completed'}},
                            {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
                        ])
                        
                        invested_amount = 0
                        for doc in user_contribution:
                            invested_amount = doc['total']
                            break
                    
                    # For closed/ended rooms, use the final values stored in the room
                    if room.get('status') in ['closed', 'ended']:
                        if room.get('final_portfolio_value'):
                            current_value = float(room['final_portfolio_value'])
                        else:
                            # Fallback: if no final value stored, use invested amount (no profit)
                            current_value = invested_amount
                        # For closed rooms, calculate returns percentage from final values
                        returns_percentage = ((current_value - invested_amount) / invested_amount * 100) if invested_amount > 0 else 0
                    else:
                        # For active rooms, simulate current value
                        returns_percentage = self._simulate_room_returns(room['risk_level'], room['investment_type'])
                        current_value = invested_amount * (1 + returns_percentage / 100)
                    
                    returns = current_value - invested_amount
                    
                    room_performances.append(RoomPerformance(
                        room_id=str(room['_id']),
                        room_name=room['name'],
                        invested_amount=float(invested_amount),
                        current_value=current_value,
                        returns=returns,
                        returns_percentage=returns_percentage,
                        status=room.get('status', 'active')
                    ))
            
            return room_performances
            
        except Exception as e:
            logger.error(f"Error getting room performance: {str(e)}")
            return []
    
    def get_performance_metrics(self, user_id: str, time_range: str = "6M") -> Dict[str, Any]:
        """
        Get performance metrics for charts
        
        Args:
            user_id: User ID
            time_range: Time range (1M, 3M, 6M, 1Y)
            
        Returns:
            Performance metrics data
        """
        try:
            # Calculate date range
            end_date = datetime.utcnow()
            if time_range == "1M":
                start_date = end_date - timedelta(days=30)
            elif time_range == "3M":
                start_date = end_date - timedelta(days=90)
            elif time_range == "6M":
                start_date = end_date - timedelta(days=180)
            elif time_range == "1Y":
                start_date = end_date - timedelta(days=365)
            else:
                start_date = end_date - timedelta(days=180)
            
            # Generate mock performance data
            performance_data = self._generate_time_series_data(start_date, end_date)
            
            return {
                'time_range': time_range,
                'performance_data': performance_data,
                'benchmark_data': self._generate_benchmark_data(start_date, end_date)
            }
            
        except Exception as e:
            logger.error(f"Error getting performance metrics: {str(e)}")
            return {}
    
    def _simulate_returns(self, total_invested: float, num_rooms: int) -> float:
        """
        Simulate returns based on investment amount and number of rooms
        
        Args:
            total_invested: Total amount invested
            num_rooms: Number of investment rooms
            
        Returns:
            Simulated returns amount
        """
        if total_invested == 0:
            return 0.0
        
        # Base return rate between 5% and 25%
        base_rate = random.uniform(0.05, 0.25)
        
        # Diversification bonus (more rooms = slightly better returns)
        diversification_bonus = min(0.05, num_rooms * 0.01)
        
        # Calculate returns
        returns = total_invested * (base_rate + diversification_bonus)
        
        return round(returns, 2)
    
    def _simulate_room_returns(self, risk_level: str, investment_type: str) -> float:
        """
        Simulate returns for a specific room based on risk level and type
        
        Args:
            risk_level: Risk level (conservative, moderate, aggressive)
            investment_type: Investment type (stocks, crypto, bonds, etc.)
            
        Returns:
            Returns percentage
        """
        # Base returns by risk level
        risk_returns = {
            'conservative': (2, 8),
            'moderate': (5, 15),
            'aggressive': (10, 30)
        }
        
        # Type multipliers
        type_multipliers = {
            'stocks': 1.0,
            'crypto': 1.5,
            'bonds': 0.7,
            'etf': 0.9,
            'mixed': 1.0
        }
        
        min_return, max_return = risk_returns.get(risk_level, (5, 15))
        multiplier = type_multipliers.get(investment_type, 1.0)
        
        # Generate random return within range
        base_return = random.uniform(min_return, max_return)
        final_return = base_return * multiplier
        
        return round(final_return, 1)
    
    def _generate_performance_data(self, total_invested: float, total_returns: float) -> List[Dict]:
        """
        Generate performance data for charts
        
        Args:
            total_invested: Total amount invested
            total_returns: Total returns
            
        Returns:
            List of performance data points
        """
        data = []
        base_value = total_invested
        
        # Generate 6 months of data
        for i in range(6):
            month_name = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]
            
            # Simulate monthly growth
            monthly_growth = (total_returns / 6) * (1 + random.uniform(-0.1, 0.1))
            portfolio_value = base_value + (monthly_growth * (i + 1))
            
            data.append({
                'month': month_name,
                'portfolio': round(portfolio_value, 2),
                'benchmark': round(base_value * (1 + 0.08 * (i + 1) / 6), 2)  # 8% annual benchmark
            })
        
        return data
    
    def _generate_time_series_data(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Generate time series data for performance charts
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            List of time series data points
        """
        data = []
        current_date = start_date
        base_value = 10000  # Starting portfolio value
        
        while current_date <= end_date:
            # Simulate daily returns
            daily_return = random.uniform(-0.02, 0.03)  # -2% to +3% daily
            base_value *= (1 + daily_return)
            
            data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'value': round(base_value, 2)
            })
            
            current_date += timedelta(days=1)
        
        return data
    
    def _generate_benchmark_data(self, start_date: datetime, end_date: datetime) -> List[Dict]:
        """
        Generate benchmark data for comparison
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            List of benchmark data points
        """
        data = []
        current_date = start_date
        base_value = 10000  # Starting benchmark value
        
        while current_date <= end_date:
            # Simulate market benchmark (more stable than portfolio)
            daily_return = random.uniform(-0.01, 0.02)  # -1% to +2% daily
            base_value *= (1 + daily_return)
            
            data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'value': round(base_value, 2)
            })
            
            current_date += timedelta(days=1)
        
        return data
