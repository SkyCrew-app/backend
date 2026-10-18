import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource, In, Repository } from 'typeorm';
import { LoginEvent } from './login-event.entity';
import {
  attemptedEmailOf,
  LOGIN_EVENTS_MAX_PAGE_SIZE,
  LOGIN_EVENTS_PAGE_SIZE,
  LOGIN_EVENTS_RETENTION_MONTHS,
  LoginMethod,
  LoginOutcome,
  MY_LOGIN_EVENTS_LIMIT,
} from './login-events';
import { rawUserAgentOf, summarizeUserAgent } from './user-agent';
import { clientIpOf } from '../http/client-ip';
import { User } from '../../modules/users/entity/users.entity';

// What the request tells about the visitor. Only the address worked out by
// Express from the trusted proxies, and the User-Agent header, are read.
export interface LoginRequest {
  ip?: string | null;
  socket?: { remoteAddress?: string | null } | null;
  headers?: Record<string, string | string[] | undefined> | null;
}

export interface LoginAttempt {
  outcome: LoginOutcome;
  method?: LoginMethod | null;
  // The account tried. Undefined: looked up from `email`. Null: none.
  userId?: number | string | null;
  // The address typed. Kept only when it matches no account.
  email?: string | null;
  req?: LoginRequest | null;
}

export interface LoginEventsFilter {
  memberId?: number | null;
  outcome?: LoginOutcome | null;
  // From this moment (included) to this one (excluded).
  from?: Date | null;
  to?: Date | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface LoginEventsPage {
  items: LoginEvent[];
  total: number;
  page: number;
  pageSize: number;
}

// A burst of refused attempts from one address against one account makes a
// single line a minute, not one per request.
const THROTTLED_RECORD_INTERVAL_MS = 60_000;
const THROTTLED_MEMORY_SIZE = 1000;

const nameOf = (user: Partial<User> | undefined): string | null => {
  const name = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || user?.email || null;
};

const validDate = (value: Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

@Injectable()
export class LoginEventsService {
  private readonly logger = new Logger(LoginEventsService.name);
  private readonly throttledSeen = new Map<string, number>();

  // Looked up when needed, like the administrator action log: any module
  // can record a sign-in without further wiring.
  constructor(private readonly moduleRef: ModuleRef) {}

  private get dataSource(): DataSource {
    return this.moduleRef.get(DataSource, { strict: false });
  }

  private get events(): Repository<LoginEvent> {
    return this.dataSource.getRepository(LoginEvent);
  }

  private async userIdOf(email: string | null | undefined) {
    const address = (email ?? '').trim();
    if (!address) return null;
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .select(['user.id'])
      .where('LOWER(user.email) = LOWER(:email)', { email: address })
      .getOne();
    return user?.id ?? null;
  }

  // Adds a line to the log. Never throws and never holds a sign-in back:
  // a line that cannot be written is reported to the operator only.
  async record(attempt: LoginAttempt): Promise<void> {
    try {
      const userId =
        attempt.userId === undefined
          ? await this.userIdOf(attempt.email)
          : attempt.userId == null
            ? null
            : Number(attempt.userId);
      const headers = attempt.req?.headers ?? {};
      const device = summarizeUserAgent(headers['user-agent']);

      await this.events.insert({
        user_id: userId,
        attempted_email:
          userId == null ? attemptedEmailOf(attempt.email) : null,
        outcome: attempt.outcome,
        method: attempt.method ?? null,
        ip_address: clientIpOf(attempt.req),
        browser: device.browser,
        os: device.os,
        device_type: device.device_type,
        user_agent: rawUserAgentOf(headers['user-agent']),
      });

      if (attempt.outcome === LoginOutcome.SUCCESS && userId != null) {
        await this.dataSource
          .getRepository(User)
          .update({ id: userId }, { lastSignInAt: new Date() });
      }
    } catch (error) {
      this.logger.error(
        `A sign-in (${attempt.outcome}) could not be logged: ${(error as Error)?.message}`,
      );
    }
  }

  // An attempt refused by the rate limit, at most once a minute for the
  // same address and account.
  async recordThrottled(attempt: Omit<LoginAttempt, 'outcome'>): Promise<void> {
    const key = `${clientIpOf(attempt.req) ?? '?'}|${(attempt.email ?? '').trim().toLowerCase()}|${attempt.method ?? ''}`;
    const now = Date.now();
    const last = this.throttledSeen.get(key);
    if (last !== undefined && now - last < THROTTLED_RECORD_INTERVAL_MS) {
      return;
    }
    if (this.throttledSeen.size >= THROTTLED_MEMORY_SIZE) {
      this.throttledSeen.clear();
    }
    this.throttledSeen.set(key, now);
    await this.record({
      ...attempt,
      outcome: LoginOutcome.LOCKED_OR_THROTTLED,
    });
  }

  private async withMemberNames(items: LoginEvent[]): Promise<LoginEvent[]> {
    const ids = [
      ...new Set(items.map((item) => item.user_id).filter((id) => id != null)),
    ];
    if (ids.length === 0) return items;
    const users = await this.dataSource.getRepository(User).find({
      where: { id: In(ids) },
      select: ['id', 'first_name', 'last_name', 'email'],
    });
    const byId = new Map(users.map((user) => [Number(user.id), user]));
    return items.map((item) =>
      Object.assign(item, {
        member_name:
          item.user_id != null ? nameOf(byId.get(Number(item.user_id))) : null,
      }),
    );
  }

  async find(filter: LoginEventsFilter = {}): Promise<LoginEventsPage> {
    const pageSize = Math.min(
      Math.max(
        1,
        Math.trunc(Number(filter.pageSize) || LOGIN_EVENTS_PAGE_SIZE),
      ),
      LOGIN_EVENTS_MAX_PAGE_SIZE,
    );
    const page = Math.max(1, Math.trunc(Number(filter.page) || 1));

    const query = this.events.createQueryBuilder('event');
    if (filter.memberId != null) {
      query.andWhere('event.user_id = :memberId', {
        memberId: Number(filter.memberId),
      });
    }
    if (filter.outcome) {
      query.andWhere('event.outcome = :outcome', { outcome: filter.outcome });
    }
    const from = validDate(filter.from);
    if (from) {
      query.andWhere('event.created_at >= :from', { from });
    }
    const to = validDate(filter.to);
    if (to) {
      query.andWhere('event.created_at < :to', { to });
    }

    const [items, total] = await query
      .orderBy('event.created_at', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items: await this.withMemberNames(items), total, page, pageSize };
  }

  // The latest lines about one member's account, for themselves.
  async forMember(userId: number): Promise<LoginEvent[]> {
    return this.events.find({
      where: { user_id: Number(userId) },
      order: { created_at: 'DESC', id: 'DESC' },
      take: MY_LOGIN_EVENTS_LIMIT,
    });
  }

  // Removes the lines older than the retention period, and only those: the
  // database refuses any other deletion. Returns how many went.
  async purgeExpired(): Promise<number> {
    const result = await this.events
      .createQueryBuilder()
      .delete()
      .from(LoginEvent)
      .where('created_at < now() - make_interval(months => :months)', {
        months: LOGIN_EVENTS_RETENTION_MONTHS,
      })
      .execute();
    return result.affected ?? 0;
  }
}
