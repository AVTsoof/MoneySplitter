from enum import Enum

class SplitMethod(str, Enum):
    EQUALLY = "Equally"
    UNEQUALLY = "Unequally"

class TransactionType(str, Enum):
    EXPENSE = "expense"
    TRANSFER = "transfer"
