import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { AdminAction } from './admin-action.entity';
import {
  ADMIN_ACTIONS_MAX_PAGE_SIZE,
  ADMIN_ACTIONS_PAGE_SIZE,
  AdminActionName,
  AdminTargetType,
  sanitizeSummary,
} from './admin-actions';

export interface AdminActor {
  id?: number | string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export interface AdminActionTarget {
  type: AdminTargetType;
  id?: number | string | null;
  label?: string | null;
}

export interface AdminActionsFilter {
  // Lines made by this administrator, or about this member.
  memberId?: number | null;
  action?: string | null;
  page?: number | null;
  pageSize?: number | null;
}

export interface AdminActionsPage {
  items: AdminAction[];
  total: number;
  page: number;
  pageSize: number;
}

const actorLabel = (actor: AdminActor | null | undefined): string | null => {
  const name = [actor?.first_name, actor?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || actor?.email || null;
};

@Injectable()
export class AdminActionsService {
  private readonly logger = new Logger(AdminActionsService.name);

  // The data source is looked up when a line is written, not injected: the
  // service then has no dependency of its own, and any module can import
  // AdminActionsModule (or rely on it being global) without further wiring.
  constructor(private readonly moduleRef: ModuleRef) {}

  private get actions(): Repository<AdminAction> {
    return this.moduleRef
      .get(DataSource, { strict: false })
      .getRepository(AdminAction);
  }

  // Adds a line to the trace. Called once the action itself succeeded, and
  // never throws: a trace that cannot be written is logged for the operator
  // and does not undo what the administrator did.
  async record(
    actor: AdminActor | null | undefined,
    action: AdminActionName,
    target: AdminActionTarget,
    summary?: Record<string, unknown> | null,
  ): Promise<void> {
    try {
      await this.actions.insert({
        actor_id: actor?.id != null ? Number(actor.id) : null,
        actor_label: actorLabel(actor),
        action,
        target_type: target.type,
        target_id: target.id != null ? String(target.id) : null,
        target_label: target.label ?? null,
        summary: sanitizeSummary(summary) as never,
      });
    } catch (error) {
      this.logger.error(
        `Administrator action "${action}" on ${target.type} ${target.id ?? ''} by ${actor?.id ?? 'unknown'} could not be traced: ${(error as Error)?.message}`,
      );
    }
  }

  async find(filter: AdminActionsFilter = {}): Promise<AdminActionsPage> {
    const pageSize = Math.min(
      Math.max(
        1,
        Math.trunc(Number(filter.pageSize) || ADMIN_ACTIONS_PAGE_SIZE),
      ),
      ADMIN_ACTIONS_MAX_PAGE_SIZE,
    );
    const page = Math.max(1, Math.trunc(Number(filter.page) || 1));

    const query = this.actions.createQueryBuilder('action');
    if (filter.memberId != null) {
      query.andWhere(
        // About this member: the target itself, or a payment, a booking or
        // a flight of theirs (the summary then names the member).
        `(action.actor_id = :memberId OR (action.target_type = 'member' AND action.target_id = :memberTarget) OR action.summary ->> 'memberId' = :memberTarget)`,
        {
          memberId: Number(filter.memberId),
          memberTarget: String(filter.memberId),
        },
      );
    }
    if (filter.action) {
      query.andWhere('action.action = :name', { name: filter.action });
    }

    const [items, total] = await query
      .orderBy('action.created_at', 'DESC')
      .addOrderBy('action.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }
}
