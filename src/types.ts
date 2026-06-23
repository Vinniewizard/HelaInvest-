export interface User {
  id: string;
  username: string;
  email: string;
  phone: string;
  referralCode: string;
  referredBy?: string; // ID of the referrer
  isAdmin?: boolean;
  password?: string;
  balance?: number;
}

export interface Plan {
  id: string;
  name: string;
  amount: number;
  return_amount: number;
  duration_days: number;
  active: boolean;
  description: string;
}

export type InvestmentStatus = 'active' | 'completed' | 'cancelled';

export interface Investment {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  return_amount: number;
  profit: number;
  status: InvestmentStatus;
  created_at: string;
  matures_at: string;
  planName: string; // convenient lookup
}

export type TransactionType = 'deposit' | 'withdrawal' | 'investment' | 'commission' | 'payout';
export type TransactionStatus = 'pending' | 'approved' | 'declined';

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: TransactionType;
  status: TransactionStatus;
  phone?: string;
  note?: string;
  created_at: string;
}

export interface ReferralRecord {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referred_username: string;
  bonus: number;
  created_at: string;
}

export interface WalletBalance {
  total_deposits: number;
  referral_bonus: number;
  total_payouts: number;
  total_withdrawals: number;
  total_invested: number;
  available_balance: number;
}

export interface DashboardStats {
  balance: WalletBalance;
  active_trades_count: number;
  active_trades_capital: number;
  expected_payouts: number;
  completed_trades_count: number;
  total_profit_earned: number;
}
