
export interface EventProduct {
  event_name: string;
  start_date: string;
  end_date: string;
  barcode: string;
  item_name: string;
}

export interface EventData {
  event_id: string;
  event_name: string;
  start_date: string;
  end_date: string;
  products: EventProduct[];
}

export interface DailySaleRecord {
  id?: number;
  sales_day: string;
  layer1_code: string;
  barcode: string;
  item_name: string;
  qty: number;
  amount_excl_tax: number;
  transaction: string;
}

export type ActiveTab = 'overview' | 'events' | 'daily_sales';
