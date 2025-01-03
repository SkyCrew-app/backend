import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticlesService } from './article.service';
import { ArticlesResolver } from './article.resolver';
import { Article } from './entity/article.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  providers: [ArticlesService, ArticlesResolver],
})
export class ArticleModule {}
