import { INestApplication } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule, Query, Resolver } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { Question } from '../entity/question.entity';

@Resolver()
class ProbeResolver {
  @Query(() => [Question])
  probeQuestions(): Partial<Question>[] {
    return [
      {
        id: 1,
        content: { text: 'Quelle est la vitesse de décrochage ?' },
        options: ['45 kt', '60 kt'],
        correct_answer: '45 kt',
        answers: [
          {
            id: 9,
            answer_text: '60 kt',
            is_correct: false,
            submitted_at: new Date('2026-01-01T00:00:00Z'),
          } as any,
        ],
      },
    ];
  }
}

// Questions are returned to students who are about to answer them: the key
// and other users' answers must only reach the staff.
describe('Question exposure', () => {
  let app: INestApplication;

  const queryAs = async (role?: string) => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('x-test-role', role ?? '')
      .send({
        query:
          '{ probeQuestions { id options correct_answer answers { id answer_text } } }',
      });
    return response.body;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
          // Stands in for the session: the role comes from a test header.
          context: ({ req }) => {
            const role = req.headers['x-test-role'];
            req.user = role ? { id: 1, role: { role_name: role } } : undefined;
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

  it.each([['Pilote'], ['Technicien'], [undefined]])(
    'hides the key and the recorded answers from %s',
    async (role) => {
      const body = await queryAs(role);

      expect(body.errors).toBeUndefined();
      expect(body.data.probeQuestions).toEqual([
        {
          id: 1,
          options: ['45 kt', '60 kt'],
          correct_answer: null,
          answers: [],
        },
      ]);
    },
  );

  it.each([['Instructeur'], ['Administrateur']])(
    'shows the key and the recorded answers to %s',
    async (role) => {
      const body = await queryAs(role);

      expect(body.errors).toBeUndefined();
      expect(body.data.probeQuestions[0].correct_answer).toBe('45 kt');
      expect(body.data.probeQuestions[0].answers).toEqual([
        { id: 9, answer_text: '60 kt' },
      ]);
    },
  );
});
