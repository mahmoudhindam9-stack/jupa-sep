export enum OrderStatus {
  PENDING = "pending",
  PREPARING = "preparing",
  READY = "ready",
  DELIVERED = "delivered",
  SERVED = "served",
  CANCELLED = "cancelled",
}

export enum PaymentMethod {
  CASH = "cash",
  CARD = "card",
  WALLET = "wallet",
}

export enum OrderType {
  DINE_IN = "dine_in",
  TAKEAWAY = "takeaway",
  DELIVERY = "delivery",
}

export enum TableStatus {
  AVAILABLE = "available",
  OCCUPIED = "occupied",
  RESERVED = "reserved",
  CLEANING = "cleaning",
}

export enum UserRole {
  ADMIN = "admin",
  CASHIER = "cashier",
  WAITER = "waiter",
  KITCHEN = "kitchen",
}
