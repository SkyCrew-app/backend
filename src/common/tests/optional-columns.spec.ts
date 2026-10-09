import 'reflect-metadata';
import { TypeMetadataStorage } from '@nestjs/graphql';
import { LazyMetadataStorage } from '@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage';
import { getMetadataArgsStorage } from 'typeorm';
import { Aircraft } from '../../modules/aircraft/entity/aircraft.entity';
import { Administration } from '../../modules/administration/entity/admin.entity';
import { Course } from '../../modules/e-learning/entity/course.entity';

// A column that may be empty in the database must be nullable in the API:
// otherwise one empty value makes the whole query fail.
describe('optional columns', () => {
  beforeAll(() => {
    // Field metadata is registered lazily, when the schema is built.
    LazyMetadataStorage.load();
    TypeMetadataStorage.compile();
  });

  it.each([
    ['Aircraft', Aircraft],
    ['Administration', Administration],
    ['Course', Course],
  ])('are nullable in the API for %s', (_name, entity) => {
    const optionalColumns = getMetadataArgsStorage()
      .columns.filter(
        (column) => column.target === entity && column.options.nullable,
      )
      .map((column) => column.propertyName);

    const requiredFields: string[] =
      TypeMetadataStorage.getObjectTypesMetadata()
        .find((type) => type.target === entity)
        .properties.filter((field) => !field.options?.nullable)
        .map((field) => field.name);

    expect(optionalColumns.length).toBeGreaterThan(0);
    expect(requiredFields.length).toBeGreaterThan(0);
    expect(
      optionalColumns.filter((name) => requiredFields.includes(name)),
    ).toEqual([]);
  });
});
