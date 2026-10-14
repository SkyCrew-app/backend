import { CronService } from '../cron.service';
import { PlanService } from '../../../common/plan/plan.service';
import { PlanName } from '../../../common/plan/plan';

const cronWith = (plan: PlanName) => {
  const courseService = {
    findExpiredCourses: jest.fn().mockResolvedValue([]),
    updateCourseStatus: jest.fn(),
  };
  const service = new CronService(
    courseService as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    PlanService.of({ plan }),
  );
  return { service, courseService };
};

describe('The nightly course job and the plan', () => {
  it('does not look at courses in the Club plan', async () => {
    const { service, courseService } = cronWith(PlanName.CLUB);

    await service.handleCourseStatusUpdate();

    expect(courseService.findExpiredCourses).not.toHaveBeenCalled();
  });

  it('runs in the Club + École plan', async () => {
    const { service, courseService } = cronWith(PlanName.ECOLE);

    await service.handleCourseStatusUpdate();

    expect(courseService.findExpiredCourses).toHaveBeenCalled();
  });
});
