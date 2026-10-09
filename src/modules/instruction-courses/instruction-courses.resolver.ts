import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { InstructionCourse } from './entity/instruction-courses.entity';
import { InstructionCoursesService } from './instruction-courses.service';
import { CreateCourseInstructionInput } from './dto/create-course.input';
import { UpdateCourseInstructionInput } from './dto/update-course.input';
import { AddCompetencyInput } from './dto/add-competency.input';
import { AddCommentInput } from './dto/add-comment.input';
import { CourseCompetency } from './entity/course-competency.entity';
import { CourseComment } from './entity/course-comment.entity';
import { UserInstructionSummary } from './dto/instruction-summary.dto';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  hasRole,
  isAdmin,
  ROLE_INSTRUCTOR,
  SessionUser,
} from '../../common/auth/access';

const isSameUser = (
  user: SessionUser | undefined,
  id: number | undefined | null,
): boolean => user != null && id != null && Number(user.id) === Number(id);

const forbidden = () =>
  new ForbiddenException('You are not allowed to access this course');

// An instructor manages their own courses and sees their own students.
// A student sees and rates their own courses. An administrator sees all.
@Resolver(() => InstructionCourse)
@UseGuards(JwtAuthGuard)
export class InstructionCoursesResolver {
  constructor(private readonly courseService: InstructionCoursesService) {}

  private assertParticipant(user: SessionUser, course: InstructionCourse) {
    if (
      isAdmin(user) ||
      isSameUser(user, course.instructor?.id) ||
      isSameUser(user, course.student?.id)
    ) {
      return;
    }
    throw forbidden();
  }

  private assertInstructorOf(user: SessionUser, course: InstructionCourse) {
    if (isAdmin(user) || isSameUser(user, course.instructor?.id)) {
      return;
    }
    throw forbidden();
  }

  // Courses of `userId` the caller may see: all of them for the user and
  // administrators, only the shared ones for the user's instructors.
  private visibleCourses(
    user: SessionUser,
    userId: number,
    courses: InstructionCourse[],
  ): InstructionCourse[] {
    if (isAdmin(user) || isSameUser(user, userId)) {
      return courses;
    }

    const shared = courses.filter(
      (course) =>
        isSameUser(user, course.instructor?.id) ||
        isSameUser(user, course.student?.id),
    );

    if (shared.length === 0 && courses.length > 0) {
      throw forbidden();
    }
    return shared;
  }

  // Récupérer tous les cours
  @Query(() => [InstructionCourse], { name: 'getAllCoursesInstruction' })
  @UseGuards(RolesGuard)
  @Roles('Administrateur')
  async getAllCourses(): Promise<InstructionCourse[]> {
    return this.courseService.findAll();
  }

  // Récupérer un cours par ID
  @Query(() => InstructionCourse, { name: 'getCourseInstructionById' })
  async getCourseById(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<InstructionCourse> {
    const course = await this.courseService.findOne(id);
    this.assertParticipant(currentUser, course);
    return course;
  }

  // Récupérer les cours d'un étudiant
  @Query(() => [InstructionCourse], { name: 'getCoursesInstructionByStudent' })
  async getCoursesByStudent(
    @Args('studentId', { type: () => Int }) studentId: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<InstructionCourse[]> {
    const courses = await this.courseService.findCoursesByStudent(studentId);
    return this.visibleCourses(currentUser, studentId, courses);
  }

  // Récupérer les cours d'un instructeur
  @Query(() => [InstructionCourse], {
    name: 'getCoursesInstructionByInstructor',
  })
  async getCoursesByInstructor(
    @Args('instructorId', { type: () => Int }) instructorId: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<InstructionCourse[]> {
    const courses =
      await this.courseService.findCoursesByInstructor(instructorId);
    return this.visibleCourses(currentUser, instructorId, courses);
  }

  // Créer un nouveau cours
  @Mutation(() => InstructionCourse, { name: 'createCourseInstruction' })
  async createCourse(
    @Args('input') input: CreateCourseInstructionInput,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<InstructionCourse> {
    if (isAdmin(currentUser)) {
      return this.courseService.createCourse(input);
    }

    if (!hasRole(currentUser, ROLE_INSTRUCTOR)) {
      throw new ForbiddenException('Only instructors can create a course');
    }

    // An instructor creates courses they give themselves.
    return this.courseService.createCourse({
      ...input,
      instructorId: currentUser.id,
    });
  }

  // Ajouter la note et le feedback à un cours
  @Mutation(() => InstructionCourse, { name: 'rateCourseInstruction' })
  async rateCourse(
    @Args('id', { type: () => Int }) id: number,
    @Args('rating', { type: () => Int }) rating: number,
    @Args('feedback', { type: () => String }) feedback: string,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<InstructionCourse> {
    // Rating a course is the student's part.
    const course = await this.courseService.findOne(id);
    if (!isAdmin(currentUser) && !isSameUser(currentUser, course.student?.id)) {
      throw forbidden();
    }
    return this.courseService.rateCourse(id, rating, feedback);
  }

  // Mettre à jour un cours existant
  @Mutation(() => InstructionCourse, { name: 'updateCourseInstruction' })
  async updateCourse(
    @Args('input') input: UpdateCourseInstructionInput,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<InstructionCourse> {
    this.assertInstructorOf(
      currentUser,
      await this.courseService.findOne(input.id),
    );
    return this.courseService.updateCourse(input.id, input);
  }

  // Supprimer un cours
  @Mutation(() => Boolean, { name: 'deleteCourseInstruction' })
  async deleteCourse(
    @Args('id', { type: () => Int }) id: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<boolean> {
    this.assertInstructorOf(currentUser, await this.courseService.findOne(id));
    return this.courseService.deleteCourse(id);
  }

  // Ajouter une compétence à un cours
  @Mutation(() => CourseCompetency, { name: 'addCompetencyToCourse' })
  async addCompetencyToCourse(
    @Args('input') input: AddCompetencyInput,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<CourseCompetency> {
    this.assertInstructorOf(
      currentUser,
      await this.courseService.findOne(input.courseId),
    );
    return this.courseService.addCompetency(input);
  }

  // Valider une compétence d'un cours
  @Mutation(() => CourseCompetency, { name: 'validateCompetency' })
  async validateCompetency(
    @Args('competencyId', { type: () => Int }) competencyId: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<CourseCompetency> {
    this.assertInstructorOf(
      currentUser,
      await this.courseService.findCourseOfCompetency(competencyId),
    );
    return this.courseService.validateCompetency(competencyId);
  }

  // Ajouter un commentaire à un cours
  @Mutation(() => CourseComment, { name: 'addCommentToCourse' })
  async addCommentToCourse(
    @Args('input') input: AddCommentInput,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<CourseComment> {
    this.assertParticipant(
      currentUser,
      await this.courseService.findOne(input.courseId),
    );
    // The author is always the caller.
    return this.courseService.addComment({ ...input, author: currentUser.id });
  }

  // Trouver tout les cours par ID utilisateur
  @Query(() => [InstructionCourse], { name: 'getCoursesByUserId' })
  async getCoursesByUserId(
    @Args('userId', { type: () => Int }) userId: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<InstructionCourse[]> {
    const courses = await this.courseService.findCoursesByUserId(userId);
    return this.visibleCourses(currentUser, userId, courses);
  }

  @Query(() => UserInstructionSummary, { name: 'getUserInstructionSummary' })
  async getUserInstructionSummary(
    @Args('userId', { type: () => Int, nullable: true }) userId?: number,
    @CurrentUser() currentUser?: SessionUser,
  ): Promise<UserInstructionSummary> {
    // Without a user id, the summary is the caller's own.
    const userIdToUse = userId || currentUser.id;

    const allowed =
      isAdmin(currentUser) ||
      isSameUser(currentUser, userIdToUse) ||
      (hasRole(currentUser, ROLE_INSTRUCTOR) &&
        (await this.courseService.teaches(currentUser.id, userIdToUse)));

    if (!allowed) {
      throw forbidden();
    }

    return this.courseService.getUserInstructionSummary(userIdToUse);
  }
}
