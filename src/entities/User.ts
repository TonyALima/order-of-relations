import { Entity, Column, PrimaryColumn } from "../core/decorators"

@Entity("user")
export class User {
  @PrimaryColumn()
  id!: number

  @Column()
  name!: string

  @Column()
  email!: string
}