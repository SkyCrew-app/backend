import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

// Indexes for what the screens and the jobs filter on: the foreign keys
// (Postgres does not index them by itself), the time ranges of bookings,
// a member's notifications by read state, and the trace's filters. Each one
// is created only if missing; one that cannot be created is reported and
// does not stop the start-up.
const INDEXES: [string, string][] = [
  [
    'IDX_reservations_user_start',
    `CREATE INDEX IF NOT EXISTS "IDX_reservations_user_start" ON "reservations" ("userId", "start_time")`,
  ],
  [
    'IDX_reservations_instructor_start',
    `CREATE INDEX IF NOT EXISTS "IDX_reservations_instructor_start" ON "reservations" ("instructorId", "start_time")`,
  ],
  [
    'IDX_reservations_start_time',
    `CREATE INDEX IF NOT EXISTS "IDX_reservations_start_time" ON "reservations" ("start_time")`,
  ],
  [
    'IDX_reservations_end_time',
    `CREATE INDEX IF NOT EXISTS "IDX_reservations_end_time" ON "reservations" ("end_time")`,
  ],
  [
    'IDX_flights_user',
    `CREATE INDEX IF NOT EXISTS "IDX_flights_user" ON "flights" ("userId")`,
  ],
  [
    'IDX_flights_instructor',
    `CREATE INDEX IF NOT EXISTS "IDX_flights_instructor" ON "flights" ("instructorId")`,
  ],
  [
    'IDX_flights_reservation',
    `CREATE INDEX IF NOT EXISTS "IDX_flights_reservation" ON "flights" ("reservationId")`,
  ],
  [
    'IDX_notifications_user_read_date',
    `CREATE INDEX IF NOT EXISTS "IDX_notifications_user_read_date" ON "notifications" ("userId", "is_read", "notification_date")`,
  ],
  [
    'IDX_payments_user_date',
    `CREATE INDEX IF NOT EXISTS "IDX_payments_user_date" ON "payments" ("userId", "payment_date")`,
  ],
  [
    'IDX_payments_date',
    `CREATE INDEX IF NOT EXISTS "IDX_payments_date" ON "payments" ("payment_date")`,
  ],
  [
    'IDX_payments_reservation',
    `CREATE INDEX IF NOT EXISTS "IDX_payments_reservation" ON "payments" ("reservation_id")`,
  ],
  [
    'IDX_payments_invoice',
    `CREATE INDEX IF NOT EXISTS "IDX_payments_invoice" ON "payments" ("invoiceId")`,
  ],
  [
    'IDX_invoices_user',
    `CREATE INDEX IF NOT EXISTS "IDX_invoices_user" ON "invoices" ("userId")`,
  ],
  [
    'IDX_courses_instructor_start',
    `CREATE INDEX IF NOT EXISTS "IDX_courses_instructor_start" ON "instruction_courses" ("instructorId", "startTime")`,
  ],
  [
    'IDX_courses_student_start',
    `CREATE INDEX IF NOT EXISTS "IDX_courses_student_start" ON "instruction_courses" ("studentId", "startTime")`,
  ],
  [
    'IDX_courses_reservation',
    `CREATE INDEX IF NOT EXISTS "IDX_courses_reservation" ON "instruction_courses" ("reservationId")`,
  ],
  [
    'IDX_licenses_user',
    `CREATE INDEX IF NOT EXISTS "IDX_licenses_user" ON "licenses" ("userId")`,
  ],
  [
    'IDX_expenses_date',
    `CREATE INDEX IF NOT EXISTS "IDX_expenses_date" ON "expenses" ("expense_date")`,
  ],
  [
    'IDX_maintenance_aircraft',
    `CREATE INDEX IF NOT EXISTS "IDX_maintenance_aircraft" ON "maintenance" ("aircraftId")`,
  ],
  [
    'IDX_admin_actions_action_created',
    `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_action_created" ON "admin_actions" ("action", "created_at")`,
  ],
  [
    'IDX_admin_actions_member',
    `CREATE INDEX IF NOT EXISTS "IDX_admin_actions_member" ON "admin_actions" (("summary" ->> 'memberId'))`,
  ],
];

export class AddQueryIndexes1794000000001 implements MigrationInterface {
  name = 'AddQueryIndexes1794000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, statement] of INDEXES) {
      // A savepoint keeps the migration's transaction usable after a failure.
      await queryRunner.query(`SAVEPOINT "${name}"`);
      try {
        await queryRunner.query(statement);
        await queryRunner.query(`RELEASE SAVEPOINT "${name}"`);
      } catch (error) {
        await queryRunner.query(`ROLLBACK TO SAVEPOINT "${name}"`);
        new Logger('Migration').warn(
          `Index "${name}" not created: ${(error as Error)?.message}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
    }
  }
}
