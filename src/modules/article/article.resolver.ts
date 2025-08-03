import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ArticlesService } from './article.service';
import { Article } from './entity/article.entity';
import { CreateArticleInput } from './dto/create-article.input';
import { UpdateArticleInput } from './dto/update-article.input';
import { FileUpload, GraphQLUpload } from 'graphql-upload-ts';
import { NotFoundException } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Resolver(() => Article)
export class ArticlesResolver {
  constructor(private readonly articlesService: ArticlesService) {}

  @Mutation(() => Article)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async createArticle(
    @Args('createArticleInput') createArticleInput: CreateArticleInput,
    @Args({ name: 'photo', type: () => GraphQLUpload, nullable: true })
    photo?: FileUpload,
    @Args({ name: 'documents', type: () => [GraphQLUpload], nullable: true })
    documents?: FileUpload[],
  ): Promise<Article> {
    const photoPath = await this.articlesService.uploadFile(photo);
    const documentPaths = await this.articlesService.uploadFiles(documents);

    return this.articlesService.create(
      createArticleInput,
      photoPath,
      documentPaths,
    );
  }

  @Query(() => [Article], { name: 'articles' })
  findAll(): Promise<Article[]> {
    return this.articlesService.findAll();
  }

  @Query(() => Article, { name: 'article' })
  findOne(@Args('id') id: number): Promise<Article> {
    return this.articlesService.findOne(id);
  }

  @Mutation(() => Article)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  async updateArticle(
    @Args('updateArticleInput') updateArticleInput: UpdateArticleInput,
    @Args({ name: 'photo', type: () => GraphQLUpload, nullable: true })
    photo?: FileUpload,
    @Args({ name: 'documents', type: () => [GraphQLUpload], nullable: true })
    documents?: FileUpload[],
  ): Promise<Article> {
    const photoPath = await this.articlesService.uploadFile(photo);
    const documentPaths = await this.articlesService.uploadFiles(documents);

    return this.articlesService.update(
      updateArticleInput,
      photoPath,
      documentPaths,
    );
  }

  @Mutation(() => Article)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrateur')
  removeArticle(@Args('id', { type: () => Int }) id: number): Promise<Article> {
    return this.articlesService.remove(id);
  }

  @Query(() => Article, { name: 'article' })
  @UseGuards(JwtAuthGuard)
  async getArticleBySlug(
    @Args('id', { type: () => Int }) id: number,
  ): Promise<Article> {
    const article = await this.articlesService.findOneBySlug(id);
    if (!article) {
      throw new NotFoundException(`Article with slug ${id} not found`);
    }
    return article;
  }
}
