import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export const DEMO_TASKS = ['general', 'stock', 'orders', 'sales', 'forecast', 'credit', 'promotions'] as const;
export class DemoFeedbackDto {
  @IsUUID('4') submissionId!: string;
  @IsIn(DEMO_TASKS) task!: string;
  @IsIn(['completed', 'assisted', 'blocked']) outcome!: string;
  @IsInt() @Min(1) @Max(5) ease!: number;
  @IsInt() @Min(1) @Max(5) usefulness!: number;
  @IsOptional() @IsString() @MaxLength(1000)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  comment?: string;
}
export class FeedbackPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
}
