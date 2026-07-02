// --------------- Pagination ---------------

export interface PaginationParams {
  page?: number;
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// --------------- Auth ---------------

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterOrgInput {
  siret?: string | null;
  legal_form?: string | null;
  vat_number?: string | null;
  naf_code?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  billing_email?: string | null;
  website?: string | null;
}

export interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  role?: UserRole;
  company_name?: string;
  invitation_token?: string;
  organization?: RegisterOrgInput;
}

export interface AuthResponse {
  user: MeResponse;
  access_token: string;
  refresh_token: string;
}

export type UserRole = 'admin' | 'prestataire';

export interface Membership {
  organization_id: string;
  organization_name: string;
  role: UserRole;
}

export interface MeResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  company_name?: string;
  /** Entreprise propre du prestataire (indépendante de l'org). */
  provider_company?: string | null;
  provider_siret?: string | null;
  provider_vat_number?: string | null;
  provider_address?: string | null;
  is_active: boolean;
  push_enabled?: boolean;
  created_at: string;
  updated_at: string;
  organization_id?: string;
  active_organization_id?: string;
  memberships?: Membership[];
}

// --------------- Logement ---------------

export interface Logement {
  id: string;
  organization_id: string;
  created_by: string;
  proprietaire_user_id: string | null;
  client_id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  n_bedrooms: number;
  n_bathrooms: number;
  n_wc: number;
  n_kitchens: number;
  n_living_rooms: number;
  n_exterior_spaces: number;
  n_lit_simple: number;
  n_lit_double: number;
  n_canape_lit: number;
  n_lit_appoint: number;
  has_basement: boolean;
  has_laundry: boolean;
  has_pool: boolean;
  has_jacuzzi: boolean;
  /** Prestations proposées sur ce logement (pilote la création de check-in/check-out). */
  enable_check_in: boolean;
  enable_check_out: boolean;
  surface_m2: number | null;
  notes: string | null;
  key_safe_code: string | null;
  cover_photo_url: string | null;
  default_duration_min: number | null;
  default_client_price_ht: number | string | null;
  default_client_vat_rate: number | string | null;
  default_provider_price: number | string | null;
  default_laundry_included: boolean;
  default_laundry_client_price_ht: number | string | null;
  default_laundry_provider_price: number | string | null;
  default_horaire_debut: string | null;
  default_horaire_fin: string | null;
  color: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLogementInput {
  name: string;
  client_id?: string;
  key_safe_code?: string;
  cover_photo_url?: string;
  default_duration_min?: number;
  default_client_price_ht?: number;
  default_client_vat_rate?: number;
  default_provider_price?: number;
  default_laundry_included?: boolean;
  default_laundry_client_price_ht?: number;
  default_laundry_provider_price?: number;
  default_horaire_debut?: string;
  default_horaire_fin?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  n_bedrooms?: number;
  n_bathrooms?: number;
  n_wc?: number;
  n_kitchens?: number;
  n_living_rooms?: number;
  n_exterior_spaces?: number;
  n_lit_simple?: number;
  n_lit_double?: number;
  n_canape_lit?: number;
  n_lit_appoint?: number;
  has_basement?: boolean;
  has_laundry?: boolean;
  has_pool?: boolean;
  has_jacuzzi?: boolean;
  enable_check_in?: boolean;
  enable_check_out?: boolean;
  surface_m2?: number;
  notes?: string;
  proprietaire_user_id?: string;
  color?: string;
}

export type UpdateLogementInput = Partial<CreateLogementInput>;

// --------------- Menage ---------------

export type MenageStatus = 'a_venir' | 'en_cours' | 'termine' | 'valide' | 'annule';

/** Type de prestation d'un ménage. `menage` = nettoyage classique (défaut). */
export type PrestationType = 'menage' | 'check_in' | 'check_out';

/** Libellé du type de prestation pour affichage (badge). */
export function prestationTypeLabel(type?: PrestationType | null): string {
  switch (type) {
    case 'check_in':
      return 'Check-in';
    case 'check_out':
      return 'Check-out';
    default:
      return 'Ménage';
  }
}

export function menagePrestataireLabel(m: {
  prestataire_user_id: string | null;
  prestataire_first_name?: string | null;
  prestataire_last_name?: string | null;
}): string {
  if (!m.prestataire_user_id) return 'Non assigné';
  return [m.prestataire_first_name, m.prestataire_last_name].filter(Boolean).join(' ') || '—';
}

export function menageLogementLabel(m: {
  logement_name?: string | null;
  logement_address?: string | null;
  logement_city?: string | null;
}): string {
  return (
    m.logement_name ||
    [m.logement_address, m.logement_city].filter(Boolean).join(' ') ||
    'Logement inconnu'
  );
}

export interface Menage {
  id: string;
  logement_id: string;
  organization_id: string;
  created_by: string;
  prestataire_user_id: string | null;
  status: MenageStatus;
  /** Type de prestation : ménage (défaut), check-in (arrivée) ou check-out (départ). */
  prestation_type: PrestationType;
  date_prevue: string;
  /** Prochain check-in du logement (arrivée du prochain voyageur, via iCal). */
  next_checkin_at?: string | null;
  /** Nb de nuits du séjour nettoyé (via iCal). */
  stay_nights?: number | null;
  /** True quand la date a été manuellement override (reschedule appliqué ou PATCH admin sur un ménage iCal) → la sync iCal ne l'écrase plus. */
  date_locked?: boolean;
  horaire_prevu: string | null;
  horaire_fin_prevu: string | null;
  duree_estimee_min: number | null;
  date_realisation: string | null;
  arrived_at: string | null;
  departed_at: string | null;
  arrival_photo_url?: string | null;
  arrival_lat?: number | string | null;
  arrival_lng?: number | string | null;
  departure_photo_url?: string | null;
  departure_lat?: number | string | null;
  departure_lng?: number | string | null;
  prix_prevu: number | string | null;
  client_price_ht?: number | string | null;
  client_vat_rate?: number | string | null;
  provider_price?: number | string | null;
  currency?: string;
  laundry_included?: boolean;
  laundry_client_price_ht?: number | string | null;
  laundry_provider_price?: number | string | null;
  n_lit_simple: number;
  n_lit_double: number;
  n_canape_lit: number;
  n_lit_appoint: number;
  n_travelers: number | null;
  validated_at: string | null;
  validated_by: string | null;
  validated_price: number | string | null;
  notes_intervention: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** Origine : null = créé manuellement, `cal_<provider>` = calendrier externe. */
  external_source?: string | null;
  /** Champs joints depuis user (prestataire) — peuplés par GET /menages et GET /menages/:id */
  prestataire_first_name?: string | null;
  prestataire_last_name?: string | null;
  prestataire_avatar_url?: string | null;
  /** Champs joints depuis logement */
  logement_name?: string | null;
  logement_address?: string | null;
  logement_city?: string | null;
  logement_color?: string | null;
  /** True s'il existe au moins une demande de report `pending` sur ce ménage. */
  has_pending_reschedule?: boolean;
  /** Calculé côté API : jour passé + aucun pointage + statut a_venir. */
  needs_attention?: boolean;
}

/** Libellé d'origine d'un ménage pour affichage (badge). */
export function menageSourceLabel(externalSource?: string | null): string {
  if (!externalSource) return 'Manuel';
  const provider = externalSource.replace(/^cal_/, '');
  const map: Record<string, string> = {
    airbnb: 'Airbnb',
    booking: 'Booking',
    vrbo: 'Vrbo',
    ical: 'iCal',
  };
  return map[provider] ?? 'Externe';
}

export interface CreateMenageInput {
  logement_id: string;
  prestataire_user_id?: string;
  prestation_type?: PrestationType;
  date_prevue: string;
  horaire_prevu?: string;
  horaire_fin_prevu?: string;
  duree_estimee_min?: number;
  prix_prevu?: number;
  client_price_ht?: number;
  client_vat_rate?: number;
  provider_price?: number;
  currency?: string;
  laundry_included?: boolean;
  laundry_client_price_ht?: number;
  laundry_provider_price?: number;
  n_lit_simple?: number;
  n_lit_double?: number;
  n_canape_lit?: number;
  n_lit_appoint?: number;
  notes_intervention?: string;
}

export interface UpdateMenageInput {
  prestataire_user_id?: string | null;
  date_prevue?: string;
  horaire_prevu?: string | null;
  horaire_fin_prevu?: string | null;
  duree_estimee_min?: number | null;
  prix_prevu?: number | null;
  client_price_ht?: number | null;
  client_vat_rate?: number | null;
  provider_price?: number | null;
  currency?: string;
  laundry_included?: boolean;
  laundry_client_price_ht?: number | null;
  laundry_provider_price?: number | null;
  n_lit_simple?: number;
  n_lit_double?: number;
  n_canape_lit?: number;
  n_lit_appoint?: number;
  n_travelers?: number | null;
  notes_intervention?: string | null;
  status?: MenageStatus;
  arrived_at?: string | null;
  departed_at?: string | null;
  /** Déverrouille la date pour ré-autoriser la sync iCal à l'écraser. */
  date_locked?: boolean;
}

export interface ValidateReportInput {
  price?: number;
}

// --------------- Logement Member ---------------

export type LogementMemberRole = 'manager' | 'prestataire' | 'client_proprietaire';

export interface LogementMember {
  id: string;
  logement_id: string;
  user_id: string;
  role: LogementMemberRole;
  can_view_comments: boolean;
  can_view_photos: boolean;
  can_view_checklist: boolean;
  can_view_team: boolean;
  can_edit: boolean;
  can_view_prestataires: boolean;
  can_view_responsables: boolean;
  can_view_clients: boolean;
  created_at: string;
  updated_at: string;
  // Joins
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  avatar_url?: string | null;
}

export interface CreateLogementMemberInput {
  logement_id: string;
  user_id: string;
  role: LogementMemberRole;
  can_view_comments?: boolean;
  can_view_photos?: boolean;
  can_view_checklist?: boolean;
  can_view_team?: boolean;
  can_edit?: boolean;
  can_view_prestataires?: boolean;
  can_view_responsables?: boolean;
  can_view_clients?: boolean;
}

export interface UpdateLogementMemberInput {
  role?: LogementMemberRole;
  can_view_comments?: boolean;
  can_view_photos?: boolean;
  can_view_checklist?: boolean;
  can_view_team?: boolean;
  can_edit?: boolean;
  can_view_prestataires?: boolean;
  can_view_responsables?: boolean;
  can_view_clients?: boolean;
}

// --------------- Menage Check (checklist) ---------------

export type SectionType =
  | 'kitchen'
  | 'living_room'
  | 'bedroom'
  | 'bathroom'
  | 'wc'
  | 'exterior'
  | 'basement'
  | 'laundry'
  | 'general';

export interface MenageCheckSection {
  id: string;
  menage_id: string;
  section_type: SectionType;
  section_label: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface MenageCheckItem {
  id: string;
  section_id: string;
  item_label: string;
  position: number;
  validated_at: string | null;
  validated_by: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export type MenageCheckTree = (MenageCheckSection & { items: MenageCheckItem[] })[];

export interface CreateSectionInput {
  menage_id: string;
  section_type: SectionType;
  section_label: string;
  position?: number;
}

export interface UpdateSectionInput {
  section_label?: string;
  position?: number;
}

export interface CreateItemInput {
  section_id: string;
  item_label: string;
  position?: number;
}

export interface UpdateItemInput {
  item_label?: string;
  comment?: string | null;
  position?: number;
}

export interface ToggleItemInput {
  validated: boolean;
  comment?: string;
}

// --------------- Comment ---------------

export interface Comment {
  id: string;
  menage_id: string;
  section_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentInput {
  menage_id: string;
  section_id?: string | null;
  content: string;
}

export interface UpdateCommentInput {
  content?: string;
}

// --------------- Photo ---------------

export interface Photo {
  id: string;
  menage_id: string | null;
  section_id: string | null;
  logement_id: string | null;
  logement_room_id: string | null;
  uploaded_by: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  taken_at: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePhotoInput {
  menage_id?: string;
  section_id?: string;
  logement_id?: string;
  logement_room_id?: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  taken_at: string;
  file_size?: number;
  mime_type?: string;
}

// --------------- Earnings ---------------

export interface EarningsItem {
  id: string;
  date_prevue: string;
  logement_id: string;
  status: string;
  provider_price: string | number | null;
  laundry_provider_price: string | number | null;
  laundry_included: boolean;
  subtotal: number;
  validated_at: string | null;
}

export interface EarningsSummary {
  total: number;
  currency: string;
  count: number;
  from: string | null;
  to: string | null;
  items: EarningsItem[];
}

// --------------- Reschedule request ---------------

export type RescheduleStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface RescheduleRequest {
  id: string;
  menage_id: string;
  requested_by: string;
  original_date: string;
  proposed_date: string;
  proposed_time: string | null;
  reason: string | null;
  status: RescheduleStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRescheduleRequestInput {
  menage_id: string;
  proposed_date: string;
  proposed_time?: string;
  reason?: string;
}

// --------------- Invitation ---------------

export interface Invitation {
  id: string;
  email: string;
  invited_by: string;
  organization_id: string;
  role: UserRole;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expires_at: string;
  created_at: string;
}
