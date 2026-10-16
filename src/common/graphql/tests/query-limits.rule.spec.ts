import { buildSchema, parse, specifiedRules, validate } from 'graphql';
import { queryLimitsRule, QueryLimits } from '../query-limits.rule';

const schema = buildSchema(`
  type User {
    id: ID!
    name: String
    friends: [User!]!
  }

  type Query {
    me: User
    user(id: ID!): User
  }

  type Mutation {
    rename(name: String!): User
  }
`);

const errorsOf = (query: string, limits: Partial<QueryLimits> = {}) =>
  validate(schema, parse(query), [
    ...specifiedRules,
    queryLimitsRule(limits),
  ]).map((error) => error.message);

const nested = (levels: number): string =>
  levels === 1 ? '{ id }' : `{ friends ${nested(levels - 1)} }`;

describe('queryLimitsRule', () => {
  it('accepts an ordinary query', () => {
    expect(errorsOf('{ me { id name friends { id name } } }')).toEqual([]);
  });

  it('accepts a query exactly at the depth limit', () => {
    // me + 9 levels below = 10
    expect(errorsOf(`{ me ${nested(9)} }`)).toEqual([]);
  });

  it('refuses a query one level over the depth limit', () => {
    expect(errorsOf(`{ me ${nested(10)} }`)).toEqual([
      'Requête trop profonde (10 niveaux au plus)',
    ]);
  });

  it('refuses a deep mutation too', () => {
    expect(errorsOf(`mutation { rename(name: "a") ${nested(10)} }`)).toEqual([
      'Requête trop profonde (10 niveaux au plus)',
    ]);
  });

  it('counts the depth through fragments', () => {
    const query = `
      query { me { ...Level } }
      fragment Level on User { friends { friends { ...Leaf } } }
      fragment Leaf on User { friends { id } }
    `;

    expect(errorsOf(query, { maxDepth: 5 })).toEqual([]);
    expect(errorsOf(query, { maxDepth: 4 })).toEqual([
      'Requête trop profonde (4 niveaux au plus)',
    ]);
  });

  it('does not count an inline fragment as a level', () => {
    expect(
      errorsOf('{ me { ... on User { friends { id } } } }', { maxDepth: 3 }),
    ).toEqual([]);
  });

  it('refuses too many aliases', () => {
    const aliases = Array.from(
      { length: 21 },
      (_, index) => `u${index}: user(id: "${index}") { id }`,
    ).join(' ');

    expect(errorsOf(`{ ${aliases} }`)).toEqual(["Trop d'alias (20 au plus)"]);
  });

  it('refuses too many fields, fragments expanded', () => {
    const query = `
      query { a: me { ...Many } b: me { ...Many } }
      fragment Many on User { id name friends { id name } }
    `;

    expect(errorsOf(query, { maxFields: 12 })).toEqual([]);
    expect(errorsOf(query, { maxFields: 11 })).toEqual([
      'Requête trop volumineuse (11 champs au plus)',
    ]);
  });

  it('stops early on fragments that multiply each other', () => {
    // 2^30 fields once expanded: must be refused without expanding them.
    const fragments = Array.from(
      { length: 30 },
      (_, index) =>
        `fragment F${index} on User { a: friends { ...F${index + 1} } b: friends { ...F${index + 1} } }`,
    ).join('\n');
    const query = `query { me { ...F0 } }\n${fragments}\nfragment F30 on User { id }`;

    const started = Date.now();
    const errors = errorsOf(query, { maxDepth: 100, maxAliases: 1000 });

    expect(errors).toEqual(['Requête trop volumineuse (400 champs au plus)']);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('does not loop on a fragment that includes itself', () => {
    const errors = errorsOf(`
      query { me { ...Loop } }
      fragment Loop on User { friends { ...Loop } }
    `);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Cannot spread fragment "Loop" within itself');
  });

  it('checks each operation of a document', () => {
    expect(
      errorsOf(`query Small { me { id } } query Deep { me ${nested(10)} }`),
    ).toEqual(['Requête trop profonde (10 niveaux au plus)']);
  });

  it('lets the schema explorer through only when asked', () => {
    const introspection =
      '{ __schema { types { fields { type { ofType { ofType { ofType { name } } } } } } } }';

    expect(errorsOf(introspection, { maxDepth: 5 })).toEqual([
      'Requête trop profonde (5 niveaux au plus)',
    ]);
    expect(
      errorsOf(introspection, { maxDepth: 5, ignoreIntrospection: true }),
    ).toEqual([]);
  });
});
