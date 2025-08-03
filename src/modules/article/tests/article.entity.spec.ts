import 'reflect-metadata';
import { Article } from '../entity/article.entity';

describe('Article Entity', () => {
  it('instantiation et types', () => {
    const a = new Article();
    a.id = 1;
    a.title = 'T';
    a.description = 'D';
    a.text = 'X';
    a.tags = ['t'];
    a.photo_url = 'p.png';
    a.documents_url = ['d1.pdf'];
    a.eventDate = new Date('2025-08-03T10:00:00Z');
    a.createdAt = new Date();
    a.updatedAt = new Date();
    a.calendarLink = 'link';
    expect(a).toHaveProperty('id', 1);
    expect(a).toHaveProperty('tags', ['t']);
    expect(a).toHaveProperty('eventDate', new Date('2025-08-03T10:00:00Z'));
  });

  it('decorators TypeORM et GraphQL définissent metadata design:type', () => {
    expect(Reflect.getMetadata('design:type', Article.prototype, 'id')).toBe(
      Number,
    );
    expect(Reflect.getMetadata('design:type', Article.prototype, 'text')).toBe(
      String,
    );
    expect(Reflect.getMetadata('design:type', Article.prototype, 'tags')).toBe(
      Array,
    );
    expect(
      Reflect.getMetadata('design:type', Article.prototype, 'createdAt'),
    ).toBe(Date);
  });
});
