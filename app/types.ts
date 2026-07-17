export type Product = {
  id: string; partner_id: string; name: string; category: string; price: number;
  original_price: number | null; visual: string; visual_tone: string; rating: number;
  sold: number; stock: number; badge: string | null; description: string; active: number;
};

export type Partner = {
  id: string; name: string; type: "vet" | "shop" | "both"; address: string;
  latitude: number; longitude: number; phone: string; rating: number; review_count: number;
  open_now: number; accepting_appointments: number; hours: string; services: string;
  distance_km: number; verified: number;
};

export type Pet = {
  id: string; owner_email: string; name: string; species: string; breed: string; sex: string;
  date_of_birth: string; weight_kg: number; blood_type: string | null; microchip: string | null;
  allergies: string; notes: string; avatar: string; qr_token: string;
};

export type Vaccination = {
  id: string; pet_id: string; vaccine_name: string; dose: string; administered_at: string;
  next_due_at: string | null; provider_name: string; batch_number: string;
  status: "completed" | "due" | "overdue";
};

export type MedicalRecord = {
  id: string; pet_id: string; partner_id: string; appointment_id: string | null;
  diagnosis: string; treatment: string; prescription: string; clinician: string;
  visited_at: string; notes: string; partner_name: string;
};

export type Appointment = {
  id: string; owner_email: string; pet_id: string; partner_id: string; scheduled_at: string;
  reason: string; note: string; status: "pending" | "confirmed" | "completed" | "cancelled";
  pet_name: string; partner_name: string; pet_avatar?: string; pet_breed?: string;
};

export type PartnerRole = "owner" | "manager" | "clinician" | "staff";

export type Order = {
  id: string; order_code: string; owner_email: string; partner_id: string;
  total_amount: number; status: "pending_payment" | "payment_review" | "paid" | "cancelled" | "fulfilled";
  created_at: string; updated_at: string; partner_name: string;
  items?: Array<{ id: string; product_id: string; product_name: string; unit_price: number; quantity: number; line_total: number }>;
};

export type AppData = {
  actor: { email: string; fullName: string; isDemo: boolean } | null;
  requiresSignIn: boolean;
  products: Product[]; partners: Partner[]; pets: Pet[]; appointments: Appointment[];
  vaccinations: Vaccination[]; medicalRecords: MedicalRecord[];
  partnerRoles: Array<{ partner_id: string; role: PartnerRole; name: string }>;
  partnerAppointments: Appointment[]; partnerProducts: Product[]; partnerPets: Pet[];
  orders: Order[]; partnerOrders: Order[];
};
