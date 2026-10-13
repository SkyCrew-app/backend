// Business choices about instruction courses. Change them here.

// How long a course lasts when it is planned without an end time.
export const DEFAULT_COURSE_MINUTES = 60;

export const defaultCourseEnd = (startTime: Date | string): Date =>
  new Date(new Date(startTime).getTime() + DEFAULT_COURSE_MINUTES * 60 * 1000);

// The end of a course, including the older ones stored without one.
export const courseEnd = (course: {
  startTime: Date | string;
  endTime?: Date | string | null;
}): Date =>
  course.endTime
    ? new Date(course.endTime)
    : defaultCourseEnd(course.startTime);
