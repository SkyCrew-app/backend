import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1791532536401 implements MigrationInterface {
  name = 'InitialSchema1791532536401';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Databases created before migrations existed already have this schema,
    // produced by `synchronize`. Record the migration without replaying it.
    if (await queryRunner.hasTable('users')) {
      return;
    }

    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_maintenance_type_enum" AS ENUM('INSPECTION', 'REPAIR', 'OVERHAUL', 'SOFTWARE_UPDATE', 'CLEANING', 'OTHER')`,
    );
    await queryRunner.query(
      `CREATE TABLE "maintenance" ("id" SERIAL NOT NULL, "start_date" TIMESTAMP NOT NULL, "end_date" TIMESTAMP NOT NULL, "status" character varying, "maintenance_type" "public"."maintenance_maintenance_type_enum", "description" character varying, "parts_changed" character varying, "maintenance_cost" double precision, "images_url" text, "documents_url" text, "aircraftId" integer, "technicianId" integer, CONSTRAINT "PK_542fb6a28537140d2df95faa52a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_items_category_enum" AS ENUM('CELLULE', 'MOTEUR', 'AVIONIQUE', 'TRAIN_ATTERRISSAGE', 'SYSTEME_CARBURANT', 'SYSTEME_ELECTRIQUE', 'DOCUMENTATION', 'EQUIPEMENT_SECURITE', 'AUTRE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_items_result_enum" AS ENUM('CONFORME', 'NON_CONFORME', 'CONFORME_AVEC_REMARQUES', 'NON_APPLICABLE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_items" ("id" SERIAL NOT NULL, "category" "public"."audit_items_category_enum" NOT NULL DEFAULT 'AUTRE', "description" character varying NOT NULL, "result" "public"."audit_items_result_enum" NOT NULL DEFAULT 'CONFORME', "notes" text, "requires_action" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_29c9dcee199af96e49a46d7a58b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audits_audit_result_enum" AS ENUM('CONFORME', 'NON_CONFORME', 'CONFORME_AVEC_REMARQUES', 'NON_APPLICABLE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audits_audit_frequency_enum" AS ENUM('QUOTIDIEN', 'HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL', 'BIANNUEL', 'HEURES_DE_VOL', 'APRES_INCIDENT', 'AUTRE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audits" ("id" SERIAL NOT NULL, "audit_date" TIMESTAMP NOT NULL, "audit_result" "public"."audits_audit_result_enum" NOT NULL DEFAULT 'CONFORME', "audit_notes" text, "corrective_actions" text, "next_audit_date" TIMESTAMP, "audit_frequency" "public"."audits_audit_frequency_enum" NOT NULL DEFAULT 'ANNUEL', "is_closed" boolean NOT NULL DEFAULT false, "closed_date" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "aircraftId" integer, "auditorId" integer, "closedById" integer, CONSTRAINT "PK_b2d7a2089999197dc7024820f28" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."aircraft_availability_status_enum" AS ENUM('AVAILABLE', 'UNAVAILABLE', 'RESERVATED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "aircraft" ("id" SERIAL NOT NULL, "registration_number" character varying NOT NULL, "model" character varying NOT NULL, "year_of_manufacture" integer NOT NULL, "maxAltitude" integer, "cruiseSpeed" integer, "consumption" integer, "fuel_capacity" double precision, "fuel_type" character varying, "empty_weight" double precision, "max_takeoff_weight" double precision, "image_url" character varying, "documents_url" text, "availability_status" "public"."aircraft_availability_status_enum" NOT NULL DEFAULT 'AVAILABLE', "maintenance_status" character varying NOT NULL DEFAULT 'OK', "hourly_cost" double precision NOT NULL, "total_flight_hours" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_4fdd7024a58c8fce7fe75b89ad9" UNIQUE ("registration_number"), CONSTRAINT "PK_46f8c680e9ff88a752b7834bba4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "incidents" ("id" SERIAL NOT NULL, "incident_date" TIMESTAMP NOT NULL, "description" character varying NOT NULL, "damage_report" character varying, "corrective_actions" character varying, "severity_level" character varying NOT NULL, "status" character varying NOT NULL, "priority" character varying NOT NULL, "category" character varying NOT NULL, "aircraftId" integer, "flightId" integer, "userId" integer, CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "flights" ("id" SERIAL NOT NULL, "flight_hours" double precision NOT NULL, "flight_type" character varying NOT NULL, "origin_icao" character varying NOT NULL, "destination_icao" character varying NOT NULL, "weather_conditions" character varying, "number_of_passengers" integer NOT NULL, "encoded_polyline" text, "distance_km" double precision, "estimated_flight_time" double precision, "departure_time" TIMESTAMP WITH TIME ZONE, "arrival_time" TIMESTAMP WITH TIME ZONE, "waypoints" jsonb, "fuel_policy" jsonb, "wind_summary" jsonb, "performance_profile" character varying, "estimated_fuel_liters" double precision, "remarks" character varying, "reservationId" integer, "incidentId" integer, "userId" integer NOT NULL, CONSTRAINT "PK_c614ef3382fdd70b6d6c2c8d8dd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_status_enum" AS ENUM('pending', 'confirmed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservations_flight_category_enum" AS ENUM('local', 'cross_country', 'instruction', 'tourism', 'training', 'maintenance', 'private', 'corporate')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reservations" ("id" SERIAL NOT NULL, "reservation_date" TIMESTAMP, "start_time" TIMESTAMP NOT NULL, "end_time" TIMESTAMP NOT NULL, "estimated_flight_hours" double precision, "purpose" character varying, "status" "public"."reservations_status_enum" NOT NULL DEFAULT 'confirmed', "flight_category" "public"."reservations_flight_category_enum" NOT NULL DEFAULT 'local', "notes" character varying, "calendar_integration_url" character varying, "number_of_passengers" integer, "aircraftId" integer, "userId" integer, CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "licenses" ("id" SERIAL NOT NULL, "license_type" character varying NOT NULL, "issue_date" TIMESTAMP, "expiration_date" TIMESTAMP, "certification_authority" character varying, "is_valid" boolean NOT NULL DEFAULT true, "status" character varying NOT NULL DEFAULT 'active', "license_number" character varying, "documents_url" text, "userId" integer, CONSTRAINT "PK_da5021501ce80efa03de6f40086" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" SERIAL NOT NULL, "amount" numeric(10,2) NOT NULL, "payment_date" TIMESTAMP NOT NULL, "payment_method" character varying(50) NOT NULL, "payment_status" character varying(50) NOT NULL, "external_payment_id" character varying(255), "payment_details" text, "error_message" character varying(255), "userId" integer, "invoiceId" integer, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "invoices" ("id" SERIAL NOT NULL, "amount" numeric(10,2) NOT NULL, "invoice_date" TIMESTAMP NOT NULL, "payment_status" character varying(50) NOT NULL, "payment_method" character varying(50), "invoice_items" text, "amount_paid" numeric(10,2) NOT NULL DEFAULT '0', "balance_due" numeric(10,2) NOT NULL, "next_payment_due_date" TIMESTAMP, "userId" integer, CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "role_name" character varying NOT NULL, CONSTRAINT "UQ_ac35f51a0f17e3e1fe121126039" UNIQUE ("role_name"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."courses_required_license_enum" AS ENUM('PPL', 'ATPL', 'CPL')`,
    );
    await queryRunner.query(
      `CREATE TABLE "courses" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "title" character varying NOT NULL, "description" character varying, "category" character varying, "required_license" "public"."courses_required_license_enum", CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "lessons" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "title" character varying NOT NULL, "description" character varying, "content" jsonb NOT NULL, "video_url" character varying, "attachments" text array NOT NULL DEFAULT '{}', "moduleId" integer, CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "modules" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "title" character varying NOT NULL, "description" character varying, "course_id" integer NOT NULL, CONSTRAINT "PK_7dbefd488bd96c5bf31f0ce0c95" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_progress" ("id" SERIAL NOT NULL, "completed" boolean NOT NULL DEFAULT false, "score" double precision, "passed" boolean NOT NULL DEFAULT false, "completed_at" TIMESTAMP, "userId" integer, "lessonId" integer, "evaluationId" integer, CONSTRAINT "PK_7b5eb2436efb0051fdf05cbe839" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "evaluations" ("id" SERIAL NOT NULL, "pass_score" integer NOT NULL DEFAULT '0', "moduleId" integer, CONSTRAINT "PK_f683b433eba0e6dae7e19b29e29" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "questions" ("id" SERIAL NOT NULL, "content" jsonb NOT NULL, "options" text NOT NULL, "correct_answer" character varying NOT NULL, "evaluation_id" integer NOT NULL, CONSTRAINT "PK_08a6d4b0f49ff300bf3a0ca60ac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "answers" ("id" SERIAL NOT NULL, "answer_text" character varying, "is_correct" boolean NOT NULL DEFAULT false, "submitted_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "questionId" integer, CONSTRAINT "PK_9c32cec6c71e06da0254f2226c6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "first_name" character varying NOT NULL, "last_name" character varying NOT NULL, "email" character varying NOT NULL, "password" character varying, "is2FAEnabled" boolean NOT NULL DEFAULT false, "isEmailConfirmed" boolean NOT NULL DEFAULT false, "twoFactorAuthSecret" character varying, "phone_number" character varying, "address" character varying, "date_of_birth" TIMESTAMP NOT NULL, "profile_picture" character varying, "total_flight_hours" integer, "user_account_balance" numeric(10,2) NOT NULL DEFAULT '0', "email_notifications_enabled" boolean NOT NULL DEFAULT true, "sms_notifications_enabled" boolean NOT NULL DEFAULT false, "newsletter_subscribed" boolean NOT NULL DEFAULT true, "validation_token" character varying, "language" character varying, "speed_unit" character varying, "distance_unit" character varying, "timezone" character varying, "preferred_aerodrome" character varying, "dashboard_widgets" jsonb, "roleId" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reservation_templates_flight_category_enum" AS ENUM('local', 'cross_country', 'instruction', 'tourism', 'training', 'maintenance', 'private', 'corporate')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reservation_templates" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "day_of_week" integer, "preferred_start_time" character varying, "preferred_end_time" character varying, "flight_category" "public"."reservation_templates_flight_category_enum" NOT NULL DEFAULT 'local', "purpose" character varying, "notes" character varying, "estimated_flight_hours" double precision, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer, "aircraftId" integer, CONSTRAINT "PK_32de9894cc82925166f62541df2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" SERIAL NOT NULL, "notification_type" character varying NOT NULL, "message" character varying NOT NULL, "notification_date" TIMESTAMP NOT NULL, "expiration_date" TIMESTAMP, "is_read" boolean NOT NULL DEFAULT false, "action_url" character varying, "priority" character varying, "userId" integer, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_comments" ("id" SERIAL NOT NULL, "content" text NOT NULL, "creationDate" TIMESTAMP NOT NULL, "authorId" integer, "courseId" integer, CONSTRAINT "PK_12badc103abef80c36ea9658a5f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "course_competencies" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "description" text, "validated" boolean NOT NULL DEFAULT false, "courseId" integer, CONSTRAINT "PK_3d7baf5c77b3771fe091992056e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."instruction_courses_status_enum" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "instruction_courses" ("id" SERIAL NOT NULL, "startTime" TIMESTAMP NOT NULL, "endTime" TIMESTAMP, "status" "public"."instruction_courses_status_enum" NOT NULL DEFAULT 'SCHEDULED', "feedback" text, "rating" integer, "instructorId" integer, "studentId" integer, CONSTRAINT "PK_43ada9f30cb678178fdf0b3b5b2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "expenses" ("id" SERIAL NOT NULL, "expense_date" TIMESTAMP NOT NULL, "amount" numeric(12,2) NOT NULL, "category" character varying NOT NULL, "sub_category" character varying, "description" text, "aircraftId" integer, CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "financial_reports" ("id" SERIAL NOT NULL, "report_date" TIMESTAMP NOT NULL, "total_revenue" numeric(12,2) NOT NULL DEFAULT '0', "total_expense" numeric(12,2) NOT NULL DEFAULT '0', "net_profit" numeric(12,2) NOT NULL DEFAULT '0', "recommendations" text, "average_revenue_per_member" numeric(12,2), CONSTRAINT "PK_4dd23f1aa1f11c233bad2937702" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."checklist_items_category_enum" AS ENUM('exterior', 'cockpit', 'engine', 'emergency', 'documents')`,
    );
    await queryRunner.query(
      `CREATE TABLE "checklist_items" ("id" SERIAL NOT NULL, "category" "public"."checklist_items_category_enum" NOT NULL, "item_name" character varying NOT NULL, "description" character varying, "is_required" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "templateId" integer, CONSTRAINT "PK_bae00945a1d4789bd648e583e29" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "checklist_templates" ("id" SERIAL NOT NULL, "aircraft_model" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "createdById" integer, CONSTRAINT "PK_e6d17651d110bbac45cf07e44fa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."checklist_submissions_status_enum" AS ENUM('in_progress', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "checklist_submissions" ("id" SERIAL NOT NULL, "status" "public"."checklist_submissions_status_enum" NOT NULL DEFAULT 'in_progress', "responses" jsonb DEFAULT '[]', "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(), "completed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "templateId" integer, "pilotId" integer, "reservationId" integer, CONSTRAINT "PK_4754fd398dd9b917f63b63bb389" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_templates_recommended_frequency_enum" AS ENUM('QUOTIDIEN', 'HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'SEMESTRIEL', 'ANNUEL', 'BIANNUEL', 'HEURES_DE_VOL', 'APRES_INCIDENT', 'AUTRE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_templates" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL, "recommended_frequency" "public"."audit_templates_recommended_frequency_enum" NOT NULL DEFAULT 'ANNUEL', "applicable_aircraft_types" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "version" integer NOT NULL DEFAULT '1', "createdById" integer, CONSTRAINT "PK_1959aea570e4221537208882c42" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_template_items_category_enum" AS ENUM('CELLULE', 'MOTEUR', 'AVIONIQUE', 'TRAIN_ATTERRISSAGE', 'SYSTEME_CARBURANT', 'SYSTEME_ELECTRIQUE', 'DOCUMENTATION', 'EQUIPEMENT_SECURITE', 'AUTRE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_template_items_criticality_enum" AS ENUM('CRITIQUE', 'MAJEUR', 'MINEUR', 'INFO')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_template_items" ("id" SERIAL NOT NULL, "order_index" integer NOT NULL, "category" "public"."audit_template_items_category_enum" NOT NULL, "title" character varying NOT NULL, "description" text NOT NULL, "inspection_method" text, "expected_result" text, "criticality" "public"."audit_template_items_criticality_enum" NOT NULL DEFAULT 'MINEUR', "reference_documentation" text, "requires_photo_evidence" boolean NOT NULL DEFAULT false, "is_mandatory" boolean NOT NULL DEFAULT true, "templateId" integer, CONSTRAINT "PK_a86859b0c7a690ce82551d94886" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "article" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" character varying NOT NULL, "text" text NOT NULL, "tags" text NOT NULL, "photo_url" character varying, "documents_url" text, "eventDate" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_40808690eb7b915046558c0f81b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."admin_fuelmanagement_enum" AS ENUM('self-service', 'staff-only', 'external')`,
    );
    await queryRunner.query(
      `CREATE TABLE "admin" ("id" SERIAL NOT NULL, "clubName" character varying(255) NOT NULL, "contactEmail" character varying(255) NOT NULL, "contactPhone" character varying(15) NOT NULL, "address" text NOT NULL, "closureDays" text array NOT NULL, "timeSlotDuration" integer NOT NULL, "reservationStartTime" TIME NOT NULL, "reservationEndTime" TIME NOT NULL, "maintenanceDay" character varying(255) NOT NULL, "maintenanceDuration" integer NOT NULL, "pilotLicenses" text array NOT NULL, "membershipFee" double precision NOT NULL, "flightHourRate" double precision NOT NULL, "clubRules" text, "allowGuestPilots" boolean NOT NULL, "guestPilotFee" double precision, "fuelManagement" "public"."admin_fuelmanagement_enum" NOT NULL, "isMaintenanceActive" boolean NOT NULL DEFAULT false, "maintenanceMessage" text, "maintenanceTime" TIMESTAMP, "taxonomies" jsonb, "fuelPrice" double precision, CONSTRAINT "PK_e032310bcef831fb83101899b10" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "audits_audit_items_audit_items" ("auditsId" integer NOT NULL, "auditItemsId" integer NOT NULL, CONSTRAINT "PK_890cb90e7f436bcd9fbb2019417" PRIMARY KEY ("auditsId", "auditItemsId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dd2c93108dc2106607dcbb7ee9" ON "audits_audit_items_audit_items" ("auditsId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_952e38e8a69a2131fa1da2eb1c" ON "audits_audit_items_audit_items" ("auditItemsId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance" ADD CONSTRAINT "FK_0b8b0b1075f6d5b059917a28459" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance" ADD CONSTRAINT "FK_1e16264d8c6b72bfb8f88c0df81" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits" ADD CONSTRAINT "FK_5187e49aaac5fdcaf650929ea5b" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits" ADD CONSTRAINT "FK_ca81c47e005063880099d65a9ca" FOREIGN KEY ("auditorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits" ADD CONSTRAINT "FK_71f4581be72ffceae6d14af67db" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_c5b91d7fd57430f8f02a43ff669" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_55b8db6afe537efa12e882ae413" FOREIGN KEY ("flightId") REFERENCES "flights"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_bbf0491d4505ead46d8c27a0b28" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" ADD CONSTRAINT "FK_e6fdead940af609856f11c5a7c0" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" ADD CONSTRAINT "FK_a908e2401ba3fac43ba1f26e49f" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" ADD CONSTRAINT "FK_8abb961f6f8d88bae3a31a2898a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_97c64b8317a3686e88cf8d52e3a" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_aa0e1cc2c4f54da32bf8282154c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "licenses" ADD CONSTRAINT "FK_77982aa27a5dad35d47ce3f9ac8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_d35cb3c13a18e1ea1705b2817b1" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_43d19956aeab008b49e0804c145" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_fcbe490dc37a1abf68f19c5ccb9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" ADD CONSTRAINT "FK_16e7969589c0b789d9868782259" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "modules" ADD CONSTRAINT "FK_0a00005552998b16b7e89340843" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_progress" ADD CONSTRAINT "FK_b5d0e1b57bc6c761fb49e79bf89" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_progress" ADD CONSTRAINT "FK_b68ae6c7bbd71b00257277c42f8" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_progress" ADD CONSTRAINT "FK_270438181f5a7d06817718d890d" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluations" ADD CONSTRAINT "FK_d5b878ef3b251dfda8ce4438085" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" ADD CONSTRAINT "FK_79eedc8544550a8022fc7befbba" FOREIGN KEY ("evaluation_id") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "FK_1bd66b7e0599333e61d2e3e1678" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" ADD CONSTRAINT "FK_c38697a57844f52584abdb878d7" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_368e146b785b574f42ae9e53d5e" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation_templates" ADD CONSTRAINT "FK_0b092d73c0905ec1fa43efd6199" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation_templates" ADD CONSTRAINT "FK_e0d8087102e10f25195bfbe23d4" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_comments" ADD CONSTRAINT "FK_d29f071dbf5f507cf74e1692e4f" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_comments" ADD CONSTRAINT "FK_fd096f539bcd861ce8521729882" FOREIGN KEY ("courseId") REFERENCES "instruction_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_competencies" ADD CONSTRAINT "FK_586636b77bee6d829a9717b3ce1" FOREIGN KEY ("courseId") REFERENCES "instruction_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instruction_courses" ADD CONSTRAINT "FK_bb6dc5ac70dd2be5edf7db6187d" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "instruction_courses" ADD CONSTRAINT "FK_c4f5022ac1b68a65d795d56f315" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" ADD CONSTRAINT "FK_eea6a4dfa0c6a97f39dce2e9086" FOREIGN KEY ("aircraftId") REFERENCES "aircraft"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_items" ADD CONSTRAINT "FK_71dc6b93115f58afc6ba2f14207" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_templates" ADD CONSTRAINT "FK_140e90139a6ce8dabb4293e3779" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_submissions" ADD CONSTRAINT "FK_c1a9d32f6dcaf6c3b75fd32fb4c" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_submissions" ADD CONSTRAINT "FK_509139965dd91fbf1b0cb6ba7b0" FOREIGN KEY ("pilotId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_submissions" ADD CONSTRAINT "FK_be00c14f5e2bf633493f6290ff7" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_templates" ADD CONSTRAINT "FK_e272d0bc9f82356b3de9b32471e" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_template_items" ADD CONSTRAINT "FK_a2cb6dcc42bd8db1cbcb600bc36" FOREIGN KEY ("templateId") REFERENCES "audit_templates"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits_audit_items_audit_items" ADD CONSTRAINT "FK_dd2c93108dc2106607dcbb7ee9e" FOREIGN KEY ("auditsId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits_audit_items_audit_items" ADD CONSTRAINT "FK_952e38e8a69a2131fa1da2eb1c4" FOREIGN KEY ("auditItemsId") REFERENCES "audit_items"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audits_audit_items_audit_items" DROP CONSTRAINT "FK_952e38e8a69a2131fa1da2eb1c4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits_audit_items_audit_items" DROP CONSTRAINT "FK_dd2c93108dc2106607dcbb7ee9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_template_items" DROP CONSTRAINT "FK_a2cb6dcc42bd8db1cbcb600bc36"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_templates" DROP CONSTRAINT "FK_e272d0bc9f82356b3de9b32471e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_submissions" DROP CONSTRAINT "FK_be00c14f5e2bf633493f6290ff7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_submissions" DROP CONSTRAINT "FK_509139965dd91fbf1b0cb6ba7b0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_submissions" DROP CONSTRAINT "FK_c1a9d32f6dcaf6c3b75fd32fb4c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_templates" DROP CONSTRAINT "FK_140e90139a6ce8dabb4293e3779"`,
    );
    await queryRunner.query(
      `ALTER TABLE "checklist_items" DROP CONSTRAINT "FK_71dc6b93115f58afc6ba2f14207"`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT "FK_eea6a4dfa0c6a97f39dce2e9086"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instruction_courses" DROP CONSTRAINT "FK_c4f5022ac1b68a65d795d56f315"`,
    );
    await queryRunner.query(
      `ALTER TABLE "instruction_courses" DROP CONSTRAINT "FK_bb6dc5ac70dd2be5edf7db6187d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_competencies" DROP CONSTRAINT "FK_586636b77bee6d829a9717b3ce1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_comments" DROP CONSTRAINT "FK_fd096f539bcd861ce8521729882"`,
    );
    await queryRunner.query(
      `ALTER TABLE "course_comments" DROP CONSTRAINT "FK_d29f071dbf5f507cf74e1692e4f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation_templates" DROP CONSTRAINT "FK_e0d8087102e10f25195bfbe23d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservation_templates" DROP CONSTRAINT "FK_0b092d73c0905ec1fa43efd6199"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_368e146b785b574f42ae9e53d5e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "FK_c38697a57844f52584abdb878d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "answers" DROP CONSTRAINT "FK_1bd66b7e0599333e61d2e3e1678"`,
    );
    await queryRunner.query(
      `ALTER TABLE "questions" DROP CONSTRAINT "FK_79eedc8544550a8022fc7befbba"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluations" DROP CONSTRAINT "FK_d5b878ef3b251dfda8ce4438085"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_progress" DROP CONSTRAINT "FK_270438181f5a7d06817718d890d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_progress" DROP CONSTRAINT "FK_b68ae6c7bbd71b00257277c42f8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_progress" DROP CONSTRAINT "FK_b5d0e1b57bc6c761fb49e79bf89"`,
    );
    await queryRunner.query(
      `ALTER TABLE "modules" DROP CONSTRAINT "FK_0a00005552998b16b7e89340843"`,
    );
    await queryRunner.query(
      `ALTER TABLE "lessons" DROP CONSTRAINT "FK_16e7969589c0b789d9868782259"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_fcbe490dc37a1abf68f19c5ccb9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_43d19956aeab008b49e0804c145"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_d35cb3c13a18e1ea1705b2817b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licenses" DROP CONSTRAINT "FK_77982aa27a5dad35d47ce3f9ac8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_aa0e1cc2c4f54da32bf8282154c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reservations" DROP CONSTRAINT "FK_97c64b8317a3686e88cf8d52e3a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" DROP CONSTRAINT "FK_8abb961f6f8d88bae3a31a2898a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" DROP CONSTRAINT "FK_a908e2401ba3fac43ba1f26e49f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "flights" DROP CONSTRAINT "FK_e6fdead940af609856f11c5a7c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_bbf0491d4505ead46d8c27a0b28"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_55b8db6afe537efa12e882ae413"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_c5b91d7fd57430f8f02a43ff669"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits" DROP CONSTRAINT "FK_71f4581be72ffceae6d14af67db"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits" DROP CONSTRAINT "FK_ca81c47e005063880099d65a9ca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "audits" DROP CONSTRAINT "FK_5187e49aaac5fdcaf650929ea5b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance" DROP CONSTRAINT "FK_1e16264d8c6b72bfb8f88c0df81"`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance" DROP CONSTRAINT "FK_0b8b0b1075f6d5b059917a28459"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_952e38e8a69a2131fa1da2eb1c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dd2c93108dc2106607dcbb7ee9"`,
    );
    await queryRunner.query(`DROP TABLE "audits_audit_items_audit_items"`);
    await queryRunner.query(`DROP TABLE "admin"`);
    await queryRunner.query(`DROP TYPE "public"."admin_fuelmanagement_enum"`);
    await queryRunner.query(`DROP TABLE "article"`);
    await queryRunner.query(`DROP TABLE "audit_template_items"`);
    await queryRunner.query(
      `DROP TYPE "public"."audit_template_items_criticality_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."audit_template_items_category_enum"`,
    );
    await queryRunner.query(`DROP TABLE "audit_templates"`);
    await queryRunner.query(
      `DROP TYPE "public"."audit_templates_recommended_frequency_enum"`,
    );
    await queryRunner.query(`DROP TABLE "checklist_submissions"`);
    await queryRunner.query(
      `DROP TYPE "public"."checklist_submissions_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "checklist_templates"`);
    await queryRunner.query(`DROP TABLE "checklist_items"`);
    await queryRunner.query(
      `DROP TYPE "public"."checklist_items_category_enum"`,
    );
    await queryRunner.query(`DROP TABLE "financial_reports"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
    await queryRunner.query(`DROP TABLE "instruction_courses"`);
    await queryRunner.query(
      `DROP TYPE "public"."instruction_courses_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "course_competencies"`);
    await queryRunner.query(`DROP TABLE "course_comments"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TABLE "reservation_templates"`);
    await queryRunner.query(
      `DROP TYPE "public"."reservation_templates_flight_category_enum"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "answers"`);
    await queryRunner.query(`DROP TABLE "questions"`);
    await queryRunner.query(`DROP TABLE "evaluations"`);
    await queryRunner.query(`DROP TABLE "user_progress"`);
    await queryRunner.query(`DROP TABLE "modules"`);
    await queryRunner.query(`DROP TABLE "lessons"`);
    await queryRunner.query(`DROP TABLE "courses"`);
    await queryRunner.query(
      `DROP TYPE "public"."courses_required_license_enum"`,
    );
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "licenses"`);
    await queryRunner.query(`DROP TABLE "reservations"`);
    await queryRunner.query(
      `DROP TYPE "public"."reservations_flight_category_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."reservations_status_enum"`);
    await queryRunner.query(`DROP TABLE "flights"`);
    await queryRunner.query(`DROP TABLE "incidents"`);
    await queryRunner.query(`DROP TABLE "aircraft"`);
    await queryRunner.query(
      `DROP TYPE "public"."aircraft_availability_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "audits"`);
    await queryRunner.query(`DROP TYPE "public"."audits_audit_frequency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."audits_audit_result_enum"`);
    await queryRunner.query(`DROP TABLE "audit_items"`);
    await queryRunner.query(`DROP TYPE "public"."audit_items_result_enum"`);
    await queryRunner.query(`DROP TYPE "public"."audit_items_category_enum"`);
    await queryRunner.query(`DROP TABLE "maintenance"`);
    await queryRunner.query(
      `DROP TYPE "public"."maintenance_maintenance_type_enum"`,
    );
  }
}
