import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LessThanOrEqual,
  MoreThanOrEqual,
  LessThan,
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

  async checkScheduleConflict(
    instructorId: number,
    studentId: number,
    startTime: Date,
    endTime: Date,
  ): Promise<boolean> {
    const conflict = await this.courseRepository.findOne({
      where: [
        {
          instructor: { id: instructorId },
          startTime: LessThanOrEqual(endTime),
          endTime: MoreThanOrEqual(startTime),
        },
        {
          student: { id: studentId },
          startTime: LessThanOrEqual(endTime),
          endTime: MoreThanOrEqual(startTime),
        },
      ],
    });

    return !!conflict;
  }

  // Créer un cours
  async createCourse(
    input: CreateCourseInstructionInput,
  ): Promise<InstructionCourse> {
    const { instructorId, studentId, startTime, endTime } = input;

    const hasConflict = await this.checkScheduleConflict(
      instructorId,
      studentId,
      startTime,
      endTime,
    );

    if (hasConflict) {
      throw new Error(
        'Schedule conflict detected. The instructor or student already has a course during this period.',
      );
    }

    // vérifier si les utilisateurs existent
    const instructor = await this.userService.findOneById(instructorId);
    const student = await this.userService.findOneById(studentId);

    if (!instructor || !student) {
      throw new NotFoundException('Instructor or student not found');
    }

    const course = this.courseRepository.create({
      ...input,
      instructor,
      student,
    });

    await this.notificationsService.create({
      user_id: studentId,
      notification_type: 'COURSE_CREATED',
      notification_date: new Date(),
      message: `Votre cours avec l'instructeur ${instructorId} a été créé.`,
      is_read: false,
    });

    await this.notificationsService.create({
      user_id: instructorId,
      notification_type: 'COURSE_CREATED',
      notification_date: new Date(),
      message: `Votre cours avec l'étudiant ${studentId} a été créé.`,
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

  // Mettre à jour un cours
  async updateCourse(
    id: number,
    input: UpdateCourseInstructionInput,
  ): Promise<InstructionCourse> {
    const course = await this.findOne(id);
    Object.assign(course, input);
    return this.courseRepository.save(course);
  }

  // Supprimer un cours
  async deleteCourse(id: number): Promise<boolean> {
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
    const course = await this.findOne(id);
    course.rating = rating;
    course.feedback = feedback;
    return this.courseRepository.save(course);
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
    competency.validated = true;

    await this.notificationsService.create({
      user_id: competency.course.student.id,
      notification_type: 'COMPETENCY_VALIDATED',
      notification_date: new Date(),
      message: `Une compétence a été validée dans votre cours.`,
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
      message: `Un commentaire a été ajouté à votre cours.`,
      is_read: false,
    });

    return this.commentRepository.save(comment);
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
      console.error('Error fetching recent courses:', error);
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

    const userProgressResults =
      await this.userService.getEvaluationResults(userId);

    const lessonProgresses = userProgressResults.filter(
      (progress) => progress.lesson,
    );

    const completedLessonsCount = lessonProgresses.filter(
      (progress) => progress.completed,
    ).length;

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
      console.error('Error fetching e-learning courses:', error);
      return [];
    }
  }
}
