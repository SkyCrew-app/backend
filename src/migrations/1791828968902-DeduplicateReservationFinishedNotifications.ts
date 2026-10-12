import { MigrationInterface, QueryRunner } from 'typeorm';

// The hourly job used to send "reservation finished" again at every run.
// Keep the first reminder of each reservation and drop the repeats.
export class DeduplicateReservationFinishedNotifications1791828968902
  implements MigrationInterface
{
  name = 'DeduplicateReservationFinishedNotifications1791828968902';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "notifications" n
       USING "notifications" kept
       WHERE n."notification_type" = 'RESERVATION_FINISHED'
         AND kept."notification_type" = 'RESERVATION_FINISHED'
         AND n."userId" IS NOT DISTINCT FROM kept."userId"
         AND n."message" = kept."message"
         AND n."id" > kept."id"`,
    );
    // Same wording as the job now uses, so it recognises what it already sent.
    await queryRunner.query(
      `UPDATE "notifications"
       SET "message" = REPLACE("message", 'cloturer', 'clôturer')
       WHERE "notification_type" = 'RESERVATION_FINISHED'`,
    );
  }

  public async down(): Promise<void> {
    // Deleted repeats cannot be restored.
  }
}
