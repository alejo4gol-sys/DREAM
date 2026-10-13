import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(120) q?: string;
}

export const offset = (q: PageQuery) => (q.page - 1) * q.pageSize;

/** Escapa comodines de LIKE para búsquedas seguras. */
export const likeTerm = (s: string) => `%${s.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
