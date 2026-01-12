export interface PointType {
  key: string;
  name: string;
  dailyLimitCount: number;
  isEnabled: boolean;
}

export interface BalanceRow {
  guildId: string;
  userId: string;
  typeKey: string;
  balance: number;
}

export interface TransactionInsert {
  id: string;
  guildId: string;
  typeKey: string;
  giverUserId: string;
  receiverUserId: string;
  amount: number;
  message: string;
  createdAt: string;
}
