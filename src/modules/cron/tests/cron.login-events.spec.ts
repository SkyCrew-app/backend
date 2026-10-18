import { CronService } from '../cron.service';
import { PlanService } from '../../../common/plan/plan.service';

// The connection log keeps six months: the nightly job removes the rest.
describe('CronService and the connection log', () => {
  const serviceWith = (loginEvents?: { purgeExpired: jest.Mock }) =>
    new CronService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      new PlanService(),
      loginEvents as any,
    );

  it('purges the expired lines every night', async () => {
    const purgeExpired = jest.fn().mockResolvedValue(12);
    await expect(
      serviceWith({ purgeExpired }).purgeExpiredLoginEvents(),
    ).resolves.toBe(12);
    expect(purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('runs at night, on the club clock', () => {
    const metadata = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      CronService.prototype.purgeExpiredLoginEvents,
    );
    expect(metadata).toMatchObject({
      cronTime: '15 3 * * *',
      timeZone: 'Europe/Paris',
    });
  });

  it('does not fail the job when the purge fails', async () => {
    const purgeExpired = jest.fn().mockRejectedValue(new Error('down'));
    await expect(
      serviceWith({ purgeExpired }).purgeExpiredLoginEvents(),
    ).resolves.toBe(0);
    await expect(serviceWith().purgeExpiredLoginEvents()).resolves.toBe(0);
  });
});
