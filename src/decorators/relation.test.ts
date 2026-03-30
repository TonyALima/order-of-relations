import { expect, test, describe } from 'bun:test';
import { RelationType } from '../core/metadata';
import { Database } from '../core/database';
import { Entity } from './entity';
import { PrimaryColumn } from './column';
import { COLUMN_TYPE } from '../core/sql-types';
import { ToOne } from './relation';

describe('@ToOne decorator', () => {
  test('stores relation metadata with auto-derived FK column name', () => {
    @Entity()
    class User {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => Profile })
      profile?: Profile;
    }

    @Entity()
    class Profile {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;

      @ToOne({ target: () => User })
      user!: User;
    }

    const metadata = Database.getInstance().getMetadata().get(Profile);
    expect(metadata).toBeDefined();
    const relations = metadata!.relations;
    expect(relations).toBeDefined();
    const resolvedRelations = relations.map((relation) => {
      const { getTarget, ...r } = relation;
      return {
        ...r,
        target: getTarget(),
      };
    });
    expect(resolvedRelations).toEqual([
      {
        propertyName: 'user',
        relationType: RelationType.TO_ONE,
        columnName: 'user_id',
        columnType: COLUMN_TYPE.SERIAL,
        target: User,
      },
    ]);
  });

  test('uses foreignKey option as column name when provided', () => {
    @Entity()
    class Author {
      id!: number;
    }

    @Entity()
    class Book {
      @ToOne({ target: () => Author, foreignKey: 'author_id' })
      author!: Author;
    }

    const metadata = Database.getInstance().getMetadata().get(Book)!;
    const relation = metadata.relations[0]!;
    expect(relation.columnName).toBe('author_id');
  });

  test('resolves columnType from target primary column', () => {
    @Entity()
    class Category {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      id!: number;
    }

    @Entity()
    class Article {
      @ToOne({ target: () => Category })
      category!: Category;
    }

    const metadata = Database.getInstance().getMetadata().get(Article);
    const relation = metadata!.relations[0]!;
    expect(relation.columnName).toBe('category_id');
    expect(relation.columnType).toBe(COLUMN_TYPE.SERIAL);
  });

  test('derives FK column name from target PK property name', () => {
    @Entity()
    class Tag {
      @PrimaryColumn({ type: COLUMN_TYPE.SERIAL })
      tagId!: number;
    }

    @Entity()
    class Post {
      @ToOne({ target: () => Tag })
      tag!: Tag;
    }

    const metadata = Database.getInstance().getMetadata().get(Post)!;
    const relation = metadata.relations[0]!;
    expect(relation.columnName).toBe('tag_tagId');
  });
});
