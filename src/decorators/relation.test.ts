import { expect, test, describe } from 'bun:test';
import { RelationType } from '../core/metadata';
import { Database } from '../core/database';
import { Entity } from './entity';
import { ToOne } from './relation';

describe('@ToOne decorator', () => {
  test('stores relation metadata for the decorated class', () => {
    @Entity()
    class User {
      id!: number;

      @ToOne({ attribute: 'profileId', target: () => Profile })
      profile?: Profile;
    }

    @Entity()
    class Profile {
      id!: number;

      @ToOne({ attribute: 'userId', target: () => User })
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
        propertyName: 'userId',
        columnName: 'userId',
        type: RelationType.TO_ONE,
        target: User,
      },
    ]);
  });
});
