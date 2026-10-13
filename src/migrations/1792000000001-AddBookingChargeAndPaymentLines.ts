import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';

// The price of a booking is stored on the booking when it is charged, and
// every movement of a member's balance is a payment line of a known kind.
export class AddBookingChargeAndPaymentLines1792000000001
  implements MigrationInterface
{
  name = 'AddBookingChargeAndPaymentLines1792000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "charged_amount" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "kind" character varying(30) NOT NULL DEFAULT 'top_up'`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reservation_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_amount" numeric(10,2) NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_by_id" integer`,
    );

    // Existing lines: what was paid from the balance was a booking.
    await queryRunner.query(
      `UPDATE "payments"
       SET "kind" = 'booking'
       WHERE "kind" = 'top_up'
         AND lower(trim("payment_method")) IN ('account_balance', 'solde compte')`,
    );
    // A top-up already marked refunded is not refunded a second time.
    await queryRunner.query(
      `UPDATE "payments"
       SET "refunded_amount" = "amount"
       WHERE "kind" = 'top_up'
         AND "payment_status" = 'refunded'
         AND "refunded_amount" = 0`,
    );

    // Existing bookings take the amount of the withdrawal that paid them: for
    // each member, bookings and withdrawals of the same amount are paired in
    // the order they were created. A booking without a matching withdrawal
    // keeps an unknown price, and is refunded nothing automatically.
    await queryRunner.query(
      `WITH priced AS (
         SELECT r."id", r."userId",
                round((extract(epoch FROM (r."end_time" - r."start_time")) / 3600.0 * a."hourly_cost")::numeric, 2) AS "price"
         FROM "reservations" r
         JOIN "aircraft" a ON a."id" = r."aircraftId"
         WHERE r."charged_amount" IS NULL AND r."end_time" > r."start_time"
       ),
       ranked_reservations AS (
         SELECT "id", "userId", "price",
                row_number() OVER (PARTITION BY "userId", "price" ORDER BY "id") AS "position"
         FROM priced
       ),
       ranked_payments AS (
         SELECT p."id", p."userId", p."amount",
                row_number() OVER (PARTITION BY p."userId", p."amount" ORDER BY p."id") AS "position"
         FROM "payments" p
         WHERE p."kind" = 'booking'
           AND p."payment_status" = 'completed'
           AND p."reservation_id" IS NULL
       ),
       matched AS (
         SELECT rr."id" AS "reservation_id", rp."id" AS "payment_id", rp."amount"
         FROM ranked_reservations rr
         JOIN ranked_payments rp
           ON rp."userId" = rr."userId"
          AND rp."amount" = rr."price"
          AND rp."position" = rr."position"
       ),
       linked AS (
         UPDATE "payments" p
         SET "reservation_id" = m."reservation_id"
         FROM matched m
         WHERE p."id" = m."payment_id"
       )
       UPDATE "reservations" r
       SET "charged_amount" = m."amount"
       FROM matched m
       WHERE r."id" = m."reservation_id"`,
    );

    // Invoices were written without their member.
    await queryRunner.query(
      `UPDATE "invoices" i
       SET "userId" = p."userId"
       FROM "payments" p
       WHERE p."invoiceId" = i."id"
         AND i."userId" IS NULL
         AND p."userId" IS NOT NULL`,
    );

    const [{ count }] = await queryRunner.query(
      `SELECT count(*)::int AS "count"
       FROM "reservations"
       WHERE "charged_amount" IS NULL AND "start_time" > now()`,
    );
    if (count > 0) {
      new Logger('Migration').warn(
        `${count} upcoming booking(s) have no matching withdrawal: their price is unknown, so cancelling them refunds nothing automatically. Credit the member by hand if needed.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "created_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "refunded_amount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "reservation_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP COLUMN IF EXISTS "kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN IF EXISTS "charged_amount"`,
    );
  }
}
