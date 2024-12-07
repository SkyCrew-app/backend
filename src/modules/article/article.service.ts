import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from './entity/article.entity';
import { CreateArticleInput } from './dto/create-article.input';
import { UpdateArticleInput } from './dto/update-article.input';
import { FileUpload } from 'graphql-upload-ts';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
  ) {}

  async create(
    createArticleInput: CreateArticleInput,
    photoPath: string | null,
    documentPaths: string[] | null,
  ): Promise<Article> {
    const article = this.articlesRepository.create(createArticleInput);

    if (photoPath) {
      article.photo_url = photoPath;
    }

    if (documentPaths && documentPaths.length > 0) {
      article.documents_url = documentPaths;
    }

    if (createArticleInput.eventDate) {
      article.calendarLink = this.generateCalendarLink(
        createArticleInput.title,
        createArticleInput.description,
        createArticleInput.eventDate,
      );
    }

    return this.articlesRepository.save(article);
  }

  async update(
    updateArticleInput: UpdateArticleInput,
    photoPath: string | null,
    documentPaths: string[] | null,
  ): Promise<Article> {
    const article = await this.articlesRepository.preload(updateArticleInput);
    if (!article) {
      throw new NotFoundException(
        `Article with ID ${updateArticleInput.id} not found`,
      );
    }

    if (photoPath) {
      article.photo_url = photoPath;
    }

    if (documentPaths && documentPaths.length > 0) {
      article.documents_url = documentPaths;
    }

    return this.articlesRepository.save(article);
  }

  async uploadFile(file?: FileUpload): Promise<string | null> {
    if (!file) return null;

    const { createReadStream, filename } = await file;
    const uploadDir = path.join(__dirname, '../../uploads/tmp');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    const stream = createReadStream();

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    return `/uploads/tmp/${filename}`;
  }

  async uploadFiles(files?: FileUpload[]): Promise<string[] | null> {
    if (!files || files.length === 0) return null;

    const paths = [];
    for (const file of files) {
      const path = await this.uploadFile(file);
      if (path) paths.push(path);
    }
    return paths;
  }

  async findAll(): Promise<Article[]> {
    return this.articlesRepository.find();
  }

  async findOne(id: number): Promise<Article> {
    const article = await this.articlesRepository.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }
    return article;
  }

  async remove(id: number): Promise<Article> {
    const article = await this.findOne(id);
    await this.articlesRepository.remove(article);
    return article;
  }

  private generateCalendarLink(
    title: string,
    description: string,
    eventDate: Date,
  ): string {
    const startTime = encodeURIComponent(eventDate.toISOString());
    const endTime = encodeURIComponent(
      new Date(eventDate.getTime() + 60 * 60 * 1000).toISOString(),
    );
    const details = encodeURIComponent(description);

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      title,
    )}&dates=${startTime}/${endTime}&details=${details}`;
  }

  async findOneBySlug(id: number): Promise<Article | undefined> {
    return this.articlesRepository.findOne({ where: { id } });
  }
}
