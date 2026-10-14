export type Status =
  | "VERIFIED_MATCH"
  | "CONFLICT"
  | "PARTIAL_MATCH"
  | "UNKNOWN";
export type Requirement = {
  key: string;
  label: string;
  value: string;
  page: number;
  evidence: string;
  critical: boolean;
  confidence: number;
  origin: "document" | "manual" | "ai";
};
export type Item = {
  name: string;
  quantity: string | null;
  unit: string;
  page: number;
  evidence: string;
  category: string | null;
  origin?: string;
  requirements: Requirement[];
};
export type Tender = {
  title: string;
  identifier: string | null;
  buyer: string | null;
  region: string | null;
  source: string;
  method: string | null;
  budget: string | null;
  deadline: string | null;
  delivery_date: string | null;
  delivery_days: number | null;
  payment_days: number | null;
  delivery_evidence: string | null;
  delivery_page: number | null;
  payment_evidence: string | null;
  payment_page: number | null;
  synthetic: boolean;
  items: Item[];
  constraints: Requirement[];
  warnings: string[];
};
export type Product = {
  id: number | null;
  name: string;
  sku: string;
  quantity: string;
  unit: string;
  acquisition_cost: string | null;
  supplier_cost: string | null;
  supplier: string | null;
  supplier_confirmed: boolean;
  lead_days: number | null;
  attributes: Record<string, string>;
  raw: Record<string, string>;
  row: number;
  manual_fields?: string[];
  edited_at?: string | null;
};
export type MatrixRow = {
  id: string;
  line: number;
  item: string;
  requirement: string;
  property: string;
  required: string | null;
  actual: string | null;
  page: number;
  critical: boolean;
  origin: string;
  confidence: number;
  product_name: string | null;
  product_id: number | null;
  sku: string | null;
  row: number | null;
  inventory_evidence: Record<string, string>;
  status: Status;
  selected: boolean;
  explanation: string;
  action: string;
};
export type Matches = {
  matrix: MatrixRow[];
  selected: {
    line: number;
    item: string;
    product: Product | null;
    required: string | null;
    available: string;
    missing: string | null;
  }[];
  cost_lines: {
    name: string;
    quantity: string | null;
    available: string;
    acquisition_cost: string | null;
    supplier_cost: string | null;
    supplier_confirmed: boolean;
  }[];
  counts: Record<Status, number>;
};
export type Scenario = {
  offer_price: string;
  delivery: string;
  packaging: string;
  other: string;
  tax_rate: string;
  target_margin: string;
  annual_financing_rate: string;
  payment_days: number;
  advance_rate: string;
  cash_available: string;
  delivery_days: number;
  line_overrides: Record<string, Record<string, string | null>>;
};
export type Finance = {
  complete: boolean;
  revenue: string;
  inventory_cost: string | null;
  purchase_cost: string | null;
  delivery: string;
  packaging: string;
  other: string;
  tax: string;
  financing_cost: string | null;
  total_cost: string | null;
  profit: string | null;
  margin: string | null;
  break_even: string | null;
  target_price: string | null;
  incremental_cash: string | null;
  cash_gap: string | null;
  missing_units: string;
  lines: {
    name: string;
    required?: string;
    available?: string;
    missing: string | null;
    acquisition_cost?: string | null;
    supplier_cost?: string | null;
    inventory_cost?: string | null;
    purchase_cost?: string | null;
    economic_cost: string | null;
  }[];
  warnings: string[];
  cash_flow: {
    day: number;
    label: string;
    flow: string | null;
    balance: string | null;
  }[];
  formula: string;
};
export type Risk = {
  id: string;
  title: string;
  group: string;
  severity: string;
  description: string;
  consequence: string;
  action: string;
  page: number | null;
  evidence: string | null;
  method: string;
};
export type Analysis = {
  id: string;
  catalog_id: string;
  state: string;
  mode: string;
  synthetic: boolean;
  created_at: string;
  updated_at: string;
  tender: Tender;
  scenario: Scenario;
  sources: {
    name: string;
    pages: { page: number; text: string; tables: string[][][]; ocr: boolean }[];
  };
  matches?: Matches;
  financial?: Finance;
  risks?: Risk[];
  decision?: "READY_FOR_REVIEW" | "REQUIRES_ATTENTION" | "NOT_FEASIBLE";
};
export type Catalog = {
  id: string;
  name: string;
  count: number;
  synthetic: boolean;
  created_at: string;
};
export type Job = {
  id: string;
  status: string;
  stage: string;
  events: { stage: string; at: string }[];
  analysis_id: string | null;
  error: string | null;
  mode: string;
};
export type Discovery = Tender & {
  id: string;
  data_type: "synthetic" | "imported";
  live: boolean;
};
