import csv
import json
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from core.engine import Transaction, Expense, Transfer, EqualSplitStrategy, ExactSplitStrategy

class CSVAdapter:
    """
    Adapter for converting between Transaction objects and CSV rows.
    Row structure: [Event_ID, UNIX_Timestamp, Action_Type, JSON_Payload]
    """
    
    @staticmethod
    def transaction_to_csv_row(tx: Transaction) -> str:
        tx_dict = tx.to_dict()
        action_type = tx_dict.pop('type')
        event_id = tx.id
        unix_ts = int(tx.timestamp.timestamp())
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([event_id, unix_ts, action_type, json.dumps(tx_dict)])
        return output.getvalue().strip()

    @staticmethod
    def csv_row_to_transaction(row_str: str) -> Optional[Transaction]:
        if not row_str.strip():
            return None
            
        try:
            reader = csv.reader([row_str])
            row = next(reader)
            if len(row) < 4:
                return None
                
            event_id, unix_ts, action_type, payload_str = row[0], int(row[1]), row[2], row[3]
            payload = json.loads(payload_str)
            timestamp = datetime.fromtimestamp(unix_ts)
            
            if action_type == 'expense':
                strategy_data = payload.get('strategy', {})
                strategy_type = strategy_data.get('type', 'equal')
                
                if strategy_type == 'exact':
                    strategy = ExactSplitStrategy({k: Decimal(v) for k, v in strategy_data.get('amounts', {}).items()})
                else:
                    strategy = EqualSplitStrategy()
                
                return Expense(
                    id=event_id,
                    payer=payload['payer'],
                    total_amount=Decimal(payload['total_amount']),
                    participants=payload['participants'],
                    description=payload['description'],
                    strategy=strategy,
                    currency=payload.get('currency', 'USD'),
                    timestamp=timestamp
                )
            elif action_type == 'transfer':
                return Transfer(
                    id=event_id,
                    sender=payload['sender'],
                    receiver=payload['receiver'],
                    amount=Decimal(payload['amount']),
                    currency=payload.get('currency', 'USD'),
                    description=payload.get('description', 'Transfer'),
                    timestamp=timestamp
                )
        except Exception as e:
            print(f"Error parsing CSV row: {row_str} -> {e}")
            return None
        return None
