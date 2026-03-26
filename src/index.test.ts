import { test, expect, describe } from 'bun:test';
import {
  Entity,
  Column,
  PrimaryColumn,
  ToOne,
  Service,
  Inject,
  InjectRepository,
  Database,
  Repository,
  Container,
} from './index';

describe('public API exports', () => {
  test('all core exports are defined', () => {
    expect(Entity).toBeFunction();
    expect(Column).toBeFunction();
    expect(PrimaryColumn).toBeFunction();
    expect(ToOne).toBeFunction();
    expect(Service).toBeFunction();
    expect(Inject).toBeFunction();
    expect(InjectRepository).toBeFunction();
    expect(Database).toBeDefined();
    expect(Repository).toBeFunction();
    expect(Container).toBeDefined();
  });
});
