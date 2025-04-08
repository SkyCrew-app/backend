import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class InstructorDto {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field({ nullable: true })
  avatar?: string;
}

@ObjectType()
export class CourseDto {
  @Field(() => Int)
  id: number;

  @Field()
  title: string;

  @Field()
  date: Date;

  @Field(() => InstructorDto)
  instructor: InstructorDto;

  @Field()
  status: string;
}

@ObjectType()
export class CertificationDto {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  expiryDate?: Date;

  @Field(() => Int)
  progress: number;
}

@ObjectType()
export class LearningProgressDto {
  @Field(() => Int)
  completedCourses: number;

  @Field(() => Int)
  totalCourses: number;

  @Field(() => Int)
  completedLessons: number;

  @Field(() => Int)
  totalLessons: number;
}

@ObjectType()
export class EvaluationSummaryDto {
  @Field(() => Int)
  completed: number;

  @Field(() => Int)
  upcoming: number;

  @Field(() => Float)
  averageScore: number;
}

@ObjectType()
export class ELearningCourseDto {
  @Field(() => Int)
  id: number;

  @Field()
  title: string;

  @Field()
  category: string;

  @Field(() => Float)
  progress: number;

  @Field(() => Int)
  completedLessons: number;

  @Field(() => Int)
  totalLessons: number;

  @Field({ nullable: true })
  lastAccessedDate?: Date;
}

@ObjectType()
export class UserInstructionSummary {
  @Field(() => [CourseDto])
  upcomingCourses: CourseDto[];

  @Field(() => [CourseDto])
  recentCourses: CourseDto[];

  @Field(() => [CertificationDto])
  certifications: CertificationDto[];

  @Field(() => LearningProgressDto)
  learningProgress: LearningProgressDto;

  @Field(() => EvaluationSummaryDto)
  evaluations: EvaluationSummaryDto;

  @Field(() => [ELearningCourseDto])
  eLearningCourses: ELearningCourseDto[];
}
