import { MigrationInterface, QueryRunner } from 'typeorm';

// The constraints carry the names TypeORM gives them, so that a database
// created by schema synchronisation (development) and one created by this
// migration are the same.
const COURSE_BOOKING_FK = 'FK_87ae995f4ec85db4d761b2fce86';
const FOREIGN_KEYS: [string, string, string, string][] = [
  // [constraint, table, column, what happens when the member goes]
  [
    'FK_cd37ec84d18dd78e34f0cd6d40e',
    'reservations',
    'instructorId',
    'NO ACTION',
  ],
  ['FK_33914d15c34aef948b7da189a05', 'flights', 'instructorId', 'NO ACTION'],
  [
    'FK_7b09a0a30ed3740a3f2620173a9',
    'course_competencies',
    'validatedById',
    'NO ACTION',
  ],
];

// Instruction flights: a booking and its flights carry an instructor, a
// course can point to its booking, and a validated competency says who
// validated it and when.
export class AddInstructionFlights1793000000001 implements MigrationInterface {
  name = 'AddInstructionFlights1793000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "instructorId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" ADD COLUMN IF NOT EXISTS "instructorId" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_competencies" ADD COLUMN IF NOT EXISTS "validatedById" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_competencies" ADD COLUMN IF NOT EXISTS "validatedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "instruction_courses" ADD COLUMN IF NOT EXISTS "reservationId" integer`,
    );

    for (const [name, table, column, onDelete] of FOREIGN_KEYS) {
      await queryRunner.query(
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${name}') THEN
            ALTER TABLE "${table}" ADD CONSTRAINT "${name}" FOREIGN KEY ("${column}") REFERENCES "users"("id") ON DELETE ${onDelete} ON UPDATE NO ACTION;
          END IF;
        END $$`,
      );
    }
    // A cancelled booking is deleted: its course stays, without an aircraft.
    await queryRunner.query(
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${COURSE_BOOKING_FK}') THEN
          ALTER TABLE "instruction_courses" ADD CONSTRAINT "${COURSE_BOOKING_FK}" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$`,
    );

    // Courses planned without an end get the default duration (one hour,
    // DEFAULT_COURSE_MINUTES): conflicts and completion rely on the end.
    await queryRunner.query(
      `UPDATE "instruction_courses" SET "endTime" = "startTime" + interval '60 minutes' WHERE "endTime" IS NULL`,
    );
  }

  // The end times filled in by `up` are kept: nothing says which were empty.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "instruction_courses" DROP CONSTRAINT IF EXISTS "${COURSE_BOOKING_FK}"`,
    );
    for (const [name, table] of FOREIGN_KEYS) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "instruction_courses" DROP COLUMN IF EXISTS "reservationId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_competencies" DROP COLUMN IF EXISTS "validatedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_competencies" DROP COLUMN IF EXISTS "validatedById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" DROP COLUMN IF EXISTS "instructorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP COLUMN IF EXISTS "instructorId"`,
    );
  }
}
