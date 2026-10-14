import { GraphQLFormattedError } from 'graphql';

// The GraphQL driver names only 400, 401, 403 and 422 refusals; every other
// HTTP refusal would come out as INTERNAL_SERVER_ERROR. These get their own
// code, so that a client can tell "does not exist" from a server failure.
const CODES_BY_STATUS: Record<number, string> = {
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

const statusOf = (error: GraphQLFormattedError): number | undefined => {
  const extensions = error.extensions as
    | { status?: unknown; originalError?: { statusCode?: unknown } }
    | undefined;
  const status = extensions?.status ?? extensions?.originalError?.statusCode;
  return typeof status === 'number' ? status : undefined;
};

export const withHttpErrorCode = (
  error: GraphQLFormattedError,
): GraphQLFormattedError => {
  const status = statusOf(error);
  const code = status !== undefined ? CODES_BY_STATUS[status] : undefined;
  if (!code || error.extensions?.code !== 'INTERNAL_SERVER_ERROR') {
    return error;
  }
  return { ...error, extensions: { ...error.extensions, code } };
};
