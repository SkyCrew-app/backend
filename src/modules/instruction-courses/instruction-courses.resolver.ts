import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { InstructionCourse } from './entity/instruction-courses.entity';
import { InstructionCoursesService } from './instruction-courses.service';
import { CreateCourseInstructionInput } from './dto/create-course.input';
import { UpdateCourseInstructionInput } from './dto/update-course.input';
import { AddCompetencyInput } from './dto/add-competency.input';
import { AddCommentInput } from './dto/add-comment.input';
import { CourseCompetency } from './entity/course-competency.entity';
import { CourseComment } from './entity/course-comment.entity';
import { UserInstructionSummary } from './dto/instruction-summary.dto';

@Resolver(() => InstructionCourse)
export class InstructionCoursesResolver {
  constructor(private readonly courseService: InstructionCoursesService) {}

  // Récupérer tous les cours
  @Query(() => [InstructionCourse], { name: 'getAllCoursesInstruction' })
  async getAllCourses(): Promise<InstructionCourse[]> {
    return this.courseService.findAll();
  }

  // Récupérer un cours par ID
  @Query(() => InstructionCourse, { name: 'getCourseInstructionById' })
  async getCourseById(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<InstructionCourse> {
    return this.courseService.findOne(id);
  }

  // Récupérer les cours d'un étudiant
  @Query(() => [InstructionCourse], { name: 'getCoursesInstructionByStudent' })
  async getCoursesByStudent(
    @Args('studentId', { type: () => Int }) studentId: number,
  ): Promise<InstructionCourse[]> {
    return this.courseService.findCoursesByStudent(studentId);
  }

  // Récupérer les cours d'un instructeur
  @Query(() => [InstructionCourse], {
    name: 'getCoursesInstructionByInstructor',
  })
  async getCoursesByInstructor(
    @Args('instructorId', { type: () => Int }) instructorId: number,
  ): Promise<InstructionCourse[]> {
    return this.courseService.findCoursesByInstructor(instructorId);
  }

  // Créer un nouveau cours
  @Mutation(() => InstructionCourse, { name: 'createCourseInstruction' })
  async createCourse(
    @Args('input') input: CreateCourseInstructionInput,
  ): Promise<InstructionCourse> {
    return this.courseService.createCourse(input);
  }

  // Ajouter la note et le feedback à un cours
  @Mutation(() => InstructionCourse, { name: 'rateCourseInstruction' })
  async rateCourse(
    @Args('id', { type: () => Int }) id: number,
    @Args('rating', { type: () => Int }) rating: number,
    @Args('feedback', { type: () => String }) feedback: string,
  ): Promise<InstructionCourse> {
    return this.courseService.rateCourse(id, rating, feedback);
  }

  // Mettre à jour un cours existant
  @Mutation(() => InstructionCourse, { name: 'updateCourseInstruction' })
  async updateCourse(
    @Args('input') input: UpdateCourseInstructionInput,
  ): Promise<InstructionCourse> {
    return this.courseService.updateCourse(input.id, input);
  }

  // Supprimer un cours
  @Mutation(() => Boolean, { name: 'deleteCourseInstruction' })
  async deleteCourse(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<boolean> {
    return this.courseService.deleteCourse(id);
  }

  // Ajouter une compétence à un cours
  @Mutation(() => CourseCompetency, { name: 'addCompetencyToCourse' })
  async addCompetencyToCourse(
    @Args('input') input: AddCompetencyInput,
  ): Promise<CourseCompetency> {
    return this.courseService.addCompetency(input);
  }

  // Valider une compétence d'un cours
  @Mutation(() => CourseCompetency, { name: 'validateCompetency' })
  async validateCompetency(
    @Args('competencyId', { type: () => Int }) competencyId: number,
  ): Promise<CourseCompetency> {
    return this.courseService.validateCompetency(competencyId);
  }

  // Ajouter un commentaire à un cours
  @Mutation(() => CourseComment, { name: 'addCommentToCourse' })
  async addCommentToCourse(
    @Args('input') input: AddCommentInput,
  ): Promise<CourseComment> {
    return this.courseService.addComment(input);
  }

  // Trouver tout les cours par ID utilisateur
  @Query(() => [InstructionCourse], { name: 'getCoursesByUserId' })
  async getCoursesByUserId(
    @Args('userId', { type: () => Int }) userId: number,
  ): Promise<InstructionCourse[]> {
    return this.courseService.findCoursesByUserId(userId);
  }

  @Query(() => UserInstructionSummary, { name: 'getUserInstructionSummary' })
  async getUserInstructionSummary(
    @Args('userId', { type: () => Int, nullable: true }) userId?: number,
    @Context() context?: any,
  ): Promise<UserInstructionSummary> {
    // Si userId n'est pas fourni, utiliser l'ID de l'utilisateur connecté
    const userIdToUse = userId || context.req.user.id;
    return this.courseService.getUserInstructionSummary(userIdToUse);
  }
}
