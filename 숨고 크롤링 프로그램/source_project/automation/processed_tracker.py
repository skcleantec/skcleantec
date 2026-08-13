# Source Generated with Decompyle++
# File: processed_tracker.pyc (Python 3.12)

'''
처리 기록 관리 모듈
- 닉네임 기반 처리 기록 추적
- 자정 자동 리셋
- 기능별 처리 상태 관리
'''
import logging
from datetime import datetime, date
from typing import Dict, Optional
logger = logging.getLogger(__name__)

class ProcessedTracker:
    '''처리 기록 관리 클래스'''
    
    def __init__(self):
        self.processed_today = { }
        self.current_date = date.today()
        self.emoji_count = 0
        self.quote_count = 0

    
    def _check_date_reset(self):
        '''날짜 변경 시 자동 리셋'''
        today = date.today()
        if today != self.current_date:
            logger.info(f'''날짜 변경 감지: {self.current_date} → {today}, 기록 초기화''')
            self.clear()
            self.current_date = today
            return None

    
    def is_processed(self = None, nickname = None):
        '''
        해당 닉네임이 이미 처리되었는지 확인

        Args:
            nickname: 고객 닉네임

        Returns:
            bool: 처리 완료 여부
        '''
        self._check_date_reset()
        if not nickname:
            return False
        return nickname in self.processed_today

    
    def is_processed_by_feature(self = None, nickname = None, feature = None):
        '''
        특정 기능으로 처리되었는지 확인

        Args:
            nickname: 고객 닉네임
            feature: 기능 이름 ("emoji" 또는 "quote")

        Returns:
            bool: 해당 기능으로 처리 완료 여부
        '''
        self._check_date_reset()
        if not nickname or nickname not in self.processed_today:
            return False
        return self.processed_today[nickname].get(feature, False)

    
    def mark_processed(self = None, nickname = None, feature = None):
        '''
        처리 완료로 표시

        Args:
            nickname: 고객 닉네임
            feature: 기능 이름 ("emoji" 또는 "quote")
        '''
        self._check_date_reset()
        if not nickname:
            return None
        now = datetime.now().strftime('%H:%M:%S')
        if nickname not in self.processed_today:
            self.processed_today[nickname] = {
                'emoji': False,
                'quote': False,
                'time': now }
        self.processed_today[nickname][feature] = True
        self.processed_today[nickname]['time'] = now
        if feature == 'emoji':
            self.emoji_count += 1
        elif feature == 'quote':
            self.quote_count += 1
        logger.info(f'''처리 완료 기록: {nickname} ({feature}) - {now}''')

    
    def clear(self):
        '''기록 초기화'''
        self.processed_today.clear()
        self.emoji_count = 0
        self.quote_count = 0
        logger.info('처리 기록 초기화 완료')

    
    def get_stats(self = None):
        '''
        처리 통계 반환

        Returns:
            dict: 통계 정보
        '''
        self._check_date_reset()
        return {
            'emoji_count': self.emoji_count,
            'quote_count': self.quote_count,
            'total_count': len(self.processed_today),
            'date': self.current_date.strftime('%Y-%m-%d') }

    
    def get_processed_list(self = None):
        '''처리된 목록 반환'''
        self._check_date_reset()
        return self.processed_today.copy()

