import { MigrationInterface, QueryRunner } from 'typeorm';

// Invitation links: only the SHA-256 of the token stays in the database,
// like password reset links. The tokens of invitations already sent are
// hashed in place, so those links keep working until they expire.
export class HashInvitationTokens1793100000002 implements MigrationInterface {
  name = 'HashInvitationTokens1793100000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A value that already looks like a hash (64 hexadecimal characters) is
    // left alone: running this twice changes nothing.
    await queryRunner.query(
      `UPDATE "users"
       SET "validation_token" = encode(sha256(convert_to("validation_token", 'UTF8')), 'hex')
       WHERE "validation_token" IS NOT NULL
         AND "validation_token" !~ '^[0-9a-f]{64}$'`,
    );
  }

  // A hash cannot be turned back into its token: the links sent before the
  // rollback stop working, and an administrator sends the invitations again.
  public async down(): Promise<void> {}
}
