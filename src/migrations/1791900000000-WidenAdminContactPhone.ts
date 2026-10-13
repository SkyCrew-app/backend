import { MigrationInterface, QueryRunner } from 'typeorm';

// An international number is a "+" and up to 15 digits: one character more
// than the column held.
export class WidenAdminContactPhone1791900000000 implements MigrationInterface {
  name = 'WidenAdminContactPhone1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin" ALTER COLUMN "contactPhone" TYPE character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "admin" ALTER COLUMN "contactPhone" TYPE character varying(15) USING left("contactPhone", 15)`,
    );
  }
}
