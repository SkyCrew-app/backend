import { isAdmin, SessionUser } from '../auth/access';

// Who may read a file stored under /uploads, by its first directory. The
// rule is the same whichever address serves the file (/uploads or /files).
//
// - public: profile pictures and article images, shown by their link;
// - member: aircraft and maintenance documents, for anyone signed in;
// - holder: licence documents, for the member they belong to;
// - admin: financial exports, and any directory nobody has classified.
// Administrators read everything.
export type UploadAccess = 'public' | 'member' | 'holder' | 'admin';

const PUBLIC_DIRECTORIES = ['users', 'tmp'];
const MEMBER_DIRECTORIES = ['maintenance'];
const HOLDER_DIRECTORIES = ['licences'];
// Aircraft files live in a directory named after the aircraft id.
const AIRCRAFT_DIRECTORY = /^\d+$/;

export const uploadAccessOf = (directory: string): UploadAccess => {
  if (PUBLIC_DIRECTORIES.includes(directory)) return 'public';
  if (HOLDER_DIRECTORIES.includes(directory)) return 'holder';
  if (MEMBER_DIRECTORIES.includes(directory)) return 'member';
  if (AIRCRAFT_DIRECTORY.test(directory)) return 'member';
  return 'admin';
};

// Ids of the members a private document belongs to, from its address
// (`/uploads/licences/x.pdf`). The application wires it to the database.
export type DocumentHoldersLoader = (documentUrl: string) => Promise<number[]>;

export type UploadDecision = 'allowed' | 'unauthenticated' | 'forbidden';

// `segments` is the path under /uploads, already normalised and split.
export const decideUploadAccess = async (
  segments: string[],
  user: SessionUser | null | undefined,
  holdersOf: DocumentHoldersLoader,
): Promise<UploadDecision> => {
  const access = uploadAccessOf(segments[0] ?? '');

  if (access === 'public') return 'allowed';
  if (!user) return 'unauthenticated';
  if (access === 'member' || isAdmin(user)) return 'allowed';
  if (access === 'admin') return 'forbidden';

  let holders: number[];
  try {
    holders = await holdersOf(`/uploads/${segments.join('/')}`);
  } catch {
    return 'forbidden';
  }
  return holders.map(Number).includes(Number(user.id))
    ? 'allowed'
    : 'forbidden';
};
