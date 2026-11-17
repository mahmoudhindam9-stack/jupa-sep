import { useState, useEffect } from "react";
import { tableOrdersStore, TableOrder } from "@/shared/services/tableOrdersStore";

export function useTableOrders() {
  const [orders, setOrders] = useState<TableOrder[]>(() => tableOrdersStore.getAllOrders());
  const [tablePaymentStatuses, setTablePaymentStatuses] = useState(() =>
    tableOrdersStore.getAllTablePaymentStatuses(),
  );

  useEffect(() => {
    setOrders(tableOrdersStore.getAllOrders());
    setTablePaymentStatuses(tableOrdersStore.getAllTablePaymentStatuses());
    const unsubscribe = tableOrdersStore.subscribe(() => {
      setOrders([...tableOrdersStore.getAllOrders()]);
      setTablePaymentStatuses({ ...tableOrdersStore.getAllTablePaymentStatuses() });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    orders,
    tablePaymentStatuses,
    getTablePaymentStatus: (tableId?: string | null, tableNumber?: number | null) =>
      tableOrdersStore.getTablePaymentStatus(tableId, tableNumber),
    pendingCashierOrders: orders.filter((o) => o.status === "sent_to_cashier"),
    getOrderByTableId: (tableId: string) =>
      orders.find(
        (o) =>
          o.table_id === tableId && ["draft", "sent_to_cashier", "in_checkout"].includes(o.status),
      ),
    saveOrder: tableOrdersStore.saveOrder.bind(tableOrdersStore),
    updateStatus: tableOrdersStore.updateStatus.bind(tableOrdersStore),
    removeOrder: tableOrdersStore.removeOrder.bind(tableOrdersStore),
    clearTableOrder: tableOrdersStore.clearTableOrder.bind(tableOrdersStore),
    sendOrderToKitchen: tableOrdersStore.sendOrderToKitchen.bind(tableOrdersStore),
    completeKitchenOrder: tableOrdersStore.completeKitchenOrder.bind(tableOrdersStore),
  };
}
