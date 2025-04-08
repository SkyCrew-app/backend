export interface UsersByRole {
  roleId: number;
  role_name: string;
  count: number;
}

export interface ReservationsByCategory {
  flight_category: string;
  count: number;
}

export interface AdminDashboardStats {
  totalUsers: number;
  totalAircrafts: number;
  totalReservations: number;
  totalFlights: number;
  totalIncidents: number;
  availableAircrafts: number;
  pendingReservations: number;
  flightHoursThisMonth: number;
  usersByRole: UsersByRole[];
  reservationsByCategory: ReservationsByCategory[];
}
