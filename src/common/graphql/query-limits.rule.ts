import {
  ASTVisitor,
  FragmentDefinitionNode,
  GraphQLError,
  Kind,
  OperationDefinitionNode,
  SelectionSetNode,
  ValidationContext,
} from 'graphql';

export type QueryLimits = {
  // Levels of nested fields: `{ a { b { c } } }` is 3.
  maxDepth: number;
  // Fields of one operation, fragments expanded.
  maxFields: number;
  maxAliases: number;
  // The schema explorer of the development tools asks for deep queries.
  ignoreIntrospection: boolean;
};

// Measured over frontend/src/graphql: the deepest operation has 7 levels,
// none uses an alias, and the largest is the flight plan result (307
// fields with __typename: legs, alternate leg, airspaces, sun times); the
// frontend's documents test keeps every operation under these limits.
export const DEFAULT_QUERY_LIMITS: QueryLimits = {
  maxDepth: 10,
  maxFields: 400,
  maxAliases: 20,
  ignoreIntrospection: false,
};

class LimitExceeded extends Error {}

// Refuses, before anything is executed, an operation that is too deep or too
// large: relations of the schema loop (user -> reservations -> user…), so
// a short query could otherwise ask for an unbounded amount of work.
export const queryLimitsRule =
  (overrides: Partial<QueryLimits> = {}) =>
  (context: ValidationContext): ASTVisitor => {
    const limits = { ...DEFAULT_QUERY_LIMITS, ...overrides };

    const measure = (operation: OperationDefinitionNode): void => {
      let fields = 0;
      let aliases = 0;

      const refuse = (message: string): never => {
        context.reportError(new GraphQLError(message, { nodes: operation }));
        throw new LimitExceeded();
      };

      const walk = (
        selectionSet: SelectionSetNode | undefined,
        depth: number,
        openFragments: FragmentDefinitionNode[],
      ): void => {
        for (const selection of selectionSet?.selections ?? []) {
          if (selection.kind === Kind.FIELD) {
            fields += 1;
            if (selection.alias) {
              aliases += 1;
            }
            if (depth + 1 > limits.maxDepth) {
              refuse(
                `Requête trop profonde (${limits.maxDepth} niveaux au plus)`,
              );
            }
            if (fields > limits.maxFields) {
              refuse(
                `Requête trop volumineuse (${limits.maxFields} champs au plus)`,
              );
            }
            if (aliases > limits.maxAliases) {
              refuse(`Trop d'alias (${limits.maxAliases} au plus)`);
            }

            const isIntrospection =
              selection.name.value === '__schema' ||
              selection.name.value === '__type';
            if (!(limits.ignoreIntrospection && isIntrospection)) {
              walk(selection.selectionSet, depth + 1, openFragments);
            }
          } else if (selection.kind === Kind.INLINE_FRAGMENT) {
            walk(selection.selectionSet, depth, openFragments);
          } else {
            const fragment = context.getFragment(selection.name.value);
            // A fragment that includes itself is reported by the standard
            // rules; here it only must not loop.
            if (fragment && !openFragments.includes(fragment)) {
              walk(fragment.selectionSet, depth, [...openFragments, fragment]);
            }
          }
        }
      };

      try {
        walk(operation.selectionSet, 0, []);
      } catch (error) {
        if (!(error instanceof LimitExceeded)) {
          throw error;
        }
      }
    };

    return {
      OperationDefinition(node) {
        measure(node);
      },
    };
  };
