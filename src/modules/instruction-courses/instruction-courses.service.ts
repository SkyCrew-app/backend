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
import { CourseCompetency } from './entity/course-competency.entity';
import { CourseComment } from './entity/course-comment.entity';
import { CreateCourseInstructionInput } from './dto/create-course.input';
import { UpdateCourseInstructionInput } from './dto/update-course.input';
import { AddCompetencyInput } from './dto/add-competency.input';
import { AddCommentInput } from './dto/add-comment.input';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InstructionCoursesService {
  constructor(
    @InjectRepository(InstructionCourse)
    private readonly courseRepository: Repository<InstructionCourse>,
    @InjectRepository(CourseCompetency)
    private readonly competencyRepository: Repository<CourseCompetency>,
    @InjectRepository(CourseComment)
    private readonly commentRepository: Repository<CourseComment>,
    private readonly userService: UsersService,
    private readonly notificationsService: NotificationsService,
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
      relations: ['instructor', 'student', 'competencies', 'comments'],
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
      relations: ['instructor', 'student', 'competencies', 'comments'],
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
}
