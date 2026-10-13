import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
  In,
} from 'typeorm';
import { InstructionCourse } from './entity/instruction-courses.entity';
import { CourseStatus } from './enum/course-status.enum';
import { CourseCompetency } from './entity/course-competency.entity';
import { CourseComment } from './entity/course-comment.entity';
import { CreateCourseInstructionInput } from './dto/create-course.input';
import { UpdateCourseInstructionInput } from './dto/update-course.input';
import { AddCompetencyInput } from './dto/add-competency.input';
import { AddCommentInput } from './dto/add-comment.input';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ELearningService } from '../e-learning/e-learning.service';
import { UserProgress } from '../users/entity/user-progress.entity';
import { Lesson } from '../e-learning/entity/lesson.entity';
import { User } from '../users/entity/users.entity';
import { languageOf } from '../../common/i18n/languages';
import { translate } from '../../common/i18n/translate';
import { localized } from '../../common/i18n/localized-exception';
import {
  hasRole,
  isAdmin,
  ROLE_ADMIN,
  ROLE_INSTRUCTOR,
  SessionUser,
} from '../../common/auth/access';

// Bounds of the rating a student gives a course.
export const COURSE_RATING_MIN = 1;
export const COURSE_RATING_MAX = 5;

const differs = (value: unknown, current: unknown): boolean =>
  value != null && Number(value) !== Number(current);

@Injectable()
export class InstructionCoursesService {
  constructor(
    @InjectRepository(InstructionCourse)
    private readonly courseRepository: Repository<InstructionCourse>,
    @InjectRepository(CourseCompetency)
    private readonly competencyRepository: Repository<CourseCompetency>,
    @InjectRepository(CourseComment)
    private readonly commentRepository: Repository<CourseComment>,
    @InjectRepository(UserProgress)
    private readonly userProgressRepository: Repository<UserProgress>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    private readonly userService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly eLearningService: ELearningService,
  ) {}

  // Two courses conflict when they share time for the same instructor or the
  // same student. Courses that follow each other do not, cancelled ones never
  // do. A course without an end only takes its starting time.
  async checkScheduleConflict(
    instructorId: number,
    studentId: number,
    startTime: Date,
    endTime?: Date | null,
    exceptCourseId?: number,
  ): Promise<boolean> {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : start;
    const overlapping = {
      startTime: LessThan(end.getTime() > start.getTime() ? end : start),
      endTime: MoreThan(start),
      status: Not(CourseStatus.CANCELED),
      ...(exceptCourseId != null && { id: Not(exceptCourseId) }),
    };

    const conflict = await this.courseRepository.findOne({
      where: [
        { ...overlapping, instructor: { id: instructorId } },
        { ...overlapping, student: { id: studentId } },
      ],
    });

    return !!conflict;
  }

  private assertCoherent(
    instructorId: number,
    studentId: number,
    startTime: Date,
    endTime?: Date | null,
  ): void {
    if (Number(instructorId) === Number(studentId)) {
      throw localized(
        BadRequestException,
        'error.course.sameInstructorAndStudent',
      );
    }
    if (
      endTime &&
      new Date(endTime).getTime() <= new Date(startTime).getTime()
    ) {
      throw localized(BadRequestException, 'error.course.endBeforeStart');
    }
  }

  // A course is not planned with a deactivated account, on either side.
  private assertActive(...participants: (User | null | undefined)[]): void {
    if (participants.some((participant) => participant?.is_active === false)) {
      throw localized(BadRequestException, 'error.course.memberInactive');
    }
  }

  // Créer un cours
  async createCourse(
    input: CreateCourseInstructionInput,
  ): Promise<InstructionCourse> {
    const { instructorId, studentId, startTime, endTime } = input;

    this.assertCoherent(instructorId, studentId, startTime, endTime);

    // vérifier si les utilisateurs existent
    const instructor = await this.userService.findOneById(instructorId);
    const student = await this.userService.findOneById(studentId);

    if (!instructor || !student) {
      throw new NotFoundException('Instructor or student not found');
    }
    this.assertActive(instructor, student);

    // A course is given by an instructor (or an administrator).
    if (!hasRole(instructor, ROLE_INSTRUCTOR, ROLE_ADMIN)) {
      throw localized(BadRequestException, 'error.course.notAnInstructor');
    }

    const hasConflict = await this.checkScheduleConflict(
      instructorId,
      studentId,
      startTime,
      endTime,
    );

    if (hasConflict) {
      throw localized(ConflictException, 'error.course.scheduleConflict');
    }

    // The rating and its comment are the student's, given afterwards.
    const course = this.courseRepository.create({
      startTime,
      endTime,
      instructor,
      student,
    });

    await this.notificationsService.create({
      user_id: studentId,
      notification_type: 'COURSE_CREATED',
      notification_date: new Date(),
      message: translate(
        languageOf(student),
        'notification.courseCreatedForStudent',
        { instructorId },
      ),
      is_read: false,
    });

    await this.notificationsService.create({
      user_id: instructorId,
      notification_type: 'COURSE_CREATED',
      notification_date: new Date(),
      message: translate(
        languageOf(instructor),
        'notification.courseCreatedForInstructor',
        { studentId },
      ),
      is_read: false,
    });

    return this.courseRepository.save(course);
  }

  // Récupérer tous les cours
  async findAll(): Promise<InstructionCourse[]> {
    return this.courseRepository.find({
      relations: ['instructor', 'student', 'competencies', 'comments'],
    });
  }

  // Récupérer les cours d'un étudiant
  async findCoursesByStudent(studentId: number): Promise<InstructionCourse[]> {
    return this.courseRepository.find({
      where: { student: { id: studentId } },
      relations: ['instructor', 'student', 'competencies', 'comments'],
    });
  }

  // Récupérer les cours d'un instructeur
  async findCoursesByInstructor(
    instructorId: number,
  ): Promise<InstructionCourse[]> {
    return this.courseRepository.find({
      where: { instructor: { id: instructorId } },
      relations: ['instructor', 'student', 'competencies', 'comments'],
    });
  }

  // Récupérer un cours par ID
  async findOne(id: number): Promise<InstructionCourse> {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: [
        'instructor',
        'student',
        'competencies',
        'comments',
        'comments.author',
      ],
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }
    return course;
  }

  // Mettre à jour un cours. The instructor of a course changes its times and
  // its status; who gives it and who takes it is the administrator's choice,
  // and the rating stays the student's.
  async updateCourse(
    id: number,
    input: UpdateCourseInstructionInput,
    requester?: SessionUser | null,
  ): Promise<InstructionCourse> {
    const course = await this.findOne(id);

    // The id comes from the argument; who gives and takes the course, and
    // its rating, are handled apart.
    const { instructorId, studentId, rating, feedback, ...fields } = input;
    delete (fields as { id?: number }).id;

    if (
      (rating != null && rating !== course.rating) ||
      (feedback != null && feedback !== course.feedback)
    ) {
      throw localized(ForbiddenException, 'error.course.ratingIsStudents');
    }

    const movesInstructor = differs(instructorId, course.instructor?.id);
    const movesStudent = differs(studentId, course.student?.id);
    if ((movesInstructor || movesStudent) && !isAdmin(requester)) {
      throw localized(ForbiddenException, 'error.course.participantsAdminOnly');
    }

    const nextInstructorId = movesInstructor
      ? instructorId
      : course.instructor?.id;
    const nextStudentId = movesStudent ? studentId : course.student?.id;
    const nextStart = fields.startTime ?? course.startTime;
    const nextEnd =
      fields.endTime !== undefined ? fields.endTime : course.endTime;
    const nextStatus = fields.status ?? course.status;

    this.assertCoherent(nextInstructorId, nextStudentId, nextStart, nextEnd);

    if (movesInstructor) {
      const instructor = await this.userService.findOneById(instructorId);
      if (!instructor) {
        throw new NotFoundException('Instructor or student not found');
      }
      this.assertActive(instructor);
      if (!hasRole(instructor, ROLE_INSTRUCTOR, ROLE_ADMIN)) {
        throw localized(BadRequestException, 'error.course.notAnInstructor');
      }
    }

    if (movesStudent) {
      this.assertActive(await this.userService.findOneById(studentId));
    }

    const slotChanged =
      movesInstructor ||
      movesStudent ||
      new Date(nextStart).getTime() !== new Date(course.startTime).getTime() ||
      (nextEnd ? new Date(nextEnd).getTime() : null) !==
        (course.endTime ? new Date(course.endTime).getTime() : null) ||
      (course.status === CourseStatus.CANCELED &&
        nextStatus !== CourseStatus.CANCELED);

    if (
      slotChanged &&
      nextStatus !== CourseStatus.CANCELED &&
      (await this.checkScheduleConflict(
        nextInstructorId,
        nextStudentId,
        nextStart,
        nextEnd,
        id,
      ))
    ) {
      throw localized(ConflictException, 'error.course.scheduleConflict');
    }

    Object.assign(course, fields);

    // The instructor and the student are relations: their ids cannot simply
    // be copied onto the course.
    if (movesInstructor) {
      course.instructor = { id: instructorId } as User;
    }
    if (movesStudent) {
      course.student = { id: studentId } as User;
    }

    return this.courseRepository.save(course);
  }

  // Supprimer un cours. Only a course that left no trace is deleted: once it
  // took place or carries competencies, comments or a rating, it is part of
  // the student's training record and can only be cancelled.
  async deleteCourse(id: number): Promise<boolean> {
    const course = await this.findOne(id);

    const hasRecord =
      course.status === CourseStatus.IN_PROGRESS ||
      course.status === CourseStatus.COMPLETED ||
      (course.competencies?.length ?? 0) > 0 ||
      (course.comments?.length ?? 0) > 0 ||
      course.rating != null ||
      !!course.feedback;
    if (hasRecord) {
      throw localized(ConflictException, 'error.course.hasRecord');
    }

    const result = await this.courseRepository.delete(id);
    return result.affected > 0;
  }

  // Ajouter une compétence à un cours
  async addCompetency(input: AddCompetencyInput): Promise<CourseCompetency> {
    const course = await this.findOne(input.courseId);

    const competency = this.competencyRepository.create({
      name: input.name,
      description: input.description,
      validated: false,
      course,
    });

    return this.competencyRepository.save(competency);
  }

  // Ajouter une note et feedback à un cours
  async rateCourse(
    id: number,
    rating: number,
    feedback: string,
  ): Promise<InstructionCourse> {
    if (
      !Number.isInteger(rating) ||
      rating < COURSE_RATING_MIN ||
      rating > COURSE_RATING_MAX
    ) {
      throw localized(BadRequestException, 'error.course.ratingOutOfRange', {
        min: COURSE_RATING_MIN,
        max: COURSE_RATING_MAX,
      });
    }

    const course = await this.findOne(id);
    this.assertTookPlace(course);
    course.rating = rating;
    course.feedback = feedback;
    return this.courseRepository.save(course);
  }

  // Nothing is validated or rated on a course that is cancelled or has not
  // started yet.
  private assertTookPlace(course: InstructionCourse): void {
    if (
      course.status === CourseStatus.CANCELED ||
      new Date(course.startTime).getTime() > Date.now()
    ) {
      throw localized(ConflictException, 'error.course.notStarted');
    }
  }

  // Valider une compétence dans un cours
  async validateCompetency(competencyId: number): Promise<CourseCompetency> {
    const competency = await this.competencyRepository.findOne({
      where: { id: competencyId },
      relations: ['course', 'course.student'],
    });
    if (!competency) {
      throw new NotFoundException(
        `Competency with ID ${competencyId} not found`,
      );
    }
    this.assertTookPlace(competency.course);
    competency.validated = true;

    await this.notificationsService.create({
      user_id: competency.course.student.id,
      notification_type: 'COMPETENCY_VALIDATED',
      notification_date: new Date(),
      message: translate(
        languageOf(competency.course.student),
        'notification.competencyValidated',
      ),
      is_read: false,
    });

    return this.competencyRepository.save(competency);
  }

  // Ajouter un commentaire à un cours
  async addComment(input: AddCommentInput): Promise<CourseComment> {
    const course = await this.findOne(input.courseId);

    const comment = this.commentRepository.create({
      content: input.content,
      creationDate: new Date(),
      author: { id: input.author },
      course,
    });

    await this.notificationsService.create({
      user_id: course.student.id,
      notification_type: 'COURSE_COMMENT',
      notification_date: new Date(),
      message: translate(
        languageOf(course.student),
        'notification.courseComment',
      ),
      is_read: false,
    });

    const saved = await this.commentRepository.save(comment);

    // Reloaded with its author: the saved entity only carries the author id,
    // and the API returns the author's name with the comment.
    return this.commentRepository.findOne({
      where: { id: saved.id },
      relations: ['author'],
    });
  }

  // Whether the instructor has at least one course with this student.
  async teaches(instructorId: number, studentId: number): Promise<boolean> {
    const courses = await this.courseRepository.count({
      where: { instructor: { id: instructorId }, student: { id: studentId } },
    });
    return courses > 0;
  }

  // Course a competency belongs to, with its instructor and student.
  async findCourseOfCompetency(
    competencyId: number,
  ): Promise<InstructionCourse> {
    const competency = await this.competencyRepository.findOne({
      where: { id: competencyId },
      relations: ['course', 'course.instructor', 'course.student'],
    });
    if (!competency) {
      throw new NotFoundException(
        `Competency with ID ${competencyId} not found`,
      );
    }
    return competency.course;
  }

  //Trouver les cours par ID utilisateur
  async findCoursesByUserId(userId: number): Promise<InstructionCourse[]> {
    return this.courseRepository.find({
      where: [{ instructor: { id: userId } }, { student: { id: userId } }],
      relations: [
        'instructor',
        'student',
        'competencies',
        'comments',
        'comments.author',
      ],
    });
  }

  // Update status of a course
  async updateCourseStatus(
    id: number,
    status: InstructionCourse['status'],
  ): Promise<InstructionCourse> {
    const course = await this.findOne(id);
    course.status = status;
    return this.courseRepository.save(course);
  }

  // cherche les cours expirés
  async findExpiredCourses(): Promise<InstructionCourse[]> {
    const now = new Date();
    return this.courseRepository.find({
      where: {
        endTime: LessThan(now),
        status: In(['IN_PROGRESS', 'SCHEDULED']),
      },
      // Both are notified when the course is marked as completed.
      relations: ['instructor', 'student'],
    });
  }

  async getUserInstructionSummary(userId: number): Promise<any> {
    const user = await this.userService.findOneById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const upcomingCourses = await this.getUpcomingCoursesForUser(userId);
    const recentCourses = await this.getRecentCoursesForUser(userId);
    const certifications = await this.getUserCertifications(userId);
    const learningProgress = await this.getUserLearningProgress(userId);
    const evaluations = await this.getUserEvaluationSummary(userId);
    const eLearningCourses = await this.getUserELearningCourses(userId);

    return {
      upcomingCourses,
      recentCourses,
      certifications,
      learningProgress,
      evaluations,
      eLearningCourses,
    };
  }

  private async getUpcomingCoursesForUser(userId: number): Promise<any[]> {
    const now = new Date();

    const courses = await this.courseRepository.find({
      where: [
        {
          student: { id: userId },
          startTime: MoreThanOrEqual(now),
          status: CourseStatus.SCHEDULED,
        },
        {
          student: { id: userId },
          startTime: MoreThanOrEqual(now),
          status: CourseStatus.IN_PROGRESS,
        },
      ],
      relations: ['instructor'],
      order: { startTime: 'ASC' },
      take: 5,
    });

    return courses.map((course) => ({
      id: course.id,
      title: `Flight Instruction Session #${course.id}`,
      date: course.startTime,
      instructor: {
        id: course.instructor.id,
        name: `${course.instructor.first_name} ${course.instructor.last_name}`,
        avatar: course.instructor.profile_picture,
      },
      status: course.status,
    }));
  }

  private async getRecentCoursesForUser(userId: number): Promise<any[]> {
    const now = new Date();

    try {
      const courses = await this.courseRepository.find({
        where: {
          student: { id: userId },
          endTime: LessThan(now),
          status: CourseStatus.COMPLETED,
        },
        relations: ['instructor'],
        order: { endTime: 'DESC' },
        take: 5,
      });

      return courses.map((course) => ({
        id: course.id,
        title: `Flight Instruction Session #${course.id}`,
        date: course.endTime || course.startTime,
        instructor: {
          id: course.instructor.id,
          name: `${course.instructor.first_name} ${course.instructor.last_name}`,
          avatar: course.instructor.profile_picture,
        },
        status: course.status,
      }));
    } catch (error) {
      new Logger(InstructionCoursesService.name).error(
        'Error fetching recent courses',
        error,
      );
      return [];
    }
  }

  private async getUserCertifications(userId: number): Promise<any[]> {
    const user = await this.userService.findOneById(userId);
    if (!user || !user.licenses) return [];

    return user.licenses.map((license) => {
      const now = new Date();
      const expiryDate = license.expiration_date;
      let status = 'VALID';
      let progress = 100;

      if (expiryDate) {
        const daysUntilExpiry = Math.floor(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysUntilExpiry < 0) {
          status = 'EXPIRED';
          progress = 0;
        } else if (daysUntilExpiry < 30) {
          status = 'EXPIRING_SOON';
          progress = Math.floor((daysUntilExpiry / 30) * 100);
        }
      }

      return {
        id: license.id,
        name: license.license_type,
        status,
        expiryDate: license.expiration_date,
        progress,
      };
    });
  }

  private async getUserLearningProgress(userId: number): Promise<any> {
    const completedCoursesCount = await this.courseRepository.count({
      where: {
        student: { id: userId },
        status: CourseStatus.COMPLETED,
      },
    });

    const totalCoursesCount = await this.courseRepository.count({
      where: {
        student: { id: userId },
      },
    });

    const completedLessonsCount =
      await this.userService.countCompletedLessons(userId);

    const totalLessonsCount = await this.lessonRepository.count();

    return {
      completedCourses: completedCoursesCount,
      totalCourses: totalCoursesCount,
      completedLessons: completedLessonsCount,
      totalLessons: totalLessonsCount,
    };
  }

  private async getUserEvaluationSummary(userId: number): Promise<any> {
    const evaluationResults =
      await this.userService.getEvaluationResults(userId);

    const completedEvaluations = evaluationResults.filter(
      (result) => result.completed,
    );

    const scores = completedEvaluations.map((result) => result.score || 0);
    const averageScore =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 0;

    const upcomingEvaluations = evaluationResults.filter(
      (result) => !result.completed,
    );

    return {
      completed: completedEvaluations.length,
      upcoming: upcomingEvaluations.length,
      averageScore,
    };
  }

  private async getUserELearningCourses(userId: number): Promise<any[]> {
    try {
      const courses = await this.eLearningService.getCourses(
        null,
        null,
        null,
        userId,
      );

      const coursesWithProgress = await Promise.all(
        courses.map(async (course) => {
          const courseDetails = await this.eLearningService.getCourseById(
            course.id,
            userId,
          );

          const totalLessons = courseDetails.modules.reduce(
            (total, module) => total + module.lessons.length,
            0,
          );

          const completedLessons = await this.userProgressRepository.count({
            where: {
              user: { id: userId },
              lesson: {
                module: {
                  course: { id: course.id },
                },
              },
              completed: true,
            },
          });

          const lastCompletedLesson = await this.userProgressRepository.findOne(
            {
              where: {
                user: { id: userId },
                lesson: {
                  module: {
                    course: { id: course.id },
                  },
                },
                completed: true,
              },
              order: { completed_at: 'DESC' },
            },
          );

          const progress = Math.floor((completedLessons / totalLessons) * 100);

          return {
            id: course.id,
            title: course.title,
            category: course.category,
            progress: progress || 0,
            completedLessons,
            totalLessons,
            lastAccessedDate: lastCompletedLesson?.completed_at,
          };
        }),
      );

      return coursesWithProgress.sort((a, b) => b.progress - a.progress);
    } catch (error) {
      new Logger(InstructionCoursesService.name).error(
        'Error fetching e-learning courses',
        error,
      );
      return [];
    }
  }
}
