import { Entity, Column, PrimaryColumn } from "../../../src"

@Entity("user")
export class User {
  @PrimaryColumn()
  id!: number

  @Column()
  name!: string

  @Column()
  email!: string
}
