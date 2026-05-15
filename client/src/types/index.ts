export interface Expense {
  id: string;
  payer: string;
  total_amount: string;
  participants: string[];
  description: string;
  currency: string;
}

export interface Transaction {
  from: string;
  to: string;
  amount: string;
}

export interface CalculationResults {
  balances: {
    [currency: string]: {
      [user: string]: string;
    };
  };
  transactions: {
    [currency: string]: Transaction[];
  };
}
