import 'reflect-metadata';
import { CreateArticleInput } from '../dto/create-article.input';

describe('CreateArticleInput DTO', () => {
  it('instanciation et propriétés', () => {
    const input = new CreateArticleInput();
    input.title = 'Title';
    input.description = 'Description';
    input.text = 'Content';
    input.tags = ['tag1', 'tag2'];
    input.photo = 'photo.png';
    input.documents = 'docs.pdf';
    input.eventDate = new Date('2025-08-03T10:00:00Z');
    expect(input).toMatchObject({
      title: 'Title',
      description: 'Description',
      text: 'Content',
      tags: ['tag1', 'tag2'],
      photo: 'photo.png',
      documents: 'docs.pdf',
      eventDate: new Date('2025-08-03T10:00:00Z'),
    });
  });

  it('decorators GraphQL définissent design:type', () => {
    expect(
      Reflect.getMetadata('design:type', CreateArticleInput.prototype, 'title'),
    ).toBe(String);
    expect(
      Reflect.getMetadata('design:type', CreateArticleInput.prototype, 'tags'),
    ).toBe(Array);
    expect(
      Reflect.getMetadata(
        'design:type',
        CreateArticleInput.prototype,
        'eventDate',
      ),
    ).toBe(Date);
  });
});
