import { MigrationInterface, QueryRunner } from 'typeorm';

// Question options were stored comma-joined, so an option containing a comma
// was split in several on read. They are now stored as a JSON array.
//
// Existing rows are converted with the same split the application applied,
// which keeps every question as users see it today. A question whose option
// was already split has to be edited once to restore the intended options.
export class StoreQuestionOptionsAsJson1791551715342
  implements MigrationInterface
{
  name = 'StoreQuestionOptionsAsJson1791551715342';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "questions"
          SET "options" = COALESCE(
                array_to_json(string_to_array("options", ','))::text,
                '[]'
              )
        WHERE "options" IS NULL OR left(btrim("options"), 1) <> '['`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "questions"
          SET "options" = COALESCE(
                (SELECT string_agg(value, ',')
                   FROM json_array_elements_text("options"::json)),
                ''
              )
        WHERE left(btrim("options"), 1) = '['`,
    );
  }
}
