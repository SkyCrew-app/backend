import { INestApplication } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  Field,
  GraphQLModule,
  Int,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { User } from '../entity/users.entity';

const marie = {
  id: 7,
  first_name: 'Marie',
  last_name: 'Laurent',
  email: 'marie@example.com',
  phone_number: '0600000000',
  profile_picture: '/uploads/users/7/photo.png',
  role: { id: 2, role_name: 'Pilote' },
  address: '1 rue du Hangar',
  date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
  total_flight_hours: 120,
  user_account_balance: 420.5,
  is2FAEnabled: true,
  isEmailConfirmed: true,
  is_active: true,
  email_notifications_enabled: true,
  sms_notifications_enabled: false,
  newsletter_subscribed: true,
  language: 'fr',
  speed_unit: 'kt',
  distance_unit: 'nm',
  timezone: 'Europe/Paris',
  preferred_aerodrome: 'LFPN',
  lastSignInAt: new Date('2026-10-12T08:30:00.000Z'),
  licenses: [],
  invoices: [],
  payments: [],
  flights: [],
  answers: [],
  userProgresses: [],
  reservations: [],
  dashboard_widgets: [],
};

// Any type of another module that points to a member: a booking and its
// pilot, a maintenance and its technician, an incident and its author…
@ObjectType()
class Booking {
  @Field(() => Int)
  id: number;

  @Field(() => User)
  user: Partial<User>;
}

@Resolver()
class ProbeResolver {
  @Query(() => Booking)
  booking(): Booking {
    return { id: 1, user: marie as unknown as Partial<User> };
  }
}

const DIRECTORY = 'id first_name last_name email phone_number profile_picture';
const PROFILE = 'address date_of_birth total_flight_hours licenses { id }';
const PRIVATE = `user_account_balance is2FAEnabled isEmailConfirmed is_active
  email_notifications_enabled sms_notifications_enabled newsletter_subscribed
  language speed_unit distance_unit timezone preferred_aerodrome lastSignInAt
  invoices { id } payments { id } flights { id } answers { id }
  userProgresses { id } dashboard_widgets { widgetId }`;

const fieldsOf = (selection: string) =>
  selection
    .replace(/{[^}]*}/g, '')
    .split(/\s+/)
    .filter(Boolean);

// The goal of the whole policy: whatever the path that leads to a member,
// another member only receives the directory entry.
describe('User type visibility', () => {
  let app: INestApplication;
  let caller: unknown;

  const pilotOfBooking = async (selection: string) => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: `{ booking { id user { ${selection} } } }` });
    expect(response.body.errors).toBeUndefined();
    return response.body.data.booking.user;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          // As in the application: the guard puts the session user on the
          // request, here the test does.
          context: ({ req }) => {
            req.user = caller;
            return { req };
          },
        }),
      ],
      providers: [ProbeResolver],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const otherPilot = { id: 3, role: { role_name: 'Pilote' } };
  const technician = { id: 5, role: { role_name: 'Technicien' } };
  const instructor = { id: 4, role: { role_name: 'Instructeur' } };
  const admin = { id: 1, role: { role_name: 'Administrateur' } };
  const herself = { id: 7, role: { role_name: 'Pilote' } };

  it.each([
    ['another member', otherPilot],
    ['a technician', technician],
    ['nobody (no session)', undefined],
  ])(
    'gives %s the directory entry and null for everything else',
    async (_label, who) => {
      caller = who;

      const user = await pilotOfBooking(
        `${DIRECTORY} role { role_name } ${PROFILE} ${PRIVATE}`,
      );

      expect(user).toMatchObject({
        id: 7,
        first_name: 'Marie',
        last_name: 'Laurent',
        email: 'marie@example.com',
        phone_number: '0600000000',
        profile_picture: '/uploads/users/7/photo.png',
        role: { role_name: 'Pilote' },
      });
      for (const field of [...fieldsOf(PROFILE), ...fieldsOf(PRIVATE)]) {
        expect([field, user[field]]).toEqual([field, null]);
      }
    },
  );

  it.each([
    ['the member themself', herself],
    ['an administrator', admin],
  ])('gives %s everything', async (_label, who) => {
    caller = who;

    const user = await pilotOfBooking(`${PROFILE} ${PRIVATE}`);

    expect(user).toMatchObject({
      address: '1 rue du Hangar',
      date_of_birth: '1990-01-01T00:00:00.000Z',
      total_flight_hours: 120,
      user_account_balance: 420.5,
      is2FAEnabled: true,
      is_active: true,
      language: 'fr',
      licenses: [],
      invoices: [],
      payments: [],
    });
    for (const field of [...fieldsOf(PROFILE), ...fieldsOf(PRIVATE)]) {
      expect([field, user[field] === null]).toEqual([field, false]);
    }
  });

  it('gives an instructor the profile, but neither money nor account settings', async () => {
    caller = instructor;

    const user = await pilotOfBooking(`${PROFILE} ${PRIVATE}`);

    expect(user).toMatchObject({
      address: '1 rue du Hangar',
      date_of_birth: '1990-01-01T00:00:00.000Z',
      total_flight_hours: 120,
      licenses: [],
    });
    for (const field of fieldsOf(PRIVATE)) {
      expect([field, user[field]]).toEqual([field, null]);
    }
  });

  it('never fails a query because a hidden field is asked for', async () => {
    caller = otherPilot;

    // These two were declared non-null: a hidden value used to be an error.
    const user = await pilotOfBooking(
      'first_name date_of_birth user_account_balance',
    );

    expect(user).toEqual({
      first_name: 'Marie',
      date_of_birth: null,
      user_account_balance: null,
    });
  });

  // A field added to the type later is private unless someone decides
  // otherwise here.
  it('has a visibility rule on every field outside the directory entry', async () => {
    const query =
      '{ __type(name: "User") { fields(includeDeprecated: true) { name } } }';
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query });
    const names: string[] = response.body.data.__type.fields.map(
      (field: { name: string }) => field.name,
    );

    const open = [
      ...fieldsOf(DIRECTORY),
      'role',
      // The planning shows everyone's bookings; maintenance records are
      // readable by every member.
      'reservations',
      'maintenances',
    ];
    const ruled = [
      ...fieldsOf(PROFILE),
      ...fieldsOf(PRIVATE),
      // Never returned at all.
      'password',
      'validation_token',
    ];
    expect(names.sort()).toEqual([...open, ...ruled].sort());
  });
});
